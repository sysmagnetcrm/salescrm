# 🧪 Testing Guide - Lead Distribution CRM

## Prerequisites Check

Before testing, you need:
- ✅ Node.js installed (v16+)
- ❌ PostgreSQL installed (v12+)

## Option 1: Install PostgreSQL (Recommended)

### Windows Installation:

1. **Download PostgreSQL:**
   - Visit: https://www.postgresql.org/download/windows/
   - Download the installer (e.g., postgresql-16.x-windows-x64.exe)

2. **Install:**
   - Run the installer
   - Set password for postgres user (remember this!)
   - Keep default port: 5432
   - Complete installation

3. **Create Database:**
   ```bash
   # Open Command Prompt or PowerShell
   # Navigate to PostgreSQL bin folder (usually C:\Program Files\PostgreSQL\16\bin)
   
   # Or if psql is in PATH:
   psql -U postgres
   # Enter password when prompted
   
   # Create database:
   CREATE DATABASE crm_database;
   
   # Exit:
   \q
   ```

## Option 2: Quick Test with SQLite (Alternative)

If you want to test quickly without PostgreSQL, I can modify the backend to use SQLite instead.

## Testing Steps (Once PostgreSQL is Ready)

### Step 1: Install Dependencies

```bash
# Install root dependencies (for running both servers)
npm install

# Or install separately:
cd server
npm install

cd ../client
npm install
```

### Step 2: Configure Environment

**Server (.env):**
```bash
cd server
copy .env.example .env
notepad .env
```

Edit with your PostgreSQL password:
```env
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=crm_database
DB_USER=postgres
DB_PASSWORD=YOUR_PASSWORD_HERE

JWT_SECRET=my_super_secret_jwt_key_12345
JWT_EXPIRE=7d

ADMIN_EMAIL=admin@crm.com
ADMIN_PASSWORD=admin123
```

**Client (.env):**
```bash
cd client
copy .env.example .env
```

Should contain:
```env
VITE_API_URL=http://localhost:5000/api
```

### Step 3: Start Backend

```bash
cd server
npm run dev
```

**Expected Output:**
```
🚀 Server running on port 5000
✅ Database connected successfully
✅ Database synchronized
✅ Default admin user created
```

### Step 4: Start Frontend (New Terminal)

```bash
cd client
npm run dev
```

**Expected Output:**
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:3000/
➜  Network: use --host to expose
```

### Step 5: Test Login

1. Open browser: http://localhost:3000
2. You should see the login page
3. Enter credentials:
   - Email: admin@crm.com
   - Password: admin123
4. Click "Sign In"
5. Should redirect to Admin Dashboard

### Step 6: Test Admin Features

#### A. Create Salespeople

1. Click "Manage Team" in sidebar
2. Click "Add Salesperson"
3. Fill form:
   - Name: Sales Person 1
   - Email: sales1@crm.com
   - Password: sales123
   - Phone: 1234567890
   - Monthly Target: 50000
   - Weekly Target: 12500
4. Click "Create"
5. Repeat to create 2-3 more salespeople

#### B. Upload Leads

1. Click "Upload Leads" in sidebar
2. Click "Choose File"
3. Select `sample-leads.csv` from project root
4. Click "Upload & Distribute"
5. Should see success message with distribution summary

#### C. View Dashboard

1. Click "Dashboard" in sidebar
2. Verify:
   - Total Leads count
   - Pie chart showing lead distribution
   - Bar chart showing top performers
   - Leaderboard table

#### D. View All Leads

1. Click "All Leads" in sidebar
2. Should see all uploaded leads
3. Test search functionality
4. Test status filters
5. Click on a lead to view details

#### E. View Leaderboard

1. Click "Leaderboard" in sidebar
2. Toggle between "This Week" and "This Month"
3. Verify rankings and medals

### Step 7: Test Salesperson Features

1. **Logout:**
   - Click logout button in top right

2. **Login as Salesperson:**
   - Email: sales1@crm.com
   - Password: sales123

3. **View Dashboard:**
   - Should see personal metrics
   - Target vs Achievement chart
   - Upcoming follow-ups

4. **View My Leads:**
   - Click "My Leads" in sidebar
   - Should see only assigned leads
   - Leads should be color-coded

5. **Update a Lead:**
   - Click on any lead
   - Change status to "Follow-up"
   - Add notes
   - Set follow-up date
   - Update deal value
   - Click "Update Lead"

6. **Add Activity:**
   - Click "Add Note" button
   - Enter a note
   - Should appear in activity history

7. **Test Click-to-Call:**
   - Click on a phone number
   - Should trigger phone app (on mobile) or show tel: protocol

8. **View Leaderboard:**
   - Click "Leaderboard"
   - See your ranking

### Step 8: Test Color-Coded System

Update leads to different statuses and verify colors:

- **Fresh** → White background
- **Follow-up** → Orange background
- **Closed** → Green background
- **Dead** → Red background

## Automated Test Checklist

- [ ] Backend starts without errors
- [ ] Frontend starts without errors
- [ ] Can login as admin
- [ ] Can create salesperson
- [ ] Can upload CSV file
- [ ] Leads are distributed evenly
- [ ] Dashboard shows correct data
- [ ] Charts render properly
- [ ] Can view all leads
- [ ] Can search leads
- [ ] Can filter by status
- [ ] Can login as salesperson
- [ ] Salesperson sees only their leads
- [ ] Can update lead status
- [ ] Can add notes
- [ ] Colors change based on status
- [ ] Click-to-call works
- [ ] Leaderboard displays correctly
- [ ] Can logout

## Common Test Scenarios

### Scenario 1: Lead Distribution
1. Create 3 salespeople
2. Upload 24 leads (sample-leads.csv)
3. Verify each gets 8 leads

### Scenario 2: Performance Tracking
1. As salesperson, update 5 leads to "Closed"
2. Set deal values (e.g., $5000 each)
3. Check dashboard shows $25,000 revenue
4. Verify leaderboard ranking

### Scenario 3: Follow-up Management
1. Set follow-up dates for 3 leads
2. Check dashboard shows upcoming follow-ups
3. Verify dates are correct

### Scenario 4: Search and Filter
1. Search for "John"
2. Filter by "Closed" status
3. Verify results are correct

## Performance Testing

### Load Test
1. Upload large CSV (100+ leads)
2. Verify distribution completes
3. Check dashboard loads quickly

### Concurrent Users
1. Login as admin in one browser
2. Login as salesperson in another
3. Verify both work simultaneously

## Browser Testing

Test in multiple browsers:
- [ ] Chrome
- [ ] Firefox
- [ ] Edge
- [ ] Safari (if available)

## Mobile Testing

1. Open Chrome DevTools (F12)
2. Click device toolbar icon
3. Select mobile device
4. Test all features
5. Verify responsive design

## API Testing (Optional)

Use Postman or curl to test endpoints:

```bash
# Health check
curl http://localhost:5000/api/health

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@crm.com","password":"admin123"}'

# Get dashboard (replace TOKEN)
curl http://localhost:5000/api/dashboard/admin \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Troubleshooting During Testing

If you encounter issues, check:
1. Both servers are running
2. No errors in terminal
3. No errors in browser console (F12)
4. Database is accessible
5. Environment variables are correct

## Next Steps After Testing

Once testing is complete:
1. Review FEATURES_CHECKLIST.md
2. Check TROUBLESHOOTING.md for any issues
3. Customize as needed
4. Deploy to production

---

**Need help? Check TROUBLESHOOTING.md for solutions to common issues!**
