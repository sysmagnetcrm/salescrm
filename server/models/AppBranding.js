import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const AppBranding = sequelize.define('AppBranding', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  appName: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'CRM Demo'
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: null
  },
  logoUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  faviconUrl: {
    type: DataTypes.STRING,
    allowNull: true
  },
  updatedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  }
}, {
  timestamps: true,
  tableName: 'AppBrandings'
});

export default AppBranding;
