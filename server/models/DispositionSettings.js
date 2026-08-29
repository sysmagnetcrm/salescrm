import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const DispositionSettings = sequelize.define('DispositionSettings', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  label: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  category: {
    type: DataTypes.ENUM('connected', 'no_answer', 'busy', 'callback', 'not_interested', 'registered', 'duplicate', 'other'),
    defaultValue: 'connected'
  },
  requiresFollowUp: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  displayOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  timestamps: true,
  tableName: 'DispositionSettings'
});

export default DispositionSettings;
