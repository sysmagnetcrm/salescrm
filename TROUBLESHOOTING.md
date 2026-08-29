# 🔧 Troubleshooting Guide - Lead Distribution CRM

## Common Issues and Solutions

### 🗄️ Database Issues

#### Issue: "Cannot connect to database"
**Symptoms:**
- Server fails to start
- Error: "ECONNREFUSED" or "Connection refused"

**Solutions:**
1. Check if PostgreSQL is running:
   ```bash
   # Windows
   services.msc
   # Look for "postgresql" service
   
   # Or check with:
   psql --version
   ```

2. Verify database exists:
   ```bash
   psql -U postgres
   \l
   # Look for "crm_database"
   ```

3. Check credentials in `.env`:
   ```env
   DB_USER=postgres
   DB_PASSWORD=your_actual_password
   DB_NAME=crm_database
   ```

4. Test connection:
   ```bash
   psql -U postgres -d crm_database
   ```

#### Issue: "Database does not exist"
**Solution:**
```sql
-- Connect to PostgreSQL
psql -U postgres

-- Create database
CREATE DATABASE crm_database;

-- Verify
\l

-- Exit
\q
```

#### Issue: "Authentication failed for user"
**Solution:**
- Reset PostgreSQL password
- Update `.env` with correct password
- Check pg_hba.conf for authentication method

---

### 🚀 Server Issues

#### Issue: "Port 5000 already in use"
**Symptoms:**
- Error: "EADDRINUSE: address already in use :::5000"

**Solutions:**
1. Kill process on port 5000:
   ```bash
   # Windows
   netstat -ano | findstr :5000
   taskkill /PID <PID> /F
   
   # Or use npx
   npx kill-port 5000
   ```

2. Change port in `.env`:
   ```env
   PORT=5001
   ```

#### Issue: "Module not found"
**Symptoms:**
- Error: "Cannot find module 'express'" or similar

**Solutions:**
```bash
# Navigate to server directory
cd server

# Remove and reinstall
rm -rf node_modules package-lock.json
npm install

# Or
npm ci
```

#### Issue: "JWT_SECRET is not defined"
**Solution:**
- Ensure `.env` file exists in server directory
- Add: `JWT_SECRET=your_secret_key_here`
- Restart server

---

### 💻 Frontend Issues

#### Issue: "Cannot connect to API"
**Symptoms:**
- Network errors in console
- "Failed to fetch" errors
- CORS errors

**Solutions:**
1. Check if backend is running:
   ```bash
   # Test endpoint
   curl http://localhost:5000/api/health
   ```

2. Verify VITE_API_URL in client/.env:
   ```env
   VITE_API_URL=http://localhost:5000/api
   ```

3. Check CORS in server:
   - Ensure `cors()` is enabled in server.js
   - Restart backend server

4. Clear browser cache:
   - Press Ctrl+Shift+Delete
   - Clear cached images and files

#### Issue: "Port 3000 already in use"
**Solutions:**
```bash
# Kill process
npx kill-port 3000

# Or change port in vite.config.js
server: {
  port: 3001
}
```

#### Issue: "Blank white screen"
**Solutions:**
1. Check browser console (F12)
2. Look for JavaScript errors
3. Verify all dependencies installed:
   ```bash
   cd client
   npm install
   ```
4. Clear browser cache
5. Try incognito mode

---

### 🔐 Authentication Issues

#### Issue: "Invalid credentials"
**Symptoms:**
- Cannot login with admin@crm.com

**Solutions:**
1. Check if admin user exists:
   ```sql
   psql -U postgres -d crm_database
   SELECT * FROM "Users" WHERE email = 'admin@crm.com';
   ```

2. Reset admin password:
   ```sql
   -- In PostgreSQL
   UPDATE "Users" 
   SET password = '$2a$10$...' -- Use bcrypt hash
   WHERE email = 'admin@crm.com';
   ```

3. Or delete and recreate:
   ```sql
   DELETE FROM "Users" WHERE email = 'admin@crm.com';
   -- Restart server to auto-create
   ```

#### Issue: "Token expired"
**Solution:**
- Logout and login again
- Token expires after 7 days by default
- Change JWT_EXPIRE in .env if needed

#### Issue: "Not authorized to access this route"
**Solutions:**
1. Check if logged in
2. Verify token in localStorage:
   ```javascript
   // In browser console
   localStorage.getItem('token')
   ```
3. Check user role:
   ```javascript
   JSON.parse(localStorage.getItem('user'))
   ```

---

### 📁 File Upload Issues

#### Issue: "File upload fails"
**Symptoms:**
- Upload button doesn't work
- Error: "Only CSV and Excel files allowed"

**Solutions:**
1. Check file format:
   - Must be .csv, .xlsx, or .xls
   - Check file extension

2. Check file size:
   - Default limit: 5MB
   - Increase in .env: `MAX_FILE_SIZE=10485760`

