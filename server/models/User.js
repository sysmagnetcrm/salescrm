import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';
import bcrypt from 'bcryptjs';

const User = sequelize.define('User', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: true
    }
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.ENUM('admin', 'accountant', 'salesperson'),
    defaultValue: 'salesperson'
  },
  branch: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'kochi'
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  monthlyTarget: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  weeklyTarget: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  }
}, {
  timestamps: true,
  indexes: [
    { fields: ['branch'] },
    { fields: ['role'] },
    { fields: ['isActive'] }
  ],
  hooks: {
    beforeCreate: async (user) => {
      if (user.password) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('password')) {
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(user.password, salt);
      }
    }
  }
});

User.prototype.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

export default User;
