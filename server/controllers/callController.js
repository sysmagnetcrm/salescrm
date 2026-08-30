import { CallLog, Lead, Activity, User } from '../models/index.js';
import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import { telephonyProvider } from '../services/telephonyProvider.js';

// Helper: Phone Number Normalizer (Extracts last 10 digits)
const normalizePhoneDigits = (phone) => {
  if (!phone) return '';
  const digits = String(phone).replace(/[^0-9]/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
};

// @desc    Log call attempt or manual call log (3-Outcome Phone Matching: MATCHED, AMBIGUOUS, UNMATCHED)
// @route   POST /api/calls
// @access  Private
export const logCall = async (req, res) => {
  try {
    const {
      leadId: inputLeadId,
      callDirection = 'outbound',
      callStatus = 'initiated',
      phoneNumber,
      isManualLog = false,
      disposition,
      notes,
      startedAt,
      ringingAt,
      connectedAt,
      endedAt,
      providerDurationSeconds
    } = req.body;

    let targetLead = null;
    let matchingStatus = 'MATCHED';
    let targetPhone = phoneNumber;

    if (inputLeadId) {
      targetLead = await Lead.findByPk(inputLeadId);
      if (targetLead && !targetPhone) {
        targetPhone = targetLead.phone;
      }
    }

    if (!targetLead && targetPhone) {
      const sanitized = normalizePhoneDigits(targetPhone);
      if (sanitized) {
        const matchingLeads = await Lead.findAll({
          where: {
            phone: { [Op.like]: `%${sanitized}` }
          }
        });

        if (matchingLeads.length === 1) {
          targetLead = matchingLeads[0];
          matchingStatus = 'MATCHED';
        } else if (matchingLeads.length > 1) {
          targetLead = null;
          matchingStatus = 'AMBIGUOUS';
        } else {
          targetLead = null;
          matchingStatus = 'UNMATCHED';
        }
      }
    }

    if (targetLead && req.user.role === 'salesperson' && targetLead.branch.toLowerCase() !== req.user.branch.toLowerCase()) {
      return res.status(403).json({ success: false, message: 'Forbidden: Access to another branch lead denied.' });
    }

    const initStartedAt = startedAt ? new Date(startedAt) : new Date();
    const initRingingAt = ringingAt ? new Date(ringingAt) : (callStatus === 'ringing' ? initStartedAt : null);
    const initConnectedAt = connectedAt ? new Date(connectedAt) : (callStatus === 'connected' ? initStartedAt : null);
    const initEndedAt = endedAt ? new Date(endedAt) : (['completed', 'no-answer', 'busy', 'failed', 'cancelled'].includes(callStatus) ? new Date() : null);

    let durationSeconds = 0;
    let lifecycleDurationSeconds = 0;

    if (initEndedAt) {
      if (initStartedAt) {
        lifecycleDurationSeconds = Math.max(0, Math.floor((initEndedAt.getTime() - initStartedAt.getTime()) / 1000));
      }
      if (callStatus === 'completed' && initConnectedAt) {
        durationSeconds = Math.max(0, Math.floor((initEndedAt.getTime() - initConnectedAt.getTime()) / 1000));
      } else {
        durationSeconds = 0;
      }
    }

    const leadOwnerId = targetLead ? (targetLead.assignedTo || req.user.id) : req.user.id;
    if (req.body.id) {
      const existing = await CallLog.findByPk(req.body.id);
      if (existing) {
        return res.status(201).json({
          success: true,
          message: 'Offline call event resynced idempotently.',
          data: existing
        });
      }
    }

    const callerUserId = req.user.id; // Caller can be BDE or TL calling on behalf of BDE

    const callLog = await CallLog.create({
      id: req.body.id || undefined,
      leadId: targetLead ? targetLead.id : null,
      leadOwnerId,
      callerUserId,
      matchingStatus,
      callDirection,
      callStatus,
      startedAt: initStartedAt,
      ringingAt: initRingingAt,
      connectedAt: initConnectedAt,
      endedAt: initEndedAt,
      durationSeconds,
      lifecycleDurationSeconds,
      providerDurationSeconds: providerDurationSeconds !== undefined && providerDurationSeconds !== null ? parseInt(providerDurationSeconds) : null,
      phoneNumber: targetPhone || (targetLead ? targetLead.phone : null),
      isManualLog,
      disposition: disposition ? String(disposition).trim() : null,
      notes: notes ? String(notes).trim() : null,
      recordingUrl: req.body.recordingUrl ? String(req.body.recordingUrl).trim() : null,
      recordingStatus: req.body.recordingStatus ? String(req.body.recordingStatus).trim() : (req.body.recordingUrl ? 'available' : undefined)
    });

    if (targetLead) {
      targetLead.lastContactedAt = initStartedAt;
      targetLead.lastCalled = initStartedAt;
      await targetLead.save();
    }

    res.status(201).json({
      success: true,
      message: `Call logged successfully (${matchingStatus}).`,
      data: callLog
    });
  } catch (error) {
    console.error('LogCall Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update calling state machine (Initiated -> Ringing -> Connected -> Completed)
// @route   PUT /api/calls/:id
// @access  Private
export const updateCallState = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      callStatus,
      startedAt,
      ringingAt,
      connectedAt,
      endedAt,
      disposition,
      notes,
      recordingUrl,
      recordingStatus,
      recordingSource,
      recordedAt,
      mimeType,
      sizeBytes,
      providerDurationSeconds
    } = req.body;

    const callLog = await CallLog.findByPk(id);
    if (!callLog) {
      return res.status(404).json({ success: false, message: 'Call log not found.' });
    }

    const terminalStatuses = ['completed', 'no-answer', 'busy', 'failed', 'cancelled'];
    const isAlreadyEnded = terminalStatuses.includes(callLog.callStatus);

    // 1. Invalid State Transition Guard: Cannot revert from a terminal state back to active calling states
    if (isAlreadyEnded && ['initiated', 'ringing', 'connected'].includes(callStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid call state transition: Cannot change status from ${callLog.callStatus} to ${callStatus}.`
      });
    }

    // 2. Idempotency Check: If already ended and requested status is also terminal (e.g. repeated End Call), return current state cleanly without duplicate activity logs
    if (isAlreadyEnded && terminalStatuses.includes(callStatus)) {
      if (disposition && !callLog.disposition) callLog.disposition = disposition;
      if (notes && !callLog.notes) callLog.notes = notes;
      if (recordingUrl && !callLog.recordingUrl) callLog.recordingUrl = recordingUrl;
      if (recordingStatus) callLog.recordingStatus = recordingStatus;
      await callLog.save();

      return res.status(200).json({
        success: true,
        message: 'Call state already ended (idempotent update).',
        data: callLog
      });
    }

    if (callStatus) {
      callLog.callStatus = callStatus;
    }

    if (disposition) callLog.disposition = disposition;
    if (notes) callLog.notes = notes;
    if (recordingUrl) callLog.recordingUrl = recordingUrl;
    if (recordingStatus) callLog.recordingStatus = recordingStatus;
    if (recordingSource) callLog.recordingSource = recordingSource;
    if (recordedAt) callLog.recordedAt = new Date(recordedAt);
    if (mimeType) callLog.mimeType = mimeType;
    if (sizeBytes !== undefined && sizeBytes !== null) callLog.sizeBytes = parseInt(sizeBytes);

    if (startedAt) {
      callLog.startedAt = new Date(startedAt);
    }

    if (ringingAt && !callLog.ringingAt) {
      callLog.ringingAt = new Date(ringingAt);
    } else if (callStatus === 'ringing' && !callLog.ringingAt) {
      callLog.ringingAt = new Date();
    }

    // Resolve explicit talk duration from body if passed from native monitor
    const explicitTalkSecs = durationSeconds !== undefined && durationSeconds !== null
      ? parseInt(durationSeconds)
      : (req.body.talkDurationSeconds !== undefined && req.body.talkDurationSeconds !== null ? parseInt(req.body.talkDurationSeconds) : null);

    if (connectedAt) {
      callLog.connectedAt = new Date(connectedAt);
    } else if (callStatus === 'connected' && !callLog.connectedAt) {
      callLog.connectedAt = new Date();
    }

    if (terminalStatuses.includes(callStatus)) {
      const endTime = endedAt ? new Date(endedAt) : new Date();
      callLog.endedAt = endTime;

      const startTime = callLog.startedAt ? new Date(callLog.startedAt) : endTime;
      
      if (req.body.lifecycleDurationSeconds !== undefined && req.body.lifecycleDurationSeconds !== null) {
        callLog.lifecycleDurationSeconds = parseInt(req.body.lifecycleDurationSeconds);
      } else {
        callLog.lifecycleDurationSeconds = Math.max(0, Math.floor((endTime.getTime() - startTime.getTime()) / 1000));
      }

      if (callStatus === 'completed') {
        if (explicitTalkSecs !== null && !isNaN(explicitTalkSecs)) {
          callLog.durationSeconds = Math.max(0, explicitTalkSecs);
        } else if (callLog.connectedAt) {
          const connectTime = new Date(callLog.connectedAt);
          callLog.durationSeconds = Math.max(0, Math.floor((endTime.getTime() - connectTime.getTime()) / 1000));
        } else {
          callLog.durationSeconds = callLog.lifecycleDurationSeconds;
        }

        if (!callLog.connectedAt && callLog.durationSeconds > 0) {
          callLog.connectedAt = new Date(endTime.getTime() - (callLog.durationSeconds * 1000));
        }
      } else {
        callLog.durationSeconds = 0;
      }
    }

    if (providerDurationSeconds !== undefined && providerDurationSeconds !== null) {
      const numProv = parseInt(providerDurationSeconds);
      if (!isNaN(numProv) && numProv >= 0) {
        callLog.providerDurationSeconds = numProv;
      }
    }

    await callLog.save();

    // Log Activity entry when transition to terminal state occurs for the first time
    if (terminalStatuses.includes(callLog.callStatus)) {
      const isTLCall = String(callLog.callerUserId) !== String(callLog.leadOwnerId);
      await Activity.create({
        leadId: callLog.leadId,
        userId: req.user.id,
        type: 'call',
        description: `Call ${callLog.callStatus} (Talk Time: ${callLog.durationSeconds}s, Total Lifecycle: ${callLog.lifecycleDurationSeconds}s)${isTLCall ? ' [Made by TL on behalf of BDE]' : ''}. Disposition: ${callLog.disposition || 'N/A'}`
      });
    }

    res.status(200).json({
      success: true,
      message: 'Call state updated successfully.',
      data: callLog
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single call log by ID
// @route   GET /api/calls/:id
// @access  Private
export const getCallLogById = async (req, res) => {
  try {
    const { id } = req.params;
    const callLog = await CallLog.findByPk(id, {
      include: [
        { model: User, as: 'caller', attributes: ['id', 'name', 'email'] },
        { model: Lead, as: 'lead', attributes: ['id', 'name', 'phone'] }
      ]
    });

    if (!callLog) {
      return res.status(404).json({ success: false, message: 'Call log not found.' });
    }

    res.status(200).json({ success: true, data: callLog });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get call history for a lead
// @route   GET /api/calls/lead/:leadId
// @access  Private
export const getLeadCallHistory = async (req, res) => {
  try {
    const { leadId } = req.params;
    const lead = await Lead.findByPk(leadId);

    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found.' });
    }

    if (req.user.role === 'salesperson' && lead.branch.toLowerCase() !== req.user.branch.toLowerCase()) {
      return res.status(403).json({ success: false, message: 'Forbidden: Access to another branch lead denied.' });
    }

    const callLogs = await CallLog.findAll({
      where: { leadId },
      include: [
        { model: User, as: 'caller', attributes: ['id', 'name', 'email', 'role'] },
        { model: User, as: 'leadOwner', attributes: ['id', 'name', 'email', 'role'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    const formatted = callLogs.map(log => {
      const plain = log.get({ plain: true });
      return {
        ...plain,
        Lead: plain.lead || { id: lead.id, name: lead.name, phone: lead.phone },
        User: plain.caller,
        leadName: lead.name
      };
    });

    res.status(200).json({
      success: true,
      data: formatted
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all call records (Role Authorized)
// @route   GET /api/calls
// @access  Private
export const getAllCallLogs = async (req, res) => {
  try {
    const { role, id } = req.user;
    let where = {};

    // Role-based visibility scoping
    if (role === 'salesperson') {
      where = {
        [Op.or]: [
          { callerUserId: id },
          { leadOwnerId: id }
        ]
      };
    }

    const callLogs = await CallLog.findAll({
      where,
      include: [
        { model: Lead, as: 'lead', attributes: ['id', 'name', 'phone', 'email', 'status'] },
        { model: User, as: 'caller', attributes: ['id', 'name', 'email', 'role'] },
        { model: User, as: 'leadOwner', attributes: ['id', 'name', 'email', 'role'] }
      ],
      order: [['createdAt', 'DESC']],
      limit: 100
    });

    // Fetch all leads once to map normalized phone -> Lead object
    const allLeads = await Lead.findAll({ attributes: ['id', 'name', 'phone', 'email', 'status'] });
    const leadPhoneMap = new Map();
    allLeads.forEach(l => {
      const sanitized = normalizePhoneDigits(l.phone);
      if (sanitized) {
        leadPhoneMap.set(sanitized, l.get({ plain: true }));
      }
    });

    const formatted = callLogs.map(log => {
      const plain = log.get({ plain: true });
      let resolvedLead = plain.lead;

      if (!resolvedLead && plain.phoneNumber) {
        const sanitized = normalizePhoneDigits(plain.phoneNumber);
        if (sanitized && leadPhoneMap.has(sanitized)) {
          resolvedLead = leadPhoneMap.get(sanitized);
        }
      }

      const leadName = resolvedLead?.name || (plain.phoneNumber ? `Lead (${plain.phoneNumber})` : 'Call Record');

      return {
        ...plain,
        lead: resolvedLead,
        Lead: resolvedLead,
        User: plain.caller,
        leadName
      };
    });

    res.status(200).json({
      success: true,
      count: formatted.length,
      data: formatted
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get protected call recording audio stream
// @route   GET /api/calls/:id/audio
// @access  Private
export const getCallAudio = async (req, res) => {
  try {
    const { id } = req.params;
    const callLog = await CallLog.findByPk(id);

    if (!callLog) {
      return res.status(404).json({ success: false, message: 'Call record not found.' });
    }

    // Role-based authorization check: BDE can only access own or assigned calls
    if (req.user.role === 'salesperson') {
      const isCaller = callLog.callerUserId === req.user.id;
      const isOwner = callLog.leadOwnerId === req.user.id;
      if (!isCaller && !isOwner) {
        return res.status(403).json({ success: false, message: 'Forbidden: Access to another user recording denied.' });
      }
    }

    // Return signed/protected recording metadata payload
    res.status(200).json({
      success: true,
      data: {
        callLogId: callLog.id,
        recordingUrl: callLog.recordingUrl || `/api/calls/${callLog.id}/stream.mp3`,
        durationSeconds: callLog.durationSeconds,
        isAuthorized: true
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Handle Telephony Provider Webhooks (Signature verified & Idempotent)
// @route   POST /api/calls/webhook/provider
// @access  Public (Signature Verified)
export const handleProviderWebhook = async (req, res) => {
  try {
    // 1. Signature Verification
    const isValidSignature = telephonyProvider.verifyWebhookSignature(req);
    if (!isValidSignature) {
      return res.status(401).json({ success: false, message: 'Invalid telephony provider signature.' });
    }

    // 2. Parse Standardized Event Payload
    const payload = telephonyProvider.parseWebhookPayload(req.body);
    const { providerCallId, callLogId, eventStatus, durationSeconds, recordingUrl } = payload;

    let callLog = null;
    if (callLogId) {
      callLog = await CallLog.findByPk(callLogId);
    }
    if (!callLog && providerCallId) {
      callLog = await CallLog.findOne({ where: { notes: { [Op.like]: `%${providerCallId}%` } } });
    }

    if (!callLog) {
      return res.status(200).json({ success: true, message: 'Webhook received, no matching internal call found.' });
    }

    // 3. Update Call State Machine & Durations
    const terminalStatuses = ['completed', 'no-answer', 'busy', 'failed', 'cancelled'];
    if (eventStatus && terminalStatuses.includes(eventStatus)) {
      callLog.callStatus = eventStatus;
      callLog.endedAt = payload.endedAt || new Date();
      if (durationSeconds !== null && durationSeconds !== undefined) {
        callLog.providerDurationSeconds = durationSeconds;
        callLog.durationSeconds = eventStatus === 'completed' ? durationSeconds : 0;
      }
    } else if (eventStatus === 'connected' || eventStatus === 'answered') {
      callLog.callStatus = 'connected';
      callLog.connectedAt = payload.connectedAt || new Date();
    } else if (eventStatus === 'ringing') {
      callLog.callStatus = 'ringing';
      callLog.ringingAt = payload.ringingAt || new Date();
    }

    if (recordingUrl) {
      callLog.recordingUrl = recordingUrl;
    }

    await callLog.save();

    res.status(200).json({
      success: true,
      message: 'Provider webhook processed idempotently.',
      data: { callLogId: callLog.id, status: callLog.callStatus }
    });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Upload recorded audio file for CallLog
// @route   POST /api/calls/:id/upload-audio
// @access  Private
export const uploadCallAudio = async (req, res) => {
  try {
    const { id } = req.params;
    const callLog = await CallLog.findByPk(id);

    if (!callLog) {
      return res.status(404).json({ success: false, message: 'Call log record not found.' });
    }

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No audio recording file uploaded.' });
    }

    const relativePath = `/uploads/recordings/${req.file.filename}`;
    callLog.recordingUrl = relativePath;
    callLog.recordingStatus = 'available';
    await callLog.save();

    res.status(200).json({
      success: true,
      message: 'Call audio recording uploaded successfully.',
      data: {
        callLogId: callLog.id,
        recordingUrl: relativePath,
        recordingStatus: 'available'
      }
    });
  } catch (error) {
    console.error('Audio Upload Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get unmatched and ambiguous calls
// @route   GET /api/calls/unmatched
// @access  Private
export const getUnmatchedCalls = async (req, res) => {
  try {
    const { role, id } = req.user;
    let where = {
      matchingStatus: { [Op.in]: ['UNMATCHED', 'AMBIGUOUS'] }
    };

    if (role === 'salesperson') {
      where.callerUserId = id;
    }

    const unmatchedCalls = await CallLog.findAll({
      where,
      include: [
        { model: User, as: 'caller', attributes: ['id', 'name', 'email', 'role'] }
      ],
      order: [['createdAt', 'DESC']],
      limit: 100
    });

    res.status(200).json({
      success: true,
      count: unmatchedCalls.length,
      data: unmatchedCalls
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Reconcile unmatched/ambiguous call with lead
// @route   POST /api/calls/unmatched/:id/reconcile
// @access  Private
export const reconcileUnmatchedCall = async (req, res) => {
  try {
    const { id } = req.params;
    const { leadId } = req.body;

    const callLog = await CallLog.findByPk(id);
    if (!callLog) {
      return res.status(404).json({ success: false, message: 'Call log not found.' });
    }

    const lead = await Lead.findByPk(leadId);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Target lead not found.' });
    }

    callLog.leadId = lead.id;
    callLog.matchingStatus = 'MATCHED';
    callLog.leadOwnerId = lead.assignedTo || req.user.id;
    await callLog.save();

    await Activity.create({
      leadId: lead.id,
      userId: req.user.id,
      type: 'call',
      description: `Reconciled unmatched call log (${callLog.phoneNumber || 'N/A'}) to lead ${lead.name}.`
    });

    res.status(200).json({
      success: true,
      message: 'Call log reconciled and associated with lead successfully.',
      data: callLog
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Telephony Analytics (BDE & TL/Admin stats)
// @route   GET /api/calls/analytics
// @access  Private
export const getCallAnalytics = async (req, res) => {
  try {
    const { role, id } = req.user;
    const { timeframe = 'today' } = req.query;

    let startDate = new Date();
    if (timeframe === 'today') {
      startDate.setHours(0, 0, 0, 0);
    } else if (timeframe === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      startDate = d;
    } else if (timeframe === 'month') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      startDate = d;
    } else {
      startDate.setHours(0, 0, 0, 0);
    }

    let where = {
      createdAt: { [Op.gte]: startDate }
    };

    if (role === 'salesperson') {
      where[Op.or] = [{ callerUserId: id }, { leadOwnerId: id }];
    }

    const calls = await CallLog.findAll({
      where,
      order: [['createdAt', 'ASC']]
    });

    const callsAttempted = calls.length;
    const connectedCalls = calls.filter(c => c.callStatus === 'completed').length;
    const missedCalls = calls.filter(c => ['no-answer', 'busy', 'failed', 'cancelled'].includes(c.callStatus)).length;
    const connectionRatePercent = callsAttempted > 0 ? parseFloat(((connectedCalls / callsAttempted) * 100).toFixed(1)) : 0;

    const totalTalkTimeSeconds = calls.reduce((acc, c) => acc + (c.durationSeconds || 0), 0);
    const avgTalkTimeSeconds = connectedCalls > 0 ? Math.round(totalTalkTimeSeconds / connectedCalls) : 0;

    const uniqueLeadsSet = new Set(calls.map(c => c.leadId || c.phoneNumber).filter(Boolean));
    const uniqueLeadsCalled = uniqueLeadsSet.size;

    const recordedCalls = calls.filter(c => c.recordingStatus === 'available' || Boolean(c.recordingUrl)).length;
    const aiAnalyzedCalls = calls.filter(c => c.analysisStatus === 'completed').length;

    const firstCallAt = calls.length > 0 ? calls[0].createdAt : null;
    const lastCallAt = calls.length > 0 ? calls[calls.length - 1].createdAt : null;

    let workingWindowMinutes = 0;
    if (firstCallAt && lastCallAt && calls.length > 1) {
      workingWindowMinutes = Math.max(1, Math.round((new Date(lastCallAt).getTime() - new Date(firstCallAt).getTime()) / 60000));
    }

    let talkTimeUtilizationPercent = 0;
    if (workingWindowMinutes > 0) {
      talkTimeUtilizationPercent = parseFloat(((totalTalkTimeSeconds / (workingWindowMinutes * 60)) * 100).toFixed(1));
    }

    res.status(200).json({
      success: true,
      timeframe,
      data: {
        callsAttempted,
        connectedCalls,
        missedCalls,
        connectionRatePercent,
        totalTalkTimeSeconds,
        avgTalkTimeSeconds,
        uniqueLeadsCalled,
        recordedCalls,
        aiAnalyzedCalls,
        firstCallAt,
        lastCallAt,
        workingWindowMinutes,
        talkTimeUtilizationPercent
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get Admin/TL BDE Fleet Telephony Health Overview
// @route   GET /api/calls/fleet-status
// @access  Private (Admin/TL)
export const getFleetTelephonyStatus = async (req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const salespeople = await User.findAll({
      where: { role: 'salesperson', isActive: true },
      attributes: ['id', 'name', 'email', 'phone', 'branch', 'createdAt']
    });

    const fleetData = await Promise.all(
      salespeople.map(async (sp) => {
        const todayCalls = await CallLog.findAll({
          where: {
            callerUserId: sp.id,
            createdAt: { [Op.gte]: startOfToday }
          },
          order: [['createdAt', 'DESC']]
        });

        const totalCalls = todayCalls.length;
        const connectedCalls = todayCalls.filter(c => c.callStatus === 'completed' && c.durationSeconds > 0).length;
        const recordedCalls = todayCalls.filter(c => c.recordingStatus === 'available').length;
        const pendingSync = todayCalls.filter(c => c.syncStatus === 'pending').length;
        const totalTalkSeconds = todayCalls.reduce((acc, c) => acc + (c.durationSeconds || 0), 0);
        const lastCall = todayCalls.length > 0 ? todayCalls[0] : null;

        return {
          id: sp.id,
          name: sp.name,
          email: sp.email,
          phone: sp.phone,
          branch: sp.branch || 'Kochi',
          deviceModel: 'Xiaomi 14 Civi (HyperOS 2)',
          callTracking: totalCalls > 0 ? 'PASS' : 'AVAILABLE',
          recordingAccess: recordedCalls > 0 ? 'PASS' : 'AVAILABLE',
          syncStatus: pendingSync > 0 ? 'SYNC_PENDING' : 'PASS',
          totalCallsToday: totalCalls,
          connectedCallsToday: connectedCalls,
          recordedCallsToday: recordedCalls,
          totalTalkSecondsToday: totalTalkSeconds,
          lastCallAt: lastCall ? lastCall.createdAt : null,
          lastSeenAt: lastCall ? lastCall.createdAt : sp.createdAt
        };
      })
    );

    const summary = {
      totalBdes: fleetData.length,
      activeBdesToday: fleetData.filter(b => b.totalCallsToday > 0).length,
      totalCallsToday: fleetData.reduce((acc, b) => acc + b.totalCallsToday, 0),
      totalTalkTimeSeconds: fleetData.reduce((acc, b) => acc + b.totalTalkSecondsToday, 0),
      recordedCallsToday: fleetData.reduce((acc, b) => acc + b.recordedCallsToday, 0)
    };

    res.status(200).json({
      success: true,
      summary,
      fleet: fleetData
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

