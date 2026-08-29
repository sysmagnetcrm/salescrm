import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const CallAIAnalysis = sequelize.define('CallAIAnalysis', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  callLogId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
    defaultValue: 'pending'
  },
  summary: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  customerIntent: {
    type: DataTypes.STRING,
    allowNull: true
  },
  interestLevel: {
    type: DataTypes.ENUM('high', 'medium', 'low', 'uninterested'),
    defaultValue: 'medium'
  },
  courseDiscussed: {
    type: DataTypes.STRING,
    allowNull: true
  },
  objections: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  urgency: {
    type: DataTypes.STRING,
    allowNull: true
  },
  sentiment: {
    type: DataTypes.STRING,
    allowNull: true
  },
  suggestedDisposition: {
    type: DataTypes.STRING,
    allowNull: true
  },
  suggestedFollowUpAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  timestamps: true,
  tableName: 'CallAIAnalyses'
});

export default CallAIAnalysis;
