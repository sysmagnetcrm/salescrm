import { CallLog, Lead, Activity, User } from '../models/index.js';
import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import { telephonyProvider } from '../services/telephonyProvider.js';

// @desc    Log call attempt or manual call log (TL calling on behalf of BDE supported)
// @route   POST /api/calls
// @access  Private
export const logCall = async (req, res) => {
  try {
    const {
      leadId,
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

    const lead = await Lead.findByPk(leadId);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found.' });
    }

    if (req.user.role === 'salesperson' && lead.branch.toLowerCase() !== req.user.branch.toLowerCase()) {
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

    const leadOwnerId = lead.assignedTo || req.user.id;
    const callerUserId = req.user.id; // Caller can be BDE or TL calling on behalf of BDE

    const callLog = await CallLog.create({
      leadId,
      leadOwnerId,
      callerUserId,
      callDirection,
      callStatus,
      startedAt: initStartedAt,
      ringingAt: initRingingAt,
      connectedAt: initConnectedAt,
      endedAt: initEndedAt,
      durationSeconds,
      lifecycleDurationSeconds,
      providerDurationSeconds: providerDurationSeconds !== undefined && providerDurationSeconds !== null ? parseInt(providerDurationSeconds) : null,
      phoneNumber: phoneNumber || lead.phone,
      isManualLog,
      disposition: disposition ? String(disposition).trim() : null,
      notes: notes ? String(notes).trim() : null
    });

    // Delegate to Telephony Provider abstraction
    const providerRes = await telephonyProvider.initiateCall({
      callLogId: callLog.id,
      toPhoneNumber: callLog.phoneNumber,
      callerUserId: callLog.callerUserId
    });

    lead.lastContactedAt = initStartedAt;
    lead.lastCalled = initStartedAt;
    await lead.save();

    res.status(201).json({
      success: true,
      message: 'Call initiated successfully.',
      data: {
        ...callLog.toJSON(),
        providerCallId: providerRes.providerCallId,
        providerStatus: providerRes.status
      }
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

    if (startedAt) {
      callLog.startedAt = new Date(startedAt);
    }

    if (ringingAt && !callLog.ringingAt) {
      callLog.ringingAt = new Date(ringingAt);
    } else if (callStatus === 'ringing' && !callLog.ringingAt) {
      callLog.ringingAt = new Date();
    }

    if (connectedAt && !callLog.connectedAt) {
      callLog.connectedAt = new Date(connectedAt);
    } else if (callStatus === 'connected' && !callLog.connectedAt) {
      callLog.connectedAt = new Date();
    } else if (callStatus === 'completed' && !callLog.connectedAt) {
      callLog.connectedAt = connectedAt ? new Date(connectedAt) : (callLog.startedAt || new Date());
    }

    if (terminalStatuses.includes(callStatus)) {
      const endTime = endedAt ? new Date(endedAt) : new Date();
      callLog.endedAt = endTime;

      const startTime = callLog.startedAt ? new Date(callLog.startedAt) : endTime;
      callLog.lifecycleDurationSeconds = Math.max(0, Math.floor((endTime.getTime() - startTime.getTime()) / 1000));

      // Actual talk duration (endedAt - connectedAt for connected calls; 0 for non-connected calls)
      if (callStatus === 'completed' && callLog.connectedAt) {
        const connectTime = new Date(callLog.connectedAt);
        callLog.durationSeconds = Math.max(0, Math.floor((endTime.getTime() - connectTime.getTime()) / 1000));
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

    res.status(200).json({
      success: true,
      data: callLogs
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

    res.status(200).json({
      success: true,
      count: callLogs.length,
      data: callLogs
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

