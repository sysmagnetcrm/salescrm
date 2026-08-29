# 📦 Deployment Guide - CRM Multi-Branch Update

## 🎯 Quick Deploy

### Step 1: Commit Changes
```bash
# Navigate to project root
cd d:\POPEYE\1\rma\rma

# Check status
git status

# Add all changes
git add .

# Commit with descriptive message
git commit -m "feat: Add multi-branch support and manual lead distribution

- Add complete data isolation for Kochi and Chennai branches
- Implement branch switcher UI for admins
- Replace auto-distribution with manual assignment interface
- Add unassigned leads table with bulk selection (10/All)
- Fix SQLite compatibility issues (ENUM to STRING)
- Update all controllers to support branch filtering
- Add new endpoint for unassigned leads
- Migrate existing data to default 'kochi' branch"
```

### Step 2: Push to Remote
```bash
# Push to main branch
git push origin main

# OR if you're on a different branch
git push origin <branch-name>

# If this is first push or upstream not set
git push -u origin main
```

---

## 🔧 Pre-Deployment Checklist

### Local Testing
- [ ] Both dev servers running (client & server)
- [ ] Upload leads feature works
- [ ] Branch switching works
- [ ] Manual assignment works
- [ ] No console errors
- [ ] Database schema updated

### Code Review
- [ ] All files saved
- [ ] No commented debug code
- [ ] Environment variables configured
- [ ] No hardcoded credentials

---

## 🚀 Production Deployment

### Option 1: Manual Deployment (VPS/Server)

#### On Server:
```bash
# SSH into your server
ssh user@your-server.com

# Navigate to project directory
cd /path/to/crm

# Pull latest changes
git pull origin main

# Install/update dependencies
cd server
npm install
cd ../client
npm install

# Build client for production
npm run build

# Restart backend (using PM2)
cd ../server
pm2 restart crm-backend

# OR using systemd
sudo systemctl restart crm-backend
```

#### Database Migration:
```bash
# On server, run schema fix once
cd server
node fix_schema.js

# Verify migration
node check_schema.js

# Server will auto-migrate data on next start
```

---

### Option 2: Vercel/Netlify (Frontend) + Railway/Render (Backend)

#### Frontend (Vercel):
```bash
# Vercel will auto-deploy on git push if connected
# OR manually:
cd client
vercel --prod
```

#### Backend (Railway/Render):
```bash
# Railway/Render will auto-deploy on git push
# Ensure environment variables are set:
# - DATABASE_URL (if using PostgreSQL)
# - JWT_SECRET
# - NODE_ENV=production

# For Railway CLI:
railway up

# For Render:
# Push to git and it deploys automatically
```

---

### Option 3: Docker Deployment

#### Build Docker Images:
```bash
# Build backend
docker build -t crm-backend:latest ./server

# Build frontend
docker build -t crm-frontend:latest ./client

# Run with docker-compose
docker-compose up -d
```

---

## 📋 Environment Variables

### Backend (.env):
```env
# Database
DATABASE_URL=postgres://user:pass@host:5432/dbname
# OR for SQLite (development)
# DATABASE_URL=sqlite:./database.sqlite

# JWT
JWT_SECRET=your-secret-key-here

# Server
PORT=5000
NODE_ENV=production

# CORS (if frontend on different domain)
CORS_ORIGIN=https://your-frontend-domain.com
```

### Frontend (.env):
```env
VITE_API_URL=https://your-backend-domain.com/api
```

---

## 🗄️ Database Migration (Production)

### If Using PostgreSQL (Recommended for Production):

```sql
-- Connect to production database
psql -U username -d crm_production

-- Add branch column to Users
ALTER TABLE "Users" 
ADD COLUMN branch VARCHAR(50) DEFAULT 'kochi' NOT NULL;

-- Add branch column to Leads
ALTER TABLE "Leads" 
ADD COLUMN branch VARCHAR(50) DEFAULT 'kochi' NOT NULL;

-- Migrate existing data
UPDATE "Users" SET branch = 'kochi' WHERE branch IS NULL;
UPDATE "Leads" SET branch = 'kochi' WHERE branch IS NULL;

-- Verify
SELECT branch, COUNT(*) FROM "Users" GROUP BY branch;
SELECT branch, COUNT(*) FROM "Leads" GROUP BY branch;
```

### If Using SQLite (Development Only):
```bash
# The fix_schema.js script handles this automatically
node server/fix_schema.js
```

---

## ✅ Post-Deployment Verification

### 1. Health Check
```bash
# Check API health
curl https://your-backend-domain.com/api/health

# Expected response:
# {"success": true, "db": {"connected": true}}
```

### 2. Test Branch Endpoints
```bash
# Test unassigned leads endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-backend-domain.com/api/leads/unassigned?branch=kochi

# Test admin dashboard with branch
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://your-backend-domain.com/api/dashboard/admin?branch=kochi
```

### 3. Frontend Checks
- [ ] Login works
- [ ] Branch switcher appears (admin)
- [ ] Upload leads works
- [ ] Unassigned leads table appears
- [ ] Manual assignment works
- [ ] No 500 errors in browser console

---

## 🔄 Rollback Plan (If Issues Occur)

### Quick Rollback:
```bash
# Revert to previous commit
git revert HEAD
git push origin main

# OR reset to specific commit
git reset --hard <previous-commit-hash>
git push -f origin main
```

### Database Rollback:
```sql
-- Remove branch columns (if needed)
ALTER TABLE "Users" DROP COLUMN branch;
ALTER TABLE "Leads" DROP COLUMN branch;
```

---

## 📞 Support & Troubleshooting

### Common Issues:

**1. "No such column: branch" Error:**
```bash
# Run migration script
node server/fix_schema.js
```

**2. ENUM Type Error (PostgreSQL):**
```sql
-- If you see ENUM errors, ensure using VARCHAR/TEXT
ALTER TABLE "Users" ALTER COLUMN branch TYPE VARCHAR(50);
ALTER TABLE "Leads" ALTER COLUMN branch TYPE VARCHAR(50);
```

**3. CORS Errors:**
```javascript
// In server/server.js, update CORS config
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000'
}));
```

**4. Build Errors:**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

---

## 📊 Monitoring

### Logs to Watch:
```bash
# Backend logs (PM2)
pm2 logs crm-backend

# Backend logs (systemd)
journalctl -u crm-backend -f

# Database logs
tail -f /var/log/postgresql/postgresql-*.log
```

### Key Metrics:
- Response time for `/api/leads/unassigned`
- Database query performance
- Branch filter query counts
- User session branch switches

---

## 🎉 Deployment Checklist

Pre-Deployment:
- [ ] All tests passing locally
- [ ] CHANGELOG.md reviewed
- [ ] Environment variables configured
- [ ] Database backup taken

During Deployment:
- [ ] Code pushed to repository
- [ ] Backend deployed successfully
- [ ] Frontend deployed successfully
- [ ] Database migration completed
- [ ] Health checks passing

Post-Deployment:
- [ ] Production testing completed
- [ ] Team notified of changes
- [ ] Documentation updated
- [ ] Monitoring alerts configured

---

**Deployment Date:** January 2, 2026
**Deployed By:** [Your Name]
**Version:** 2.0.0
**Status:** ✅ Ready for Production
