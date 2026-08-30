import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

// Render / Supabase provide a single DATABASE_URL connection string.
// Individual DB_* vars are used as fallback for local postgres dev.
const DATABASE_URL = process.env.DATABASE_URL;
const usePostgres = isProduction || process.env.DB_DIALECT === 'postgres' || !!DATABASE_URL;

let sequelize;

if (usePostgres) {
  if (DATABASE_URL) {
    // Production: use the full connection string (Render + Supabase)
    sequelize = new Sequelize(DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false  // Required for Supabase / Render managed TLS
        }
      },
      pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    });
  } else {
    // Fallback: individual DB_* env vars (local postgres dev)
    sequelize = new Sequelize(
      process.env.DB_NAME || 'crm',
      process.env.DB_USER || 'postgres',
      process.env.DB_PASSWORD || 'postgres',
      {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        dialect: 'postgres',
        logging: false,
        dialectOptions: process.env.DB_SSL === 'true' ? {
          ssl: {
            require: true,
            rejectUnauthorized: false
          }
        } : {},
        pool: {
          max: 10,
          min: 0,
          acquire: 30000,
          idle: 10000
        }
      }
    );
  }
} else {
  // Local development: SQLite (zero-config)
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './database.sqlite',
    logging: false
  });
}

export const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected successfully');
    await sequelize.sync();
    // Safely ensure location column exists on AppBrandings table
    try {
      await sequelize.query("ALTER TABLE AppBrandings ADD COLUMN location VARCHAR(255);");
      console.log('✅ Added location column to AppBrandings');
    } catch (e) {
      // Ignore — column already exists
    }
    // Safely add referenceName and referenceNumber columns to Leads table
    try {
      await sequelize.query("ALTER TABLE \"Leads\" ADD COLUMN \"referenceName\" VARCHAR(255);");
      console.log('✅ Added referenceName column to Leads');
    } catch (e) {
      // Ignore — column already exists
    }
    try {
      await sequelize.query("ALTER TABLE \"Leads\" ADD COLUMN \"referenceNumber\" VARCHAR(255);");
      console.log('✅ Added referenceNumber column to Leads');
    } catch (e) {
      // Ignore — column already exists
    }
    // Safely add newer CallLogs columns that may not exist in older production DB instances
    const callLogMigrations = [
      `ALTER TABLE "CallLogs" ADD COLUMN "callerUserId" UUID`,
      `ALTER TABLE "CallLogs" ADD COLUMN "syncStatus" VARCHAR(255) DEFAULT 'synced'`,
      `ALTER TABLE "CallLogs" ADD COLUMN "recordingStatus" VARCHAR(255) DEFAULT 'processing'`,
      `ALTER TABLE "CallLogs" ADD COLUMN "lifecycleDurationSeconds" INTEGER DEFAULT 0`,
      `ALTER TABLE "CallLogs" ADD COLUMN "providerDurationSeconds" INTEGER`,
      `ALTER TABLE "CallLogs" ADD COLUMN "disposition" VARCHAR(255)`,
      `ALTER TABLE "CallLogs" ADD COLUMN "notes" TEXT`,
      `ALTER TABLE "CallLogs" ADD COLUMN "storageLocation" VARCHAR(255) DEFAULT 'local_disk'`,
      `ALTER TABLE "CallLogs" ADD COLUMN "fileHash" VARCHAR(255)`,
      `ALTER TABLE "CallLogs" ADD COLUMN "retentionStatus" VARCHAR(255) DEFAULT 'active'`,
      `ALTER TABLE "CallLogs" ADD COLUMN "recordingSource" VARCHAR(255)`,
      `ALTER TABLE "CallLogs" ADD COLUMN "recordedAt" TIMESTAMP WITH TIME ZONE`,
      `ALTER TABLE "CallLogs" ADD COLUMN "mimeType" VARCHAR(255)`,
      `ALTER TABLE "CallLogs" ADD COLUMN "sizeBytes" INTEGER`,
      `ALTER TABLE "CallLogs" ADD COLUMN "matchingStatus" VARCHAR(255) DEFAULT 'MATCHED'`
    ];
    for (const sql of callLogMigrations) {
      try { await sequelize.query(sql); } catch (e) { /* column already exists — ignore */ }
    }
    try {
      await sequelize.query("UPDATE \"Users\" SET branch = 'kochi' WHERE branch = 'main';");
    } catch (e) {
      // Ignore
    }
    console.log('✅ Database synchronized');
  } catch (error) {
    console.error('❌ Database connection error:', error);
    process.exit(1);
  }
};

export default sequelize;
