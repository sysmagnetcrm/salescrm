# 🚀 Quick Setup Guide - Lead Distribution CRM

## Step-by-Step Installation

### 1️⃣ Install PostgreSQL

**Windows:**
1. Download PostgreSQL from https://www.postgresql.org/download/windows/
2. Run the installer and follow the setup wizard
3. Remember your password for the postgres user
4. Default port: 5432

**Verify Installation:**
```bash
psql --version
```

### 2️⃣ Create Database

Open PostgreSQL command line (psql) or pgAdmin and run:

```sql
CREATE DATABASE crm_database;
```

Or using command line:
```bash
psql -U postgres
CREATE DATABASE crm_database;
\q
```

### 3️⃣ Backend Setup

```bash
# Navigate to server directory
cd server

# Install dependencies
npm install

# Create .env file
copy .env.example .env

# Edit .env file with your database credentials
# Use notepad or any text editor
notepad .env
```

**Configure .env:**
```env
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_NAME=crm_database
DB_USER=postgres
DB_PASSWORD=YOUR_POSTGRES_PASSWORD

JWT_SECRET=my_super_secret_jwt_key_12345
JWT_EXPIRE=7d

ADMIN_EMAIL=admin@rmaverseas.com
ADMIN_PASSWORD=admin123
```

**Start Backend Server:**
```bash
npm run dev
```

✅ Server should be running on http://localhost:5000

### 4️⃣ Frontend Setup

Open a NEW terminal window:

```bash
# Navigate to client directory
cd client

# Install dependencies
npm install

# Create .env file
copy .env.example .env
```

**The .env file should contain:**
```env
VITE_API_URL=http://localhost:5000/api
```

**Start Frontend:**
```bash
npm run dev
```

✅ App should be running on http://localhost:3000

### 5️⃣ Access the Application

1. Open browser: http://localhost:3000
2. Login with default credentials:
   - **Email:** admin@rmaverseas.com
   - **Password:** admin123

## 📋 Quick Test Checklist

- [ ] Backend server running on port 5000
- [ ] Frontend app running on port 3000
- [ ] Can login with admin credentials
- [ ] Admin dashboard loads with charts
- [ ] Can create a salesperson
- [ ] Can upload the sample-leads.csv file
- [ ] Leads are distributed automatically
- [ ] Can view leaderboard

## 🎯 First Steps After Setup

### As Admin:

1. **Create Salespeople:**
   - Go to "Manage Team"
   - Click "Add Salesperson"
   - Create at least 2-3 salespeople for testing
   - Example:
     - Name: Sales Person 1
     - Email: sales1@crm.com
     - Password: sales123
     - Monthly Target: 50000
     - Weekly Target: 12500

2. **Upload Leads:**
   - Go to "Upload Leads"
   - Upload the `sample-leads.csv` file
   - Verify leads are distributed evenly

3. **View Dashboard:**
   - Check KPIs and charts
   - View top performers
   - Monitor lead statistics

### As Salesperson:

1. **Login:**
   - Logout from admin
   - Login with salesperson credentials
   - Example: sales1@crm.com / sales123

2. **View Leads:**
   - Go to "My Leads"
   - See color-coded leads
   - Click on a lead to view details

3. **Update Lead:**
   - Change status (Fresh → Follow-up → Closed)
   - Add notes
   - Set follow-up date
   - Update deal value

4. **Track Performance:**
   - View dashboard
   - Check target vs achievement
   - See upcoming follow-ups

## 🔧 Common Issues & Solutions

### Issue: "Cannot connect to database"
**Solution:**
- Ensure PostgreSQL is running
- Check DB credentials in .env
- Verify database exists: `psql -U postgres -l`

### Issue: "Port 5000 already in use"
**Solution:**
```bash
# Kill the process
npx kill-port 5000

# Or change port in server/.env
PORT=5001
```

### Issue: "CORS error"
**Solution:**
- Ensure backend is running
- Check VITE_API_URL in client/.env
- Restart both servers

### Issue: "Module not found"
**Solution:**
```bash
# Reinstall dependencies
cd server
rm -rf node_modules package-lock.json
npm install

cd ../client
rm -rf node_modules package-lock.json
npm install
```

## 📊 Sample Data

The project includes `sample-leads.csv` with 24 sample leads. Upload this file to test the system.

**To create more salespeople for testing:**

Use the Admin panel or make API calls:

```bash
# Example: Create 8 salespeople
POST http://localhost:5000/api/users/salespeople
Authorization: Bearer YOUR_ADMIN_TOKEN

Body:
{
  "name": "Salesperson 1",
  "email": "sales1@crm.com",
  "password": "sales123",
  "phone": "1234567890",
  "monthlyTarget": 50000,
  "weeklyTarget": 12500
}
```

## 🎨 Features to Test

### Lead Status Colors:
- **White background** = Fresh lead
- **Orange background** = Follow-up needed
- **Green background** = Closed/Won
- **Red background** = Dead/Lost

### Click-to-Call:
- Click on any phone number
- Should trigger phone app on mobile
- On desktop, shows phone protocol handler

### Charts & Visualizations:
- Admin dashboard: Pie chart for lead status
- Admin dashboard: Bar chart for top performers
- Salesperson dashboard: Target vs Achievement chart
- Leaderboard: Rankings with medals

## 🚀 Production Deployment

### Backend (Render.com):
1. Push code to GitHub
2. Create new Web Service on Render
3. Connect GitHub repository
4. Set environment variables
5. Deploy

### Frontend (Vercel):
1. Push code to GitHub
2. Import project on Vercel
3. Set VITE_API_URL to production backend URL
4. Deploy

## 📱 Mobile Testing

The app is fully responsive. Test on:
- Chrome DevTools (F12 → Toggle Device Toolbar)
- Real mobile device
- Different screen sizes

## 🔐 Security Notes

**Before Production:**
- [ ] Change JWT_SECRET to a strong random string
- [ ] Change default admin password
- [ ] Enable HTTPS
- [ ] Set up environment-specific .env files
- [ ] Add rate limiting
- [ ] Enable CORS only for your domain

## 📞 Support

If you encounter issues:
1. Check the console for errors (F12 in browser)
2. Check server logs in terminal
3. Verify all environment variables
4. Ensure PostgreSQL is running
5. Try restarting both servers

---

**Happy CRM-ing! 🎉**
