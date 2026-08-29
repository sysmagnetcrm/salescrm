import { User, Lead, Activity, CallLog, Payment, AssignmentHistory, AppBranding } from '../models/index.js';
import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import { getStartOfWeek, getStartOfMonth, getLast7DaysStart } from '../utils/dateUtils.js';
import { LEAD_STATUS } from '../utils/statusConstants.js';

// @desc    Get all salespeople
// @route   GET /api/users/salespeople
// @access  Private/Admin
export const getSalespeople = async (req, res) => {
  try {
    const { branch } = req.query;
    const effectiveBranch = req.effectiveBranch || (branch ? branch.toLowerCase() : null);

    const where = { role: 'salesperson' };
    if (effectiveBranch) where.branch = effectiveBranch;

    const salespeople = await User.findAll({
      where,
      attributes: { exclude: ['password'] },
      include: [{
        model: Lead,
        as: 'leads',
        attributes: ['id', 'status', 'value']
      }]
    });

    res.status(200).json({
      success: true,
      count: salespeople.length,
      data: salespeople
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Create salesperson
// @route   POST /api/users/salespeople
// @access  Private/Admin
export const createSalesperson = async (req, res) => {
  try {
    const { name, email, password, phone, monthlyTarget, weeklyTarget, branch } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide name, email, and password' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const userExists = await User.findOne({ where: { email: normalizedEmail } });
    if (userExists) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      role: 'salesperson',
      phone: phone ? String(phone).trim() : null,
      monthlyTarget: monthlyTarget && !isNaN(monthlyTarget) && Number(monthlyTarget) >= 0 ? Number(monthlyTarget) : 0,
      weeklyTarget: weeklyTarget && !isNaN(weeklyTarget) && Number(weeklyTarget) >= 0 ? Number(weeklyTarget) : 0,
      branch: branch ? branch.toLowerCase() : 'main'
    });

    const userResponse = user.toJSON();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      data: userResponse
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Update salesperson
// @route   PUT /api/users/salespeople/:id
// @access  Private/Admin
export const updateSalesperson = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, monthlyTarget, weeklyTarget, isActive, branch } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.role !== 'salesperson') {
      return res.status(400).json({
        success: false,
        message: 'Can only update salesperson accounts'
      });
    }

    if (email && email.toLowerCase().trim() !== user.email) {
      const emailExists = await User.findOne({ where: { email: email.toLowerCase().trim() } });
      if (emailExists) {
        return res.status(400).json({ success: false, message: 'Email is already in use' });
      }
    }

    await user.update({
      name: name ? name.trim() : user.name,
      email: email ? email.toLowerCase().trim() : user.email,
      phone: phone !== undefined ? phone : user.phone,
      monthlyTarget: monthlyTarget !== undefined && !isNaN(monthlyTarget) ? Number(monthlyTarget) : user.monthlyTarget,
      weeklyTarget: weeklyTarget !== undefined && !isNaN(weeklyTarget) ? Number(weeklyTarget) : user.weeklyTarget,
      isActive: isActive !== undefined ? Boolean(isActive) : user.isActive,
      branch: branch ? branch.toLowerCase() : user.branch
    });

    const userResponse = user.toJSON();
    delete userResponse.password;

    res.status(200).json({
      success: true,
      data: userResponse
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Deactivate or Delete salesperson with dependency audit & self-protection
// @route   DELETE /api/users/salespeople/:id
// @access  Private/Admin
export const deleteSalesperson = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const { id } = req.params;
    const isHardDelete = req.query.hard === 'true';

    // 1. Self-deletion protection
    if (req.user.id === id) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'You cannot remove your own account.'
      });
    }

    const user = await User.findByPk(id, { transaction });
    if (!user) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // 2. Last admin protection
    if (user.role === 'admin' && user.isActive) {
      const activeAdminCount = await User.count({
        where: { role: 'admin', isActive: true },
        transaction
      });
      if (activeAdminCount <= 1) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'At least one active administrator must remain.'
        });
      }
    }

    // 3. Dependency Audit: Check if user owns active leads
    const ownedLeadsCount = await Lead.count({ where: { assignedTo: id }, transaction });

    // Hard delete requested
    if (isHardDelete) {
      if (ownedLeadsCount > 0) {
        await transaction.rollback();
        return res.status(409).json({
          success: false,
          message: `This salesperson still owns ${ownedLeadsCount} lead(s). You must reassign these leads before removing the salesperson.`
        });
      }

      // Audit historical activity dependencies across all 9 User FK relationships
      const activityCount = await Activity.count({ where: { userId: id }, transaction });
      const callCount = await CallLog.count({
        where: { [Op.or]: [{ callerUserId: id }, { leadOwnerId: id }] },
        transaction
      });
      const paymentCount = await Payment.count({ where: { recordedBy: id }, transaction });
      const historyCount = await AssignmentHistory.count({
        where: { [Op.or]: [{ fromUserId: id }, { toUserId: id }, { assignedBy: id }] },
        transaction
      });
      const brandingCount = await AppBranding.count({ where: { updatedBy: id }, transaction });

      const totalDependencies = activityCount + callCount + paymentCount + historyCount + brandingCount;

      if (totalDependencies > 0) {
        // Safe archive path: preserve historical records, set isActive = false
        await user.update({ isActive: false }, { transaction });
        await transaction.commit();
        return res.status(200).json({
          success: true,
          message: 'Salesperson deactivated and archived successfully. Historical CRM records preserved.'
        });
      } else {
        // User has 0 leads and 0 historical records: Hard delete cleanly
        await user.destroy({ transaction });
        await transaction.commit();
        return res.status(200).json({
          success: true,
          message: 'Salesperson permanently removed.'
        });
      }
    }

    // Soft delete / deactivation request (default): set isActive = false
    await user.update({ isActive: false }, { transaction });
    await transaction.commit();

    res.status(200).json({
      success: true,
      message: 'Salesperson account deactivated successfully. Historical records preserved.'
    });
  } catch (error) {
    if (transaction) await transaction.rollback();
    console.error('❌ Delete Salesperson Exception:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to remove this salesperson right now. Please try again.'
    });
  }
};

