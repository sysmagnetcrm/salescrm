import { User } from '../models/index.js';

/**
 * Distributes leads evenly among active salespeople
 * @param {Array} leads - Array of lead objects to distribute
 * @returns {Array} - Array of leads with assignedTo field populated
 */
export const distributeLeads = async (leads, branch = 'kochi') => {
  try {
    // Get all active salespeople for the specific branch
    const salespeople = await User.findAll({
      where: {
        role: 'salesperson',
        isActive: true,
        branch
      },
      attributes: ['id', 'name', 'email']
    });

    if (salespeople.length === 0) {
      // No active salespeople: import leads without assignment but with branch
      return leads.map((lead) => ({ ...lead, assignedTo: null, branch }));
    }

    // Distribute leads evenly in round-robin fashion
    const distributedLeads = leads.map((lead, index) => {
      const salespersonIndex = index % salespeople.length;
      return {
        ...lead,
        assignedTo: salespeople[salespersonIndex].id,
        branch
      };
    });

    return distributedLeads;
  } catch (error) {
    throw error;
  }
};

/**
 * Get distribution summary
 * @param {Array} leads - Array of distributed leads
 * @returns {Object} - Distribution summary
 */
export const getDistributionSummary = async (leads) => {
  const summary = {};

  for (const lead of leads) {
    if (lead.assignedTo) {
      if (!summary[lead.assignedTo]) {
        summary[lead.assignedTo] = 0;
      }
      summary[lead.assignedTo]++;
    }
  }

  return summary;
};
