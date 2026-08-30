import XLSX from 'xlsx';
import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import { Lead, CallLog, Payment, AssignmentHistory, Activity } from '../models/index.js';

// @desc    Get system version and client compatibility requirements
// @route   GET /api/system/version
// @access  Public
export const getSystemVersion = (req, res) => {
  res.status(200).json({
    success: true,
    data: {
      currentVersion: '1.2.0',
      minSupportedVersion: '1.0.0',
      updateRequired: false,
      message: 'System operating normally'
    }
  });
};

// @desc    Generate multi-sheet Excel report (.xlsx) for Leads, CallLogs, and Payments
// @route   GET /api/system/export/report
// @access  Private/Admin
export const exportReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const where = {};

    if (startDate && endDate) {
      const s = new Date(startDate);
      const e = new Date(endDate);
      if (e.getHours() === 0) e.setHours(23, 59, 59, 999);
      where.createdAt = { [Op.gte]: s, [Op.lte]: e };
    }

    const leads = await Lead.findAll({ where, raw: true });
    const callLogs = await CallLog.findAll({ where, raw: true });
    const payments = await Payment.findAll({ where, raw: true });

    const wb = XLSX.utils.book_new();

    const leadsSheet = XLSX.utils.json_to_sheet(leads.length ? leads : [{}]);
    const callLogsSheet = XLSX.utils.json_to_sheet(callLogs.length ? callLogs : [{}]);
    const paymentsSheet = XLSX.utils.json_to_sheet(payments.length ? payments : [{}]);

    XLSX.utils.book_append_sheet(wb, leadsSheet, 'Leads');
    XLSX.utils.book_append_sheet(wb, callLogsSheet, 'CallLogs');
    XLSX.utils.book_append_sheet(wb, paymentsSheet, 'Payments');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="crm_report.xlsx"');
    return res.status(200).send(buffer);
  } catch (error) {
    console.error('Export Report Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Full-fidelity JSON data backup bundle
// @route   GET /api/system/export/backup
// @access  Private/Admin
export const exportBackup = async (req, res) => {
  try {
    const leads = await Lead.findAll({ raw: true });
    const callLogs = await CallLog.findAll({ raw: true });
    const payments = await Payment.findAll({ raw: true });
    const assignmentHistories = await AssignmentHistory.findAll({ raw: true });
    const activities = await Activity.findAll({ raw: true });

    return res.status(200).json({
      success: true,
      data: {
        exportedAt: new Date().toISOString(),
        leads,
        callLogs,
        payments,
        assignmentHistories,
        activities
      }
    });
  } catch (error) {
    console.error('Export Backup Error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Full-replace database restore from JSON backup bundle with transaction rollback safety
// @route   POST /api/system/restore
// @access  Private/Admin
export const restoreDatabase = async (req, res) => {
  try {
    const { confirmFullReplace, backupData, simulateFailure } = req.body;

    if (!confirmFullReplace) {
      return res.status(400).json({
        success: false,
        message: 'Full replace confirmation flag confirmFullReplace: true is required'
      });
    }

    const payload = backupData || req.body;
    if (!payload || !payload.leads) {
      return res.status(400).json({
        success: false,
        message: 'Invalid backup payload. backupData with leads array is required.'
      });
    }

    const transaction = await sequelize.transaction();
    try {
      if (sequelize.getDialect() === 'sqlite') {
        await sequelize.query('PRAGMA foreign_keys = OFF;', { transaction });
      }

      await Activity.destroy({ where: {}, transaction });
      await AssignmentHistory.destroy({ where: {}, transaction });
      await CallLog.destroy({ where: {}, transaction });
      await Payment.destroy({ where: {}, transaction });
      await Lead.destroy({ where: {}, transaction });

      if (payload.leads && payload.leads.length > 0) {
        await Lead.bulkCreate(payload.leads, { transaction, validate: false });
      }

      // Simulated failure trigger for transaction rollback testing
      if (simulateFailure) {
        throw new Error('Simulated failure during database restore transaction');
      }

      if (payload.payments && payload.payments.length > 0) {
        await Payment.bulkCreate(payload.payments, { transaction, validate: false });
      }
      if (payload.callLogs && payload.callLogs.length > 0) {
        await CallLog.bulkCreate(payload.callLogs, { transaction, validate: false });
      }
      if (payload.assignmentHistories && payload.assignmentHistories.length > 0) {
        await AssignmentHistory.bulkCreate(payload.assignmentHistories, { transaction, validate: false });
      }
      if (payload.activities && payload.activities.length > 0) {
        await Activity.bulkCreate(payload.activities, { transaction, validate: false });
      }

      if (sequelize.getDialect() === 'sqlite') {
        await sequelize.query('PRAGMA foreign_keys = ON;', { transaction });
      }

      await transaction.commit();
      return res.status(200).json({
        success: true,
        message: 'Database successfully restored from backup'
      });
    } catch (err) {
      await transaction.rollback();
      console.error('Restore Transaction Error:', err);
      return res.status(500).json({
        success: false,
        message: `Restore failed and transaction rolled back: ${err.message}`
      });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
