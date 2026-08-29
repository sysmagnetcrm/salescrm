#!/bin/bash
# 🚀 CRM Deployment Script - Multi-Branch Update
# Run this on production server: bash deploy.sh

set -e  # Exit on any error

echo "=================================================="
echo "🚀 CRM Deployment - Multi-Branch Update"
echo "=================================================="
echo ""

# Configuration
PROJECT_DIR="/root/RMA"
BACKUP_DIR="/root/backups/crm"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

echo "📁 Project Directory: $PROJECT_DIR"
echo "💾 Backup Directory: $BACKUP_DIR"
echo ""

# Step 1: Navigate to project
echo "➡️  Step 1: Navigating to project directory..."
cd $PROJECT_DIR || { echo "❌ Failed to find project directory"; exit 1; }
echo "✅ In project directory: $(pwd)"
echo ""

# Step 2: Backup current database
echo "➡️  Step 2: Backing up production database..."

# Check if database exists
if [ -f "server/database.sqlite" ]; then
    BACKUP_FILE="$BACKUP_DIR/database_backup_$TIMESTAMP.sqlite"
    cp server/database.sqlite $BACKUP_FILE
    echo "✅ Database backed up to: $BACKUP_FILE"
    
    # Also create a quick restore point
    cp server/database.sqlite server/database.sqlite.pre_branch_update
    echo "✅ Quick restore point created: server/database.sqlite.pre_branch_update"
else
    echo "⚠️  Warning: database.sqlite not found, skipping backup"
fi
echo ""

# Step 3: Check current database record counts
echo "➡️  Step 3: Recording current database state..."
if [ -f "server/database.sqlite" ]; then
    echo "📊 Current database statistics:"
    sqlite3 server/database.sqlite "SELECT 'Users:', COUNT(*) FROM Users; SELECT 'Leads:', COUNT(*) FROM Leads;"
else
    echo "⚠️  Database file not found"
fi
echo ""

# Step 4: Stop the server
echo "➡️  Step 4: Stopping server..."
pm2 stop crm-backend || echo "⚠️  Server not running or PM2 not found"
sleep 2
echo "✅ Server stopped"
echo ""

# Step 5: Pull latest code
echo "➡️  Step 5: Pulling latest code from GitHub..."
git fetch origin
git pull origin main
echo "✅ Code updated"
echo ""

# Step 6: Install/update dependencies
echo "➡️  Step 6: Installing dependencies..."
cd server
npm install --production
cd ..
echo "✅ Dependencies installed"
echo ""

# Step 7: Run database schema migration
echo "➡️  Step 7: Running database schema migration..."
cd server

# Check if fix_schema.js exists
if [ ! -f "fix_schema.js" ]; then
    echo "⚠️  Creating fix_schema.js..."
    cat > fix_schema.js << 'EOF'
import { Sequelize } from 'sequelize';

const sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: './database.sqlite',
    logging: false
});

const run = async () => {
    try {
        await sequelize.authenticate();
        console.log('✅ Connected to DB');

        // Add branch column to Users
        try {
            await sequelize.query("ALTER TABLE Users ADD COLUMN branch TEXT DEFAULT 'kochi'");
            console.log('✅ Added branch to Users');
        } catch (e) {
            if (e.message.includes('duplicate column')) {
                console.log('ℹ️  Branch column already exists in Users');
            } else {
                console.log('⚠️  Error adding branch to Users:', e.message);
            }
        }

        // Add branch column to Leads
        try {
            await sequelize.query("ALTER TABLE Leads ADD COLUMN branch TEXT DEFAULT 'kochi'");
            console.log('✅ Added branch to Leads');
        } catch (e) {
            if (e.message.includes('duplicate column')) {
                console.log('ℹ️  Branch column already exists in Leads');
            } else {
                console.log('⚠️  Error adding branch to Leads:', e.message);
            }
        }

    } catch (e) {
        console.error('❌ Fatal:', e);
        process.exit(1);
    }
};

run();
EOF
fi

# Run the migration
node fix_schema.js
echo "✅ Schema migration completed"
cd ..
echo ""

# Step 8: Verify database after migration
echo "➡️  Step 8: Verifying database after migration..."
sqlite3 server/database.sqlite "PRAGMA table_info(Users);" | grep branch && echo "✅ Users.branch column exists" || echo "❌ Users.branch column missing"
sqlite3 server/database.sqlite "PRAGMA table_info(Leads);" | grep branch && echo "✅ Leads.branch column exists" || echo "❌ Leads.branch column missing"
echo ""

# Step 9: Check record counts after migration
echo "➡️  Step 9: Checking data integrity..."
echo "📊 Database statistics after migration:"
sqlite3 server/database.sqlite "SELECT 'Users:', COUNT(*) FROM Users; SELECT 'Leads:', COUNT(*) FROM Leads;"
echo "📊 Branch distribution:"
sqlite3 server/database.sqlite "SELECT 'Users by branch:', branch, COUNT(*) FROM Users GROUP BY branch;"
sqlite3 server/database.sqlite "SELECT 'Leads by branch:', branch, COUNT(*) FROM Leads GROUP BY branch;"
echo ""

# Step 10: Start the server
echo "➡️  Step 10: Starting server..."
cd server
pm2 start ecosystem.config.js --env production || pm2 start npm --name "crm-backend" -- start
sleep 3
echo "✅ Server started"
echo ""

# Step 11: Check server status
echo "➡️  Step 11: Checking server status..."
pm2 status crm-backend
echo ""

# Step 12: Show recent logs
echo "➡️  Step 12: Recent server logs..."
pm2 logs crm-backend --lines 20 --nostream
echo ""

# Step 13: Health check
echo "➡️  Step 13: Testing API health..."
sleep 2
curl -s http://localhost:5000/api/health | jq '.' || echo "⚠️  Health check failed or jq not installed"
echo ""

echo "=================================================="
echo "✅ DEPLOYMENT COMPLETED SUCCESSFULLY!"
echo "=================================================="
echo ""
echo "📋 Summary:"
echo "  - Database backed up to: $BACKUP_DIR/database_backup_$TIMESTAMP.sqlite"
echo "  - Schema updated: branch column added to Users and Leads"
echo "  - Server restarted and running"
echo ""
echo "📝 Next Steps:"
echo "  1. Test the application: https://crm.rmaoverseas.com"
echo "  2. Login as admin and verify branch switcher appears"
echo "  3. Test uploading leads and manual assignment"
echo "  4. Monitor logs: pm2 logs crm-backend"
echo ""
echo "🔄 To rollback if needed:"
echo "  cp server/database.sqlite.pre_branch_update server/database.sqlite"
echo "  git reset --hard HEAD~1"
echo "  pm2 restart crm-backend"
echo ""
echo "=================================================="
