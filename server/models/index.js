import User from './User.js';
import Lead from './Lead.js';
import Activity from './Activity.js';
import Country from './Country.js';
import Product from './Product.js';
import Status from './Status.js';
import AppBranding from './AppBranding.js';
import AssignmentHistory from './AssignmentHistory.js';
import Payment from './Payment.js';
import CallLog from './CallLog.js';

import DispositionSettings from './DispositionSettings.js';
import CallTranscript from './CallTranscript.js';
import CallAIAnalysis from './CallAIAnalysis.js';

// Define associations
User.hasMany(Lead, { foreignKey: 'assignedTo', as: 'leads' });
Lead.belongsTo(User, { foreignKey: 'assignedTo', as: 'salesperson' });

User.hasMany(Activity, { foreignKey: 'userId', as: 'activities' });
Activity.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Lead.hasMany(Activity, { foreignKey: 'leadId', as: 'activities', onDelete: 'CASCADE' });
Activity.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });

Lead.hasMany(AssignmentHistory, { foreignKey: 'leadId', as: 'assignmentHistories', onDelete: 'CASCADE' });
AssignmentHistory.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
AssignmentHistory.belongsTo(User, { foreignKey: 'fromUserId', as: 'fromUser' });
AssignmentHistory.belongsTo(User, { foreignKey: 'toUserId', as: 'toUser' });
AssignmentHistory.belongsTo(User, { foreignKey: 'assignedBy', as: 'assigner' });

AppBranding.belongsTo(User, { foreignKey: 'updatedBy', as: 'updater' });

// Payment Associations
Lead.hasMany(Payment, { foreignKey: 'leadId', as: 'payments', onDelete: 'CASCADE' });
Payment.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
Payment.belongsTo(User, { foreignKey: 'recordedBy', as: 'recorder' });

// CallLog Associations
Lead.hasMany(CallLog, { foreignKey: 'leadId', as: 'callLogs', onDelete: 'CASCADE' });
CallLog.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
CallLog.belongsTo(User, { foreignKey: 'leadOwnerId', as: 'leadOwner' });
CallLog.belongsTo(User, { foreignKey: 'callerUserId', as: 'caller' });

CallLog.hasOne(CallTranscript, { foreignKey: 'callLogId', as: 'transcript', onDelete: 'CASCADE' });
CallTranscript.belongsTo(CallLog, { foreignKey: 'callLogId', as: 'callLog' });

CallLog.hasOne(CallAIAnalysis, { foreignKey: 'callLogId', as: 'aiAnalysis', onDelete: 'CASCADE' });
CallAIAnalysis.belongsTo(CallLog, { foreignKey: 'callLogId', as: 'callLog' });

export {
  User,
  Lead,
  Activity,
  Country,
  Product,
  Status,
  AssignmentHistory,
  AppBranding,
  Payment,
  CallLog,
  DispositionSettings,
  CallTranscript,
  CallAIAnalysis
};