export const deactivateSalesperson = deleteSalesperson;

// @desc    Get salesperson performance
// @route   GET /api/users/salespeople/:id/performance
// @access  Private
export const getSalespersonPerformance = async (req, res) => {
  try {
    const { id } = req.params;
    const { period } = req.query; // 'week' or 'month'

    const user = req.targetUser || await User.findByPk(id, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const startDate = period === 'week' ? getStartOfWeek() : getStartOfMonth();

    // Use SQL aggregation instead of loading all rows into Node memory
    const totalLeads = await Lead.count({
      where: { assignedTo: id, createdAt: { [Op.gte]: startDate } }
    });

    const registeredLeads = await Lead.count({
      where: { assignedTo: id, status: LEAD_STATUS.REGISTERED, createdAt: { [Op.gte]: startDate } }
    });

    const freshLeads = await Lead.count({
      where: { assignedTo: id, status: LEAD_STATUS.FRESH, createdAt: { [Op.gte]: startDate } }
    });

    const followUpLeads = await Lead.count({
      where: { assignedTo: id, status: LEAD_STATUS.FOLLOW_UP, createdAt: { [Op.gte]: startDate } }
    });

    const deadLeads = await Lead.count({
      where: { assignedTo: id, status: LEAD_STATUS.DEAD, createdAt: { [Op.gte]: startDate } }
    });

    const totalRevenueSum = await Lead.sum('value', {
      where: { assignedTo: id, status: LEAD_STATUS.REGISTERED, createdAt: { [Op.gte]: startDate } }
    });

    const totalRevenue = parseFloat(totalRevenueSum || 0);
    const conversionRate = totalLeads > 0 ? parseFloat(((registeredLeads / totalLeads) * 100).toFixed(2)) : 0;

    const stats = {
      totalLeads,
      freshLeads,
      followUpLeads,
      registeredLeads,
      closedLeads: registeredLeads, // Backward compatible mapping
      deadLeads,
      totalRevenue: totalRevenue.toFixed(2),
      conversionRate
    };

    res.status(200).json({
      success: true,
      data: {
        user,
        period: period || 'month',
        stats
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get detailed salesperson performance (calls, status changes)
// @route   GET /api/users/salespeople/:id/performance-detailed
// @access  Private/Admin
export const getDetailedPerformance = async (req, res) => {
  try {
    const { id } = req.params;
    const { period } = req.query; // 'daily', 'weekly', 'monthly'

    const user = req.targetUser || await User.findByPk(id, {
      attributes: ['id', 'name', 'email']
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    if (period === 'weekly') {
      startDate = getLast7DaysStart();
    } else if (period === 'monthly') {
      startDate = getStartOfMonth();
    }

    const activities = await Activity.findAll({
      where: {
        userId: id,
        createdAt: { [Op.gte]: startDate }
      },
      attributes: ['type', 'newStatus', 'createdAt']
    });

    const newLeadsCount = await Lead.count({
      where: {
        assignedTo: id,
        createdAt: { [Op.gte]: startDate }
      }
    });

    const stats = { calls: 0, followUps: 0, rnr: 0, registered: 0, fresh: newLeadsCount };
    const historyMap = {};

    const getDateKey = (d) => new Date(d).toISOString().split('T')[0];

    const tempDate = new Date(startDate);
    const endDate = new Date();
    while (tempDate <= endDate) {
      historyMap[getDateKey(tempDate)] = { date: getDateKey(tempDate), calls: 0, followUps: 0, rnr: 0, registered: 0, fresh: 0 };
      tempDate.setDate(tempDate.getDate() + 1);
    }

    activities.forEach(act => {
      const dateKey = getDateKey(act.createdAt);
      if (!historyMap[dateKey]) return;

      if (act.type === 'call') {
        stats.calls++;
        historyMap[dateKey].calls++;
      }

      if (act.newStatus) {
        const status = act.newStatus.toLowerCase();
        if (status === LEAD_STATUS.FOLLOW_UP) {
          stats.followUps++;
          historyMap[dateKey].followUps++;
        }
        if (status === LEAD_STATUS.RNR) {
          stats.rnr++;
          historyMap[dateKey].rnr++;
        }
        if (['closed', 'registered'].includes(status)) {
          stats.registered++;
          historyMap[dateKey].registered++;
        }
      }
    });

    res.status(200).json({
      success: true,
      data: {
        user,
        period: period || 'daily',
        startDate,
        stats,
        history: Object.values(historyMap).sort((a, b) => a.date.localeCompare(b.date))
      }
    });

  } catch (error) {
    console.error('Performance Error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};