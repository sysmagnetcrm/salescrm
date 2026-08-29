# 🚀 Manual Deployment Steps for Production Server

## Copy-Paste Commands for SSH Session

### STEP 1: Navigate to Project
```bash
cd /root/RMA
pwd  # Verify you're in the right directory
```

---

### STEP 2: Backup Database (CRITICAL!)
```bash
# Create backup directory
mkdir -p /root/backups/crm

# Backup with timestamp
cp server/database.sqlite /root/backups/crm/database_backup_$(date +"%Y%m%d_%H%M%S").sqlite

# Create quick restore point
cp server/database.sqlite server/database.sqlite.pre_branch_update

# Verify backup exists
ls -lh /root/backups/crm/
```

✅ **Expected output:** You should see your backup file listed

---

### STEP 3: Check Current Database State
```bash
# Count current records
sqlite3 server/database.sqlite "SELECT 'Users:', COUNT(*) FROM Users; SELECT 'Leads:', COUNT(*) FROM Leads;"
```

✅ **Write down these numbers** - You'll compare them later

---

### STEP 4: Stop the Server
```bash
pm2 stop crm-backend

# Wait 2 seconds
sleep 2

# Verify it stopped
pm2 status
```

✅ **Expected:** crm-backend should show as "stopped"

---

### STEP 5: Pull Latest Code
```bash
git pull origin main
```

✅ **Expected output:**
```
Updating 5ac3051..1a0e312
Fast-forward
 [list of updated files]
```

---

### STEP 6: Install Dependencies
```bash
cd server
npm install
cd ..
```

---

### STEP 7: Run Database Migration (Add branch column)
```bash
cd server

# Create the migration script if it doesn't exist
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

        // Add branch to Users
        try {
            await sequelize.query("ALTER TABLE Users ADD COLUMN branch TEXT DEFAULT 'kochi'");
            console.log('✅ Added branch to Users');
        } catch (e) {
            if (e.message.includes('duplicate column')) {
                console.log('ℹ️  Branch column already exists in Users');
            }
        }

        // Add branch to Leads
        try {
            await sequelize.query("ALTER TABLE Leads ADD COLUMN branch TEXT DEFAULT 'kochi'");
            console.log('✅ Added branch to Leads');
        } catch (e) {
            if (e.message.includes('duplicate column')) {
                console.log('ℹ️  Branch column already exists in Leads');
            }
        }

    } catch (e) {
        console.error('❌ Error:', e);
    }
};

run();
EOF

# Run the migration
node fix_schema.js
```

✅ **Expected output:**
```
✅ Connected to DB
✅ Added branch to Users
✅ Added branch to Leads
```

---

### STEP 8: Verify Migration
```bash
# Check if branch column exists in Users
sqlite3 database.sqlite "PRAGMA table_info(Users);" | grep branch

# Check if branch column exists in Leads
sqlite3 database.sqlite "PRAGMA table_info(Leads);" | grep branch
```

✅ **Expected:** Should see line with "branch|TEXT" for both tables

---

### STEP 9: Check Data Integrity
```bash
# Count records again (should match Step 3)
sqlite3 database.sqlite "SELECT 'Users:', COUNT(*) FROM Users; SELECT 'Leads:', COUNT(*) FROM Leads;"

# Check branch distribution (all should be 'kochi')
sqlite3 database.sqlite "SELECT branch, COUNT(*) FROM Users GROUP BY branch;"
sqlite3 database.sqlite "SELECT branch, COUNT(*) FROM Leads GROUP BY branch;"
```

✅ **Expected:** Same counts as Step 3, all assigned to 'kochi' branch

---

### STEP 10: Start the Server
```bash
cd /root/RMA/server
pm2 restart crm-backend
```

✅ **Expected:** Server should start without errors

---

### STEP 11: Monitor Logs
```bash
pm2 logs crm-backend --lines 30
```

✅ **Look for:**
- "✅ Database synchronized"
- "✅ Data migration: branches updated to kochi"
- "🚀 Server running on port 5000"
- NO errors about "column branch"

---

### STEP 12: Test API Health
```bash
curl http://localhost:5000/api/health
```

✅ **Expected output:**
```json
{
  "success": true,
  "db": {
    "connected": true
  }
}
```

---

### STEP 13: Test Branch Endpoints
```bash
# Get your auth token first (login via UI or use existing token)
# Then test:

curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5000/api/leads/unassigned?branch=kochi
```

---

## 🎉 DEPLOYMENT COMPLETE!

### Quick Verification Checklist:
- [ ] Database backed up ✓
- [ ] Code updated ✓
- [ ] Migration ran successfully ✓
- [ ] Server started ✓
- [ ] No errors in logs ✓
- [ ] Health check passes ✓

---

## 🔄 IF SOMETHING GOES WRONG - ROLLBACK:

```bash
# Stop server
pm2 stop crm-backend

# Restore database backup
cp server/database.sqlite.pre_branch_update server/database.sqlite

# Revert code
git reset --hard HEAD~2
git pull origin main  # Get the old version back

# Restart server
pm2 restart crm-backend
```

---

## 📱 Test the UI:

1. Open browser: https://crm.rmaoverseas.com
2. Login as admin
3. Check sidebar for **Kochi/Chennai branch switcher**
4. Go to **Upload Leads** page
5. Upload a file
6. See **Unassigned Leads table** appear
7. Select leads and assign manually

---

## 📊 Monitor After Deployment:

```bash
# Watch logs in real-time
pm2 logs crm-backend -f

# Check for errors
pm2 logs crm-backend --err --lines 50

# Monitor server resources
pm2 monit
```

---

**Deployed:** January 2, 2026
**Version:** 2.0.0 (Multi-Branch Support)
**Backup Location:** /root/backups/crm/
