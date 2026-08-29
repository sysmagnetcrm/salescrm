import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const CallTranscript = sequelize.define('CallTranscript', {
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
  rawTranscript: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  formattedTranscript: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  language: {
    type: DataTypes.STRING,
    defaultValue: 'en'
  },
  confidenceScore: {
    type: DataTypes.FLOAT,
    defaultValue: 0.95
  }
}, {
  timestamps: true,
  tableName: 'CallTranscripts'
});

export default CallTranscript;