3. Verify uploads directory exists:
   ```bash
   # Server will create it, but you can manually:
   mkdir uploads
   ```

#### Issue: "No leads found in file"
**Solutions:**
1. Check CSV format:
   ```csv
   name,phone,email,company
   John Doe,1234567890,john@example.com,Acme Inc
   ```

2. Ensure required fields:
   - name (required)
   - phone (required)

3. Check for BOM or encoding issues:
   - Save as UTF-8
   - Remove BOM if present

---

### 🎨 UI/Display Issues

#### Issue: "Charts not displaying"
**Solutions:**
1. Check if data is loading:
   - Open browser console
   - Look for API responses

2. Verify Recharts installation:
   ```bash
   cd client
   npm install recharts
   ```

3. Check for JavaScript errors in console

#### Issue: "Colors not showing correctly"
**Solutions:**
1. Rebuild Tailwind:
   ```bash
   cd client
   npm run dev
   ```

2. Check tailwind.config.js exists

3. Verify index.css has Tailwind directives:
   ```css
   @tailwind base;
   @tailwind components;
   @tailwind utilities;
   ```

#### Issue: "Icons not showing"
**Solution:**
```bash
cd client
npm install lucide-react
```

---

### 📊 Data Issues

#### Issue: "Leads not distributing evenly"
**Symptoms:**
- Some salespeople get more leads than others

**Solutions:**
1. Check active salespeople:
   ```sql
   SELECT * FROM "Users" 
   WHERE role = 'salesperson' AND "isActive" = true;
   ```

2. Ensure at least one active salesperson exists

3. Check distribution logic in leadDistributor.js

#### Issue: "Dashboard shows no data"
**Solutions:**
1. Upload some leads first
2. Create salespeople
3. Check date filters
4. Verify API responses in Network tab

---

### 🔄 General Issues

#### Issue: "Changes not reflecting"
**Solutions:**
1. Hard refresh browser:
   - Ctrl+Shift+R (Windows)
   - Cmd+Shift+R (Mac)

2. Clear browser cache

3. Restart development servers:
   ```bash
   # Stop both servers (Ctrl+C)
   # Restart
   cd server && npm run dev
   cd client && npm run dev
   ```

4. Check if .env changes require restart

#### Issue: "Slow performance"
**Solutions:**
1. Check database indexes
2. Limit API response size
3. Add pagination
4. Optimize queries
5. Clear old data

---

### 🐛 Debugging Tips

#### Enable Detailed Logging

**Backend:**
```javascript
// In server.js
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});
```

**Frontend:**
```javascript
// In api.js
api.interceptors.request.use(config => {
  console.log('API Request:', config);
  return config;
});
```

#### Check Network Requests
1. Open DevTools (F12)
2. Go to Network tab
3. Filter by XHR
4. Check request/response

#### Check Database State
```sql
-- Count records
SELECT COUNT(*) FROM "Users";
SELECT COUNT(*) FROM "Leads";
SELECT COUNT(*) FROM "Activities";

-- Check recent leads
SELECT * FROM "Leads" ORDER BY "createdAt" DESC LIMIT 10;

-- Check lead distribution
SELECT "assignedTo", COUNT(*) 
FROM "Leads" 
GROUP BY "assignedTo";
```

---

### 📞 Getting Help

If issues persist:

1. **Check Console Logs:**
   - Backend: Terminal where server is running
   - Frontend: Browser console (F12)

2. **Check Error Messages:**
   - Read the full error message
   - Google the specific error
   - Check Stack Overflow

3. **Verify Setup:**
   - Follow SETUP_GUIDE.md step by step
   - Ensure all dependencies installed
   - Check environment variables

4. **Test Components:**
   - Test backend: `curl http://localhost:5000/api/health`
   - Test database: `psql -U postgres -d crm_database`
   - Test frontend: Open in incognito mode

5. **Fresh Start:**
   ```bash
   # Complete reset
   cd server
   rm -rf node_modules package-lock.json
   npm install
   
   cd ../client
   rm -rf node_modules package-lock.json
   npm install
   
   # Restart PostgreSQL
   # Recreate database
   # Restart servers
   ```

---

### ✅ Health Check Checklist

Before reporting an issue, verify:

- [ ] PostgreSQL is running
- [ ] Database exists and is accessible
- [ ] .env files exist in both server and client
- [ ] All environment variables are set
- [ ] Dependencies are installed (node_modules exists)
- [ ] No port conflicts
- [ ] Backend server is running (port 5000)
- [ ] Frontend server is running (port 3000)
- [ ] No errors in terminal
- [ ] No errors in browser console
- [ ] Network requests are successful
- [ ] Can access http://localhost:5000/api/health
- [ ] Can access http://localhost:3000

---

**Still having issues? Check the error message carefully and search for it online. Most errors have been encountered and solved by others!**
