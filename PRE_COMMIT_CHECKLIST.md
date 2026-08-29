# ✅ Pre-Deployment Checklist

## 🔒 Security Check (CRITICAL)

### ✅ Files That Should NOT Be Committed:
- [ ] ❌ `database.sqlite` - **REMOVED** ✓
- [ ] ❌ `server/database.sqlite` - **REMOVED** ✓
- [ ] ❌ `.env` files - Check now:
  ```bash
  git ls-files | grep ".env"
  # Should return NOTHING
  ```
- [ ] ❌ `node_modules/` - Already in .gitignore ✓
- [ ] ❌ Backup files (*.bak, *.backup) - Added to .gitignore ✓

### 🔍 Run This Command:
```bash
# Check for sensitive files
git status | Select-String -Pattern "database|\.env|node_modules"
# Should show NO matches
```

---

## 📝 What IS Being Committed:

### ✅ Code Changes (Safe to commit):
- Source code (.js, .jsx files)
- Configuration files (package.json)
- Documentation (CHANGELOG.md, DEPLOYMENT.md)
- CSS/styles
- Routes and controllers
- Models (schema definitions, NOT data)

### ✅ New Files Created:
- `CHANGELOG.md` ✓
- `DEPLOYMENT.md` ✓
- `client/src/context/BranchContext.jsx` ✓
- Helper scripts (fix_schema.js, check_schema.js) - **Now ignored** ✓

---

## 🎯 Git Status Check

Run this NOW:
```bash
git status
```

**Expected output:**
- Modified: ~28 files (code changes)
- Deleted: 2 files (database.sqlite files) ✓
- Untracked: NONE (or only non-sensitive files)

---

## 🚀 Ready to Commit?

### Final Command Sequence:
```bash
# 1. Add .gitignore changes
git add .gitignore

# 2. Commit database removal
git commit -m "chore: Remove database files from git tracking"

# 3. Add all other changes
git add .

# 4. Final commit
git commit -m "feat: Multi-branch support + Manual lead distribution

- Add Kochi/Chennai branch isolation with complete data filtering
- Replace auto-distribution with manual assignment interface
- Add unassigned leads table with Select 10/All bulk actions
- Fix SQLite compatibility (ENUM to STRING conversion)
- Update 20+ controllers/components for branch filtering
- Add /api/leads/unassigned endpoint
- Create comprehensive deployment documentation
- Migrate existing data to default 'kochi' branch"

# 5. Push to remote
git push origin main
```

---

## ⚠️ What to Do on Production Server

### DO NOT copy these files to production:
1. ❌ Local `database.sqlite` (contains dev data)
2. ❌ Local `.env` files
3. ❌ Local `node_modules/`
4. ❌ Local build artifacts

### DO copy/create on production:
1. ✅ Pull code from git: `git pull origin main`
2. ✅ Run `npm install` on server
3. ✅ Create `.env` with production values
4. ✅ Run `fix_schema.js` to add branch column
5. ✅ Let production database migrate automatically

---

## 🔐 Production .env Template

**Create this on server (NOT in git):**
```env
# Database (production)
DATABASE_URL=postgresql://user:pass@localhost:5432/crm_production

# OR for SQLite
# DATABASE_URL=sqlite:./database.sqlite

# JWT Secret (CHANGE THIS!)
JWT_SECRET=your-super-secret-production-key-here-change-me

# Server Config
PORT=5000
NODE_ENV=production

# CORS (if frontend on different domain)
CORS_ORIGIN=https://your-frontend-domain.com
```

---

## 📊 Commit Summary

**Files Changed:** ~28
**Lines Added:** ~1,500
**Lines Removed:** ~200
**New Features:** 2 (Multi-branch, Manual Distribution)
**Bug Fixes:** 5 (ENUM, 500 errors, CSS, etc.)

---

## ✅ Final Checks Before Push:

- [ ] `.gitignore` updated ✓
- [ ] Database files removed from git ✓
- [ ] No `.env` files in commit
- [ ] Code compiles locally (no errors)
- [ ] Documentation created (CHANGELOG, DEPLOYMENT) ✓
- [ ] Commit message is descriptive ✓

**Status:** 🟢 READY TO PUSH

---

**Date:** January 2, 2026
**Ready to deploy?** Yes! Run the commands above. 🚀
