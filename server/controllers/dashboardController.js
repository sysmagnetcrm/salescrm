import { Lead, User, Activity, CallLog } from '../models/index.js';
import { Op } from 'sequelize';
import sequelize from '../config/database.js';
import { getStartOfWeek, getStartOfMonth } from '../utils/dateUtils.js';
import { LEAD_STATUS } from '../utils/statusConstants.js';

// @desc    Get admin dashboard stats
// @route   GET /api/dashboard/admin
// @access  Private/Admin
export const getAdminDashboard = async (req, res) => {
  try {
    const effectiveBranch = req.effectiveBranch || (req.query.branch ? req.query.branch.toLowerCase() : null);

    const startOfMonth = getStartOfMonth();

    // Build where clauses
    const leadWhere = {};
    if (effectiveBranch) leadWhere.branch = effectiveBranch;

    const userWhere = { role: 'salesperson', isActive: true };
    if (effectiveBranch) userWhere.branch = effectiveBranch;

    // Total leads
    const totalLeads = await Lead.count({ where: leadWhere });

    // Leads this month
    const leadsThisMonth = await Lead.count({
      where: {
        ...leadWhere,
        createdAt: { [Op.gte]: startOfMonth }
      }
    });

    // Total revenue this month (where status is registered)
    const monthlyRevenueSum = await Lead.sum('value', {
      where: {
        ...leadWhere,
        status: { [Op.in]: [LEAD_STATUS.REGISTERED, 'closed'] },
        closedAt: { [Op.gte]: startOfMonth }
      }
    });

    // Leads by status
    const leadsByStatus = await Lead.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      where: leadWhere,
      group: ['status'],
      raw: true
    });

    // Follow-ups count
    const followUpsCount = await Lead.count({
      where: {
        ...leadWhere,
        status: LEAD_STATUS.FOLLOW_UP
      }
    });

    // Pending leads (fresh + follow-up)
    const pendingLeads = await Lead.count({
      where: {
        ...leadWhere,
        status: { [Op.in]: [LEAD_STATUS.FRESH, LEAD_STATUS.FOLLOW_UP] }
      }
    });

    // Registered (closed) leads count this month
    const closedLeads = await Lead.count({
      where: {
        ...leadWhere,
        status: { [Op.in]: [LEAD_STATUS.REGISTERED, 'closed'] },
        closedAt: { [Op.gte]: startOfMonth }
      }
    });

    // Top performers this month (fetching active salespeople and computing conversion metrics cleanly)
    const salespeople = await User.findAll({
      where: userWhere,
      attributes: ['id', 'name', 'email', 'monthlyTarget']
    });

    const topPerformers = [];
    const targetsRaw = [];

    for (const sp of salespeople) {
      const spTotalLeads = await Lead.count({
        where: { assignedTo: sp.id, createdAt: { [Op.gte]: startOfMonth } }
      });

      const spClosedLeads = await Lead.count({
        where: { assignedTo: sp.id, status: { [Op.in]: [LEAD_STATUS.REGISTERED, 'closed'] }, closedAt: { [Op.gte]: startOfMonth } }
      });

      const spRevenueSum = await Lead.sum('value', {
        where: { assignedTo: sp.id, status: { [Op.in]: [LEAD_STATUS.REGISTERED, 'closed'] }, closedAt: { [Op.gte]: startOfMonth } }
      });

      const spRevenue = parseFloat(spRevenueSum || 0);

      topPerformers.push({
        id: sp.id,
        name: sp.name,
        email: sp.email,
        totalLeads: spTotalLeads,
        closedLeads: spClosedLeads,
        registeredLeads: spClosedLeads,
        revenue: spRevenue.toFixed(2)
      });

      targetsRaw.push({
        id: sp.id,
        name: sp.name,
        conversions: spClosedLeads,
        target: parseInt(sp.monthlyTarget || 0)
      });
    }

    // Sort top performers by registered leads and revenue
    topPerformers.sort((a, b) => b.closedLeads - a.closedLeads || parseFloat(b.revenue) - parseFloat(a.revenue));
    targetsRaw.sort((a, b) => b.conversions - a.conversions);

    // Recent activities
    const recentActivities = await Activity.findAll({
      limit: 10,
      order: [['createdAt', 'DESC']],
      include: [
        { model: User, as: 'user', attributes: ['id', 'name'] },
        { model: Lead, as: 'lead', attributes: ['id', 'name'] }
      ]
    });

    const conversionRate = leadsThisMonth > 0
      ? ((closedLeads / leadsThisMonth) * 100).toFixed(2)
      : 0;

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalLeads,
          leadsThisMonth,
          followUpsCount,
          pendingLeads,
          monthlyRevenue: parseFloat(monthlyRevenueSum || 0).toFixed(2),
          conversionRate
        },
        leadsByStatus: leadsByStatus.map(item => ({
          status: item.status,
          count: parseInt(item.count)
        })),
        topPerformers: topPerformers.slice(0, 5),
        targets: targetsRaw,
        recentActivities
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get salesperson dashboard stats
// @route   GET /api/dashboard/salesperson
// @access  Private/Salesperson
export const getSalespersonDashboard = async (req, res) => {
  try {
    const userId = req.user.id;
    const startOfMonth = getStartOfMonth();
    const startOfWeek = getStartOfWeek();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // My leads count
    const myLeadsCount = await Lead.count({
      where: { assignedTo: userId }
    });

    // Leads by status
    const leadsByStatus = await Lead.findAll({
      where: { assignedTo: userId },
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['status'],
      raw: true
    });

    // Monthly stats
    const monthlyTotalLeads = await Lead.count({
      where: { assignedTo: userId, createdAt: { [Op.gte]: startOfMonth } }
    });
    const monthlyClosedLeads = await Lead.count({
      where: { assignedTo: userId, status: { [Op.in]: [LEAD_STATUS.REGISTERED, 'closed'] }, closedAt: { [Op.gte]: startOfMonth } }
    });
    const monthlyRevenueSum = await Lead.sum('value', {
      where: { assignedTo: userId, status: { [Op.in]: [LEAD_STATUS.REGISTERED, 'closed'] }, closedAt: { [Op.gte]: startOfMonth } }
    });

    // Weekly stats
    const weeklyTotalLeads = await Lead.count({
      where: { assignedTo: userId, createdAt: { [Op.gte]: startOfWeek } }
    });
    const weeklyClosedLeads = await Lead.count({
      where: { assignedTo: userId, status: { [Op.in]: [LEAD_STATUS.REGISTERED, 'closed'] }, closedAt: { [Op.gte]: startOfWeek } }
    });
    const weeklyRevenueSum = await Lead.sum('value', {
      where: { assignedTo: userId, status: { [Op.in]: [LEAD_STATUS.REGISTERED, 'closed'] }, closedAt: { [Op.gte]: startOfWeek } }
    });

    // Get user targets
    const user = await User.findByPk(userId, {
      attributes: ['monthlyTarget', 'weeklyTarget']
    });

    // Real Telephony Call Metrics from DB CallLog table
    const callsTodayCount = await CallLog.count({
      where: {
        [Op.or]: [{ callerUserId: userId }, { leadOwnerId: userId }],
        createdAt: { [Op.gte]: startOfToday }
      }
    });

    const connectedTodayCount = await CallLog.count({
      where: {
        [Op.or]: [{ callerUserId: userId }, { leadOwnerId: userId }],
        callStatus: 'completed',
        createdAt: { [Op.gte]: startOfToday }
      }
    });

    const noAnswerTodayCount = await CallLog.count({
      where: {
        [Op.or]: [{ callerUserId: userId }, { leadOwnerId: userId }],
        callStatus: 'no-answer',
        createdAt: { [Op.gte]: startOfToday }
      }
    });

    const busyTodayCount = await CallLog.count({
      where: {
        [Op.or]: [{ callerUserId: userId }, { leadOwnerId: userId }],
        callStatus: 'busy',
        createdAt: { [Op.gte]: startOfToday }
      }
    });

    const totalTalkTimeSum = await CallLog.sum('durationSeconds', {
      where: {
        [Op.or]: [{ callerUserId: userId }, { leadOwnerId: userId }],
        callStatus: 'completed',
        createdAt: { [Op.gte]: startOfToday }
      }
    });

    const totalTalkTimeSeconds = parseInt(totalTalkTimeSum || 0);
    const avgTalkTimeSeconds = connectedTodayCount > 0 ? Math.round(totalTalkTimeSeconds / connectedTodayCount) : 0;
    const connectionRatePercent = callsTodayCount > 0 ? parseFloat(((connectedTodayCount / callsTodayCount) * 100).toFixed(1)) : 0;

    // Recent calls (last 7 days from CallLog)
    const recentCallsLogs = await CallLog.findAll({
      where: {
        [Op.or]: [{ callerUserId: userId }, { leadOwnerId: userId }],
        createdAt: { [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
      },
      include: [
        { model: Lead, as: 'lead', attributes: ['id', 'name', 'phone'] }
      ],
      order: [['createdAt', 'DESC']],
      limit: 10
    });

    // Recent activities
    const recentActivities = await Activity.findAll({
      where: { userId },
      limit: 10,
      order: [['createdAt', 'DESC']],
      include: [{ model: Lead, as: 'lead', attributes: ['id', 'name'] }]
    });

    const getStatusCount = (st) => {
      const found = leadsByStatus.find(s => s.status === st);
      return found ? parseInt(found.count) : 0;
    };

    const registeredCount = getStatusCount(LEAD_STATUS.REGISTERED) + getStatusCount('closed');

    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalLeads: myLeadsCount,
          freshLeads: getStatusCount(LEAD_STATUS.FRESH),
          followUpLeads: getStatusCount(LEAD_STATUS.FOLLOW_UP),
          rnrLeads: getStatusCount(LEAD_STATUS.RNR),
          closedLeads: registeredCount,
          registeredLeads: registeredCount,
          deadLeads: getStatusCount(LEAD_STATUS.DEAD)
        },
        callMetrics: {
          callsToday: callsTodayCount,
          connectedCalls: connectedTodayCount,
          noAnswerCalls: noAnswerTodayCount,
          busyCalls: busyTodayCount,
          totalTalkTimeSeconds,
          avgTalkTimeSeconds,
          connectionRatePercent
        },
        monthly: {
          totalLeads: monthlyTotalLeads,
          closedLeads: monthlyClosedLeads,
          registeredLeads: monthlyClosedLeads,
          revenue: parseFloat(monthlyRevenueSum || 0).toFixed(2),
          target: parseInt(user?.monthlyTarget || 0),
          achievement: parseFloat(user?.monthlyTarget || 0) > 0
            ? ((monthlyClosedLeads / parseFloat(user.monthlyTarget)) * 100).toFixed(2)
            : 0
        },
        weekly: {
          totalLeads: weeklyTotalLeads,
          closedLeads: weeklyClosedLeads,
          registeredLeads: weeklyClosedLeads,
          revenue: parseFloat(weeklyRevenueSum || 0).toFixed(2),
          target: parseInt(user?.weeklyTarget || 0),
          achievement: parseFloat(user?.weeklyTarget || 0) > 0
            ? ((weeklyClosedLeads / parseFloat(user.weeklyTarget)) * 100).toFixed(2)
            : 0
        },
        recentCalls: recentCallsLogs.map(c => ({
          id: c.id,
          createdAt: c.createdAt,
          duration: c.durationSeconds,
          lifecycleDuration: c.lifecycleDurationSeconds,
          outcome: c.disposition || c.callStatus,
          Lead: c.lead ? { name: c.lead.name, phone: c.lead.phone } : null
        })),
        recentActivities
      }
    });
  } catch (error) {
    console.error('Salesperson dashboard error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get leaderboard
// @route   GET /api/dashboard/leaderboard
// @access  Private
export const getLeaderboard = async (req, res) => {
  try {
    const { period = 'month', branch } = req.query;
    const effectiveBranch = req.effectiveBranch || (branch ? branch.toLowerCase() : null);

    const startDate = period === 'week' ? getStartOfWeek() : getStartOfMonth();

    const userWhere = { role: 'salesperson', isActive: true };
    if (effectiveBranch) userWhere.branch = effectiveBranch;

    const salespeople = await User.findAll({
      where: userWhere,
      attributes: ['id', 'name', 'email']
    });

    const leaderboardData = [];

    for (const sp of salespeople) {
      const totalLeads = await Lead.count({
        where: { assignedTo: sp.id, createdAt: { [Op.gte]: startDate } }
      });

      const registeredLeads = await Lead.count({
        where: { assignedTo: sp.id, status: { [Op.in]: [LEAD_STATUS.REGISTERED, 'closed'] }, closedAt: { [Op.gte]: startDate } }
      });

      const revenueSum = await Lead.sum('value', {
        where: { assignedTo: sp.id, status: { [Op.in]: [LEAD_STATUS.REGISTERED, 'closed'] }, closedAt: { [Op.gte]: startDate } }
      });

      const revenue = parseFloat(revenueSum || 0);
      const conversionRate = totalLeads > 0 ? ((registeredLeads / totalLeads) * 100).toFixed(2) : 0;

      leaderboardData.push({
        id: sp.id,
        name: sp.name,
        email: sp.email,
        totalLeads,
        closedLeads: registeredLeads,
        registeredLeads,
        revenue: revenue.toFixed(2),
        conversionRate
      });
    }

    // Sort by revenue descending
    leaderboardData.sort((a, b) => parseFloat(b.revenue) - parseFloat(a.revenue) || b.closedLeads - a.closedLeads);

    const formattedLeaderboard = leaderboardData.map((item, index) => ({
      rank: index + 1,
      ...item,
      isStarPerformer: index === 0 && parseFloat(item.revenue) > 0
    }));

    res.status(200).json({
      success: true,
      period,
      data: formattedLeaderboard
    });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// @desc    Get status counts for a time period
// @route   GET /api/dashboard/status-counts
// @access  Private/Admin
export const getStatusCounts = async (req, res) => {
  try {
    let { period = 'daily', branch } = req.query;
    const p = String(period || '').toLowerCase();
    const effectiveBranch = req.effectiveBranch || (branch ? branch.toLowerCase() : null);

    let startDate = null;

    if (p === 'daily' || p === 'day' || p === 'today') {
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
    } else if (p === 'weekly' || p === 'week') {
      startDate = getStartOfWeek();
    } else if (p === 'monthly' || p === 'month') {
      startDate = getStartOfMonth();
    } else if (p === 'yearly' || p === 'year') {
      startDate = new Date(new Date().getFullYear(), 0, 1);
    }

    const where = {};
    if (startDate) {
      where.createdAt = { [Op.gte]: startDate };
    }
    if (effectiveBranch) {
      where.branch = effectiveBranch;
    }

    const total = await Lead.count({ where });

    const breakdown = await Lead.findAll({
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('status')), 'count']],
      where,
      group: ['status'],
      raw: true
    });

    const statusCounts = {
      all: total,
      fresh: 0,
      'follow-up': 0,
      rnr: 0,
      registered: 0,
      closed: 0,
      dead: 0,
      cancelled: 0,
      rejected: 0,
      interested: 0
    };

    for (const row of breakdown) {
      const st = row.status;
      const count = Number(row.count || 0);
      if (st === 'closed' || st === 'registered') {
        statusCounts.registered += count;
        statusCounts.closed += count;
      } else if (st in statusCounts) {
        statusCounts[st] += count;
      }
    }

    res.status(200).json({
      success: true,
      period: p,
      statusCounts
    });
  } catch (error) {
    console.error('Status counts error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
