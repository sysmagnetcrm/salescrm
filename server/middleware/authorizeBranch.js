import { Lead, User } from '../models/index.js';

export const ALLOWED_BRANCHES = [];

/**
 * Middleware to sanitize and enforce authorization on query and body parameters.
 * Unified CRM: Does not restrict queries to hardcoded kochi/chennai branches.
 */
export const enforceBranchAccess = (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthenticated' });
    }

    // Admin / Accountant / Salesperson: if explicit branch filter is provided, pass it down as optional filter
    const requestedBranch = (req.query.branch || (req.body && req.body.branch) || '').toString().toLowerCase().trim();
    if (requestedBranch) {
      req.effectiveBranch = requestedBranch;
    } else {
      req.effectiveBranch = null; // null means unified CRM across all organizational data
    }

    next();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * IDOR Resource-level protection for Lead operations (/api/leads/:id)
 * Enforces ownership for salespeople and role-based access for Admin/TL/Accountant.
 */
export const authorizeLeadAccess = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: 'Lead ID is required' });
    }

    const lead = await Lead.findByPk(id);
    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead not found' });
    }

    const userRole = req.user.role;
    const userId = req.user.id;

    if (userRole === 'salesperson') {
      // Salesperson MUST be the assigned owner of the lead
      if (lead.assignedTo !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You do not have permission to access or modify this lead'
        });
      }
    } else {
      // Admin / Accountant / TL: if explicit branch filter is set, check match
      if (req.effectiveBranch && lead.branch && lead.branch.toLowerCase() !== req.effectiveBranch) {
        return res.status(403).json({
          success: false,
          message: `Forbidden: Lead does not belong to branch '${req.effectiveBranch}'`
        });
      }
    }

    req.lead = lead;
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * IDOR Resource-level protection for User/Performance operations (/api/users/:id)
 */
export const authorizeUserAccess = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    if (req.user.role === 'salesperson') {
      // Salesperson can ONLY access their own user performance/profile
      if (id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'Forbidden: You cannot access another user\'s performance data'
        });
      }
    } else {
      // Admin / Accountant: check target user exists
      const targetUser = await User.findByPk(id, { attributes: { exclude: ['password'] } });
      if (!targetUser) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }
      if (req.effectiveBranch && targetUser.branch && targetUser.branch.toLowerCase() !== req.effectiveBranch) {
        return res.status(403).json({
          success: false,
          message: `Forbidden: User does not belong to branch '${req.effectiveBranch}'`
        });
      }
      req.targetUser = targetUser;
    }

    next();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
