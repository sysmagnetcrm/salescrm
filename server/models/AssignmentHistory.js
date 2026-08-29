import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const AssignmentHistory = sequelize.define('AssignmentHistory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  leadId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Leads',
      key: 'id'
    }
  },
  fromUserId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  toUserId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  assignedBy: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  assignedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  timestamps: true,
  tableName: 'AssignmentHistories'
});

export default AssignmentHistory;
