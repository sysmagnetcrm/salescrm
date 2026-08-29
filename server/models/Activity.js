import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Activity = sequelize.define('Activity', {
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
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  type: {
    type: DataTypes.ENUM('call', 'email', 'meeting', 'note', 'status_change'),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  oldStatus: {
    type: DataTypes.STRING,
    allowNull: true
  },
  newStatus: {
    type: DataTypes.STRING,
    allowNull: true
  },
  oldCountry: {
    type: DataTypes.STRING,
    allowNull: true
  },
  newCountry: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  timestamps: true,
  indexes: [
    { fields: ['leadId'] },
    { fields: ['userId'] },
    { fields: ['createdAt'] }
  ]
});

export default Activity;

