import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import sequelize, { connectDB } from './config/database.js';
import { User, Lead, AppBranding } from './models/index.js';
import bcrypt from 'bcryptjs';
import { runClosedToRegisteredMigration } from './scripts/migrate_closed_to_registered.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import routes
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import leadRoutes from './routes/leadRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import paymentRoutes from './routes/paymentRoutes.js';
import callRoutes from './routes/callRoutes.js';
import systemRoutes from './routes/systemRoutes.js';
import dispositionRoutes from './routes/dispositionRoutes.js';
import { seedDefaultDispositions } from './controllers/dispositionController.js';
import { enforceClientVersion } from './middleware/versionCheck.js';

const app = express();

// Body parser (configured with 10mb limit for bulk lead operations)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Enforce minimum supported client version
app.use(enforceClientVersion);

// Serve uploaded static assets (logos, favicons)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Configure CORS
const configuredOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
  : [];

const defaultAllowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5000',
  'https://crm.rmaoverseas.com'
];

const allowedOrigins = [...new Set([...defaultAllowedOrigins, ...configuredOrigins])];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Create default admin user and demo accounts with safe fallbacks
const createDefaultAdmin = async () => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@rmaoverseas.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Rma.admin@123';

    // 1. Primary Admin Account
    let admin = await User.findOne({ where: { email: adminEmail } });
    if (!admin) {
      await User.create({
        name: 'CRM Admin',
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
        phone: '1234567890',
        branch: 'kochi',
        isActive: true
      });
      console.log(`✅ Default admin user created: ${adminEmail}`);
    } else {
      const passwordMatches = await bcrypt.compare(adminPassword, admin.password);
      if (!passwordMatches) {
        admin.password = adminPassword;
        await admin.save();
        console.log(`🔐 Updated admin password for: ${adminEmail}`);
      }
    }

    // 2. Demo Test Admin Account
    let testAdmin = await User.findOne({ where: { email: 'admin@test.com' } });
    if (!testAdmin) {
      await User.create({
        name: 'Admin User',
        email: 'admin@test.com',
        password: 'Password123!',
        role: 'admin',
        phone: '9000000001',
        branch: 'kochi',
        isActive: true
      });
      console.log(`✅ Demo admin user created: admin@test.com`);
    } else {
      const testMatch = await bcrypt.compare('Password123!', testAdmin.password);
      if (!testMatch) {
        testAdmin.password = 'Password123!';
        await testAdmin.save();
      }
    }

    // 3. Demo Salesperson Account
    let testSales = await User.findOne({ where: { email: 'sales.kochi@test.com' } });
    if (!testSales) {
      await User.create({
        name: 'Kochi Sales BDE',
        email: 'sales.kochi@test.com',
        password: 'Password123!',
        role: 'salesperson',
        phone: '9876543210',
        branch: 'kochi',
        isActive: true
      });
      console.log(`✅ Demo BDE user created: sales.kochi@test.com`);
    } else {
      const match1 = await bcrypt.compare('Password123!', testSales.password);
      const match2 = await bcrypt.compare('password123', testSales.password);
      if (!match1 && !match2) {
        testSales.password = 'Password123!';
        await testSales.save();
      }
    }
  } catch (error) {
    console.error('Error creating default admin:', error);
  }
};

// Seed default branding idempotently
const seedDefaultBranding = async () => {
  try {
    const existing = await AppBranding.findOne();
    if (!existing) {
      await AppBranding.create({ appName: 'CRM Demo' });
      console.log('✅ Default branding initialized: CRM Demo');
    }
  } catch (error) {
    console.error('Error seeding default branding:', error);
  }
};

// Data migration for default branch assignment
const migrateData = async () => {
  try {
    await sequelize.query("UPDATE \"Leads\" SET branch = 'kochi' WHERE branch IS NULL OR branch = ''").catch(async () => {
      await sequelize.query("UPDATE Leads SET branch = 'kochi' WHERE branch IS NULL OR branch = ''");
    });
    await sequelize.query("UPDATE \"Users\" SET branch = 'kochi' WHERE branch IS NULL OR branch = ''").catch(async () => {
      await sequelize.query("UPDATE Users SET branch = 'kochi' WHERE branch IS NULL OR branch = ''");
    });
    console.log('✅ Default branch migration completed');
  } catch (error) {
    console.log('ℹ️ Branch migration skipped or already completed');
  }
};

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/settings/dispositions', dispositionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/system', systemRoutes);

// Health check route
app.get('/api/health', async (req, res) => {
  const startedAt = Date.now();
  let db = { connected: false, dialect: null, error: null };
  try {
    await sequelize.authenticate();
    db.connected = true;
    db.dialect = sequelize.getDialect();
  } catch (err) {
    db.connected = false;
    db.error = err?.message || 'unknown';
    db.dialect = sequelize?.getDialect?.() || null;
  }
  res.status(db.connected ? 200 : 500).json({
    success: db.connected,
    message: 'CRM API is running',
    timestamp: new Date().toISOString(),
    responseTimeMs: Date.now() - startedAt,
    database: db
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Server Error'
  });
});

const PORT = process.env.PORT || 5000;

// Reliable Async Startup Function
async function startServer() {
  try {
    if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET.trim() === '')) {
      console.error('❌ FATAL: JWT_SECRET environment variable must be explicitly configured in production mode!');
      process.exit(1);
    }

    console.log('⏳ Connecting to database...');
    await connectDB();

    console.log('⏳ Initializing seed data and branch migration...');
    await migrateData();
    await createDefaultAdmin();
    await seedDefaultBranding();
    await seedDefaultDispositions();

    console.log('⏳ Checking data audit for "closed" -> "registered" migration...');
    await runClosedToRegisteredMigration();

    app.listen(PORT, () => {
      console.log(`🚀 Server running cleanly on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Server startup failed due to database or initialization error:', error);
    process.exit(1);
  }
}

startServer();
