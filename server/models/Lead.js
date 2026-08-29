import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Lead = sequelize.define('Lead', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isEmail: true
    }
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false
  },
  country: {
    type: DataTypes.STRING,
    allowNull: false
  },
  product: {
    type: DataTypes.STRING,
    allowNull: true
  },
  source: {
    type: DataTypes.STRING,
    allowNull: true
  },
  campus: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Kochi'
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'fresh'
  },
  priority: {
    type: DataTypes.ENUM('low', 'medium', 'high'),
    defaultValue: 'medium'
  },
  value: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  assignedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  nextFollowUpAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  lastContactedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  lastDispositionAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  disposition: {
    type: DataTypes.STRING,
    allowNull: true
  },
  lastCalled: {
    type: DataTypes.DATE,
    allowNull: true
  },
  assignedTo: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  closedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // Academy Fee & Batch Allocation Lifecycle
  admissionFeeStatus: {
    type: DataTypes.ENUM('pending', 'cleared'),
    defaultValue: 'pending'
  },
  admissionFeeAmount: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00
  },
  orientationFeeStatus: {
    type: DataTypes.ENUM('pending', 'partial', 'cleared'),
    defaultValue: 'pending'
  },
  orientationFeeAmount: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00
  },
  totalClearedPayment: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00
  },
  batchAllocationEligible: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  batchAllocatedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  // Duplicate Management
  isDuplicate: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  duplicateOfLeadId: {
    type: DataTypes.UUID,
    allowNull: true
  },
  conversionRate: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0
  },
  branch: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'kochi'
  }
}, {
  timestamps: true,
  indexes: [
    { fields: ['branch'] },
    { fields: ['status'] },
    { fields: ['assignedTo'] },
    { fields: ['assignedAt'] },
    { fields: ['nextFollowUpAt'] },
    { fields: ['phone'] },
    { fields: ['email'] },
    { fields: ['createdAt'] },
    { fields: ['closedAt'] },
    { fields: ['country'] },
    { fields: ['product'] },
    { fields: ['campus'] },
    { fields: ['source'] },
    { fields: ['isDuplicate'] },
    { fields: ['totalClearedPayment'] }
  ]
});

export default Lead;
