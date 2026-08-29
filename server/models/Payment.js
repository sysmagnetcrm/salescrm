import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Payment = sequelize.define('Payment', {
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
  paymentType: {
    type: DataTypes.ENUM('admission', 'orientation', 'other'),
    allowNull: false
  },
  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  paymentDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  paymentStatus: {
    type: DataTypes.ENUM('cleared', 'pending', 'rejected'),
    defaultValue: 'cleared'
  },
  referenceId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  recordedBy: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'Users',
      key: 'id'
    }
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  timestamps: true,
  tableName: 'Payments',
  indexes: [
    { fields: ['leadId'] },
    { fields: ['recordedBy'] },
    { fields: ['paymentType'] },
    { fields: ['paymentStatus'] },
    { fields: ['paymentDate'] }
  ]
});

export default Payment;
