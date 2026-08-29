import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import dns from 'dns';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';

// Render / Supabase provide a single DATABASE_URL connection string.
// Individual DB_* vars are used as fallback for local postgres dev.
const DATABASE_URL = process.env.DATABASE_URL;
const usePostgres = isProduction || process.env.DB_DIALECT === 'postgres' || !!DATABASE_URL;

// Force IPv4 DNS resolution — Render free tier has no IPv6 outbound.
// This custom lookup is injected directly into pg so it always picks
// an IPv4 address even when the hostname also has an AAAA (IPv6) record.
const ipv4Lookup = (hostname, _options, callback) => {
  dns.resolve4(hostname, (err, addresses) => {
    if (err) return callback(err);
    callback(null, addresses[0], 4);
  });
};

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
        },
        lookup: ipv4Lookup  // Force IPv4 — prevents ENETUNREACH on Render free tier
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
    console.log('✅ Database synchronized');
  } catch (error) {
    console.error('❌ Database connection error:', error);
    process.exit(1);
  }
};

export default sequelize;
