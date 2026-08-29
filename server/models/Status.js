import { DataTypes } from 'sequelize';
import sequelize from '../config/database.js';

const Status = sequelize.define('Status', {
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true
    },
    label: {
        type: DataTypes.STRING,
        allowNull: false
    },
    value: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    color: {
        type: DataTypes.STRING,
        defaultValue: 'gray' // blue, red, green, etc.
    },
    order: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
}, {
    timestamps: true
});

export default Status;
