# ⚡ Quick Test Guide (No PostgreSQL Required)

## 🚀 Fastest Way to Test the CRM

Since PostgreSQL is not installed, here's how to test the CRM using SQLite instead:

### Step 1: Install Dependencies

```bash
# From project root
cd server
npm install
npm install sqlite3

cd ../client
npm install
```

### Step 2: Switch to SQLite

**Option A: Temporary change (for testing)**

Edit `server/config/database.js` and replace the content with:

```javascript
import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

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
```

### Step 3: Create .env Files

**Server .env:**
```bash
cd server
copy .env.example .env
```

Edit `server/.env`:
```env
PORT=5000
NODE_ENV=development
JWT_SECRET=my_super_secret_jwt_key_12345
JWT_EXPIRE=7d
ADMIN_EMAIL=admin@crm.com
ADMIN_PASSWORD=admin123
```

**Client .env:**
```bash
cd client
copy .env.example .env
```

The file should contain:
```env
VITE_API_URL=http://localhost:5000/api
```

### Step 4: Start Backend

```bash
cd server
npm run dev
```

**Expected Output:**
```
✅ SQLite Database connected successfully
✅ Database synchronized
✅ Default admin user created
🚀 Server running on port 5000
```

### Step 5: Start Frontend (New Terminal)

```bash
cd client
npm run dev
```

**Expected Output:**
```
VITE v5.x.x  ready in xxx ms
➜  Local:   http://localhost:3000/
```

### Step 6: Open Browser and Test

1. **Open:** http://localhost:3000
2. **Login:**
   - Email: `admin@crm.com`
   - Password: `admin123`
3. **You should see the Admin Dashboard!**

### Step 7: Quick Feature Test

1. **Create a Salesperson:**
   - Go to "Manage Team"
   - Click "Add Salesperson"
   - Fill in:
     - Name: Test Sales
     - Email: test@sales.com
     - Password: test123
     - Monthly Target: 50000
   - Click "Create"

2. **Upload Leads:**
   - Go to "Upload Leads"
   - Choose `sample-leads.csv`
   - Click "Upload & Distribute"
   - Should see success message!

3. **View Dashboard:**
   - Click "Dashboard"
   - See charts and metrics

4. **Test as Salesperson:**
   - Logout
   - Login with: test@sales.com / test123
   - View "My Leads"
   - Click on a lead and update it

### ✅ Quick Checklist

- [ ] Backend starts successfully
- [ ] Frontend loads at localhost:3000
- [ ] Can login as admin
- [ ] Dashboard shows data
- [ ] Can create salesperson
- [ ] Can upload CSV
- [ ] Leads are distributed
- [ ] Can login as salesperson
- [ ] Can view and update leads
- [ ] Colors work (Fresh=White, Follow-up=Orange, etc.)

## 🎯 What to Test

### Admin Features:
- ✅ Dashboard with charts
- ✅ Upload leads (use sample-leads.csv)
- ✅ Create/edit salespeople
- ✅ View all leads
- ✅ Leaderboard

### Salesperson Features:
- ✅ Personal dashboard
- ✅ My leads (color-coded)
- ✅ Update lead status
- ✅ Add notes
- ✅ Click-to-call (click phone numbers)
- ✅ Leaderboard

## 🔄 Reset Database

If you want to start fresh:

```bash
# Stop the server
# Delete the database file
cd server
del database.sqlite

# Restart server - will create new database
npm run dev
```

## 📊 Test with Sample Data

The `sample-leads.csv` file contains 24 leads. Upload it to see:
- Automatic distribution
- Charts populated
- Leaderboard rankings

## 🐛 If Something Goes Wrong

1. **Check terminal for errors**
2. **Check browser console (F12)**
3. **Verify both servers are running**
4. **Try hard refresh (Ctrl+Shift+R)**

## 💡 Tips

- Create 2-3 salespeople before uploading leads
- Update some leads to "Closed" status to see revenue
- Set different deal values to see leaderboard changes
- Try the search and filter features

## 🎉 Success Indicators

You'll know it's working when:
- ✅ Login works
- ✅ Dashboard shows charts
- ✅ Leads upload successfully
- ✅ Colors change based on status
- ✅ Leaderboard shows rankings
- ✅ Can switch between admin and salesperson views

---

**This SQLite setup is perfect for testing! For production, use PostgreSQL as described in SETUP_GUIDE.md**
