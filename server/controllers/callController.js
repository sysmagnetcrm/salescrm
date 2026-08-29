import { CallLog, Lead, Activity, User } from '../models/index.js';
import { Op } from 'sequelize';
import sequelize from '../config/database.js';

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

    lead.lastContactedAt = initStartedAt;
    lead.lastCalled = initStartedAt;
    await lead.save();

    res.status(201).json({
      success: true,
      message: 'Call initiated / logged successfully.',
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

    if (callStatus) {
      callLog.callStatus = callStatus;
    }

    if (disposition) callLog.disposition = disposition;
    if (notes) callLog.notes = notes;
    if (recordingUrl) callLog.recordingUrl = recordingUrl;

    if (callStatus === 'ringing' && !callLog.ringingAt) {
      callLog.ringingAt = ringingAt ? new Date(ringingAt) : new Date();
    }

    if (callStatus === 'connected' && !callLog.connectedAt) {
      callLog.connectedAt = connectedAt ? new Date(connectedAt) : new Date();
    }

    if (['completed', 'no-answer', 'busy', 'failed', 'cancelled'].includes(callStatus)) {
      const endTime = endedAt ? new Date(endedAt) : new Date();
      callLog.endedAt = endTime;

      // Full lifecycle duration (endedAt - startedAt)
      if (callLog.startedAt) {
        callLog.lifecycleDurationSeconds = Math.max(0, Math.floor((endTime.getTime() - new Date(callLog.startedAt).getTime()) / 1000));
      }

      // Actual talk duration (endedAt - connectedAt for connected calls; 0 for calls that never connect)
      if (callStatus === 'completed' && callLog.connectedAt) {
        callLog.durationSeconds = Math.max(0, Math.floor((endTime.getTime() - new Date(callLog.connectedAt).getTime()) / 1000));
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

    // Log Activity entry when completed or ended
    if (['completed', 'no-answer', 'busy', 'failed', 'cancelled'].includes(callLog.callStatus)) {
      const isTLCall = callLog.callerUserId !== callLog.leadOwnerId;
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

