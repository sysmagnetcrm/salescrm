import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// SQLite configuration for quick testing
const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: path.join(__dirname, '../database.sqlite'),
  logging: false
});

export const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ SQLite Database connected successfully');
    await sequelize.sync({ alter: true });
    console.log('✅ Database synchronized');
  } catch (error) {
    console.error('❌ Database connection error:', error);
    process.exit(1);
  }
};

export default sequelize;
