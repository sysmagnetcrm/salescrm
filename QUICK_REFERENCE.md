# 🚀 Quick Reference Card - Lead Distribution CRM

## 🌐 Access URLs
- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:5000/api
- **Health Check:** http://localhost:5000/api/health

## 🔑 Login Credentials

### Admin
```
Email: admin@rmaverseas.com
Password: admin123
```

### Test Salesperson (Create first)
```
Email: sales1@crm.com
Password: sales123
```

## 🎨 Color Code System

| Status | Color | Background |
|--------|-------|------------|
| Fresh | Gray | White |
| Follow-up | Orange | Orange-50 |
| Closed | Green | Green-50 |
| Dead | Red | Red-50 |

## 📊 Admin Quick Actions

1. **Create Salesperson:**
   - Manage Team → Add Salesperson
   - Fill: Name, Email, Password, Targets
   - Click Create

2. **Upload Leads:**
   - Upload Leads → Choose File
   - Select `sample-leads.csv`
   - Click Upload & Distribute

3. **View Dashboard:**
   - Dashboard → See KPIs, Charts, Leaderboard

4. **Manage Leads:**
   - All Leads → Search, Filter, View Details

## 👤 Salesperson Quick Actions

1. **View My Leads:**
   - My Leads → See assigned leads only

2. **Update Lead:**
   - Click lead → Change status
   - Add notes → Set follow-up → Update

3. **Close Deal:**
   - Open lead → Status: Closed
   - Set value → Update Lead

4. **Check Performance:**
   - Dashboard → See targets, revenue, charts

## 🔄 Common Workflows

### Workflow 1: First Time Setup
```
1. Login as admin
2. Create 3 salespeople
3. Upload sample-leads.csv
4. View distribution in dashboard
5. Logout and login as salesperson
6. View your assigned leads
```

### Workflow 2: Lead Management
```
1. Login as salesperson
2. Go to My Leads
3. Click a Fresh lead
4. Change to Follow-up
5. Add note: "Called, interested"
6. Set follow-up date
7. Update Lead
8. Verify color changed to orange
```

### Workflow 3: Close a Deal
```
1. Open a lead
2. Status → Closed
3. Value → 10000
4. Notes → "Deal closed!"
5. Update Lead
6. Go to Dashboard
7. See revenue increased
8. Check leaderboard ranking
```

## 🎯 Test Scenarios

### Scenario A: Distribution Test
```
Salespeople: 3
Leads: 24 (sample-leads.csv)
Expected: Each gets 8 leads
```

### Scenario B: Performance Test
```
Close 3 deals: $5K, $10K, $8K
Expected Revenue: $23,000
Target: $50,000
Achievement: 46%
```

### Scenario C: Status Test
```
Update 5 leads:
- 2 to Follow-up (Orange)
- 2 to Closed (Green)
- 1 to Dead (Red)
Verify colors change
```

## 🛠️ Server Commands

### Start Servers
```bash
# Terminal 1 - Backend
cd server
npm run dev

# Terminal 2 - Frontend
cd client
npm run dev
```

### Stop Servers
```
Press Ctrl+C in each terminal
```

### Reset Database
```bash
# Stop server
# Delete database file
cd server
del database.sqlite
# Restart server
npm run dev
```

## 🔍 Debugging

### Check Backend
```bash
# Test health endpoint
curl http://localhost:5000/api/health
```

### Check Frontend
```
Open browser console (F12)
Look for errors in Console tab
Check Network tab for API calls
```

### Common Fixes
```
1. Hard refresh: Ctrl+Shift+R
2. Clear cache: Ctrl+Shift+Delete
3. Restart servers
4. Check .env files exist
```

## 📱 Features Checklist

### Admin Features
- [x] Dashboard with KPIs
- [x] Upload CSV/Excel
- [x] Auto lead distribution
- [x] Manage salespeople
- [x] View all leads
- [x] Search & filter
- [x] Leaderboard
- [x] Reports interface

### Salesperson Features
- [x] Personal dashboard
- [x] My leads only
- [x] Color-coded status
- [x] Update leads
- [x] Add notes
- [x] Set follow-ups
- [x] Click-to-call
- [x] View leaderboard

### System Features
- [x] JWT authentication
- [x] Role-based access
- [x] Responsive design
- [x] Real-time updates
- [x] Activity logging
- [x] Charts & graphs

## 📊 Sample Data

### Create Salesperson
```json
{
  "name": "Sales Person 1",
  "email": "sales1@crm.com",
  "password": "sales123",
  "phone": "1234567890",
  "monthlyTarget": 50000,
  "weeklyTarget": 12500
}
```

### Lead Statuses
```
fresh → follow-up → closed
                  ↘ dead
```

## 🎨 UI Components

### Status Badges
- Fresh: Gray badge
- Follow-up: Orange badge
- Closed: Green badge
- Dead: Red badge

### Icons
- 📊 Dashboard
- 📤 Upload
- 👥 Team
- 📋 Leads
- 🏆 Leaderboard
- 📄 Reports

## 🔐 Security

### Password Requirements
- Minimum 6 characters
- Hashed with bcrypt
- Never stored in plain text

### Token
- Expires in 7 days
- Stored in localStorage
- Auto-logout on expiry

## 📈 Metrics Tracked

### Admin Metrics
- Total leads
- Leads this month
- Follow-ups count
- Monthly revenue
- Conversion rate
- Top performers

### Salesperson Metrics
- Total assigned leads
- Status breakdown
- Weekly revenue
- Monthly revenue
- Target achievement
- Conversion rate

## 🚀 Keyboard Shortcuts

```
F12 - Open DevTools
Ctrl+Shift+R - Hard refresh
Ctrl+Shift+Delete - Clear cache
Ctrl+C - Stop server
```

## 📞 Quick Help

### Issue: Can't login
- Check credentials
- Verify server is running
- Check browser console

### Issue: No leads showing
- Upload leads first
- Check if logged in as correct user
- Verify API connection

### Issue: Colors not working
- Check lead status
- Hard refresh browser
- Verify Tailwind CSS loaded

### Issue: Charts not showing
- Check if data exists
- Verify Recharts loaded
- Check browser console

---

## 🎯 Success Indicators

✅ Login works
✅ Dashboard loads
✅ Leads upload
✅ Colors work
✅ Search works
✅ Updates save
✅ Charts display
✅ Leaderboard shows

---

**Print this card for quick reference during testing!** 📋
