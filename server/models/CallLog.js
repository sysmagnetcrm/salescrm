import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const CallLog = sequelize.define('CallLog', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  leadId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Leads',
      key: 'id'
    }
  },
  matchingStatus: {
    type: DataTypes.ENUM('MATCHED', 'AMBIGUOUS', 'UNMATCHED'),
    defaultValue: 'MATCHED'
  },
  syncStatus: {
    type: DataTypes.ENUM('synced', 'pending'),
    defaultValue: 'synced'
  },
  leadOwnerId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  callerUserId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  callDirection: {
    type: DataTypes.ENUM('outbound', 'inbound'),
    defaultValue: 'outbound'
  },
  callStatus: {
    type: DataTypes.ENUM(
      'initiated',
      'ringing',
      'connected',
      'completed',
      'no-answer',
      'busy',
      'failed',
      'cancelled'
    ),
    allowNull: false,
    defaultValue: 'initiated'
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  ringingAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  connectedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  endedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },

  // Actual Talk Time (endedAt - connectedAt for connected calls; 0 for calls that never connect)
  durationSeconds: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },

  // Full Call Lifecycle Duration (endedAt - startedAt)
  lifecycleDurationSeconds: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },

  // Authoritative Provider Duration (if reported by telephony integration)
  providerDurationSeconds: {
    type: DataTypes.INTEGER,
    allowNull: true
  },

  phoneNumber: {
    type: DataTypes.STRING,
    allowNull: true
  },
  isManualLog: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  recordingUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  recordingStatus: {
    type: DataTypes.ENUM('available', 'unavailable', 'processing', 'ambiguous', 'failed', 'sync_pending'),
    defaultValue: 'processing'
  },
  storageLocation: {
    type: DataTypes.ENUM('local_disk', 'object_storage'),
    defaultValue: 'local_disk'
  },
  fileHash: {
    type: DataTypes.STRING,
    allowNull: true
  },
  retentionStatus: {
    type: DataTypes.ENUM('active', 'archived', 'purged'),
    defaultValue: 'active'
  },
  recordingSource: {
    type: DataTypes.STRING,
    allowNull: true
  },
  recordedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  mimeType: {
    type: DataTypes.STRING,
    allowNull: true
  },
  sizeBytes: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  disposition: {
    type: DataTypes.STRING,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  timestamps: true,
  tableName: 'CallLogs',
  indexes: [
    { fields: ['leadId'] },
    { fields: ['leadOwnerId'] },
    { fields: ['callerUserId'] },
    { fields: ['callStatus'] },
    { fields: ['createdAt'] }
  ]
});

export default CallLog;
