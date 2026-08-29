# CRM Application Deployment Guide - Hostinger VPS (Ubuntu)

## Prerequisites
- Hostinger VPS with Ubuntu 13+ (or Ubuntu 22.04 LTS recommended)
- SSH access to your VPS
- Domain name (optional but recommended)
- Root or sudo access

## Step 1: Connect to Your VPS

```bash
ssh root@your-vps-ip
# or
ssh username@your-vps-ip
```

## Step 2: Update System and Install Dependencies

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verify installation
node --version
npm --version

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install Nginx (web server)
sudo apt install -y nginx

# Install PM2 (process manager for Node.js)
sudo npm install -g pm2

# Install Git
sudo apt install -y git
```

## Step 3: Setup PostgreSQL Database

```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL prompt, run:
CREATE DATABASE crm_db;
CREATE USER crm_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE crm_db TO crm_user;
\q

# Edit PostgreSQL config to allow password authentication
sudo nano /etc/postgresql/*/main/pg_hba.conf
# Change the line for local connections from 'peer' to 'md5':
# local   all             all                                     md5

# Restart PostgreSQL
sudo systemctl restart postgresql
```


### Option A: Using Git (Recommended)

```bash
# Create application directory
sudo mkdir -p /var/www/crm
sudo chown -R $USER:$USER /var/www/crm
cd /var/www/crm

# Clone your repository
git clone https://github.com/Dingan2218/RMA.git .

# Or initialize git and push from local
# On your local machine:
# git init
# git add .
# git commit -m "Initial commit"
# git remote add origin your-repo-url
# git push -u origin main
```

### Option B: Using SCP/SFTP

```bash
# On your local machine (Windows PowerShell):
# Navigate to your project directory
cd d:\POPEYE\rma

# Upload server files
scp -r server root@your-vps-ip:/var/www/crm/

# Upload client build
scp -r client/dist root@your-vps-ip:/var/www/crm/client/
```

## Step 5: Configure Server Environment

```bash
cd /var/www/crm/server

# Create .env file
nano .env
```

Add the following content to `.env`:

```env
# Server Configuration
PORT=5000
NODE_ENV=production

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=crm_db
DB_USER=crm_user
DB_PASSWORD=your_secure_password

# JWT Secret (generate a strong random string)
JWT_SECRET=your_very_long_random_secret_key_here_min_32_chars

# CORS Origin (your domain or VPS IP)
CORS_ORIGIN=http://your-domain.com
# or
CORS_ORIGIN=http://your-vps-ip
```

```bash
# Install server dependencies
npm install --production

# Test the server
node server.js
# Press Ctrl+C to stop after verifying it works
```

## Step 6: Setup PM2 to Run Server

```bash
cd /var/www/crm/server

# Start the server with PM2
pm2 start server.js --name crm-backend

# Save PM2 configuration
pm2 save

# Setup PM2 to start on system boot
pm2 startup
# Follow the command it outputs

# Check status
pm2 status
pm2 logs crm-backend
```

## Step 7: Configure Nginx as Reverse Proxy

```bash
# Create Nginx configuration
sudo nano /etc/nginx/sites-available/crm
```

Add the following configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    # Or use your VPS IP: server_name your-vps-ip;

    # Frontend (React build)
    location / {
        root /var/www/crm/client/dist;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:5000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Increase upload size if needed
    client_max_body_size 10M;
}
```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/crm /etc/nginx/sites-enabled/

# Remove default site
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Enable Nginx to start on boot
sudo systemctl enable nginx
```

## Step 8: Configure Firewall

```bash
# Allow SSH, HTTP, and HTTPS
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable

# Check status
sudo ufw status
```

## Step 9: Setup SSL Certificate (Optional but Recommended)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Obtain SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Follow the prompts
# Certbot will automatically configure Nginx for HTTPS

# Test auto-renewal
sudo certbot renew --dry-run
```

## Step 10: Update Client API URL

Before building the client, make sure the API URL points to your VPS:

```bash
# On your local machine, edit the API configuration
# File: d:\POPEYE\rma\client\src\services\api.js
```

Update the base URL:
```javascript
const API_URL = 'http://your-domain.com/api';
// or
const API_URL = 'http://your-vps-ip/api';
```

Then rebuild and upload:
```bash
# On local machine
cd d:\POPEYE\rma\client
npm run build

# Upload new build
scp -r dist/* root@your-vps-ip:/var/www/crm/client/dist/
```

## Useful Commands

### PM2 Management
```bash
pm2 list                    # List all processes
pm2 logs crm-backend        # View logs
pm2 restart crm-backend     # Restart server
pm2 stop crm-backend        # Stop server
pm2 delete crm-backend      # Remove from PM2
pm2 monit                   # Monitor resources
```

### Nginx Management
```bash
sudo systemctl status nginx     # Check status
sudo systemctl restart nginx    # Restart
sudo nginx -t                   # Test configuration
sudo tail -f /var/log/nginx/error.log    # View error logs
```

### PostgreSQL Management
```bash
sudo -u postgres psql crm_db    # Connect to database
sudo systemctl status postgresql # Check status
sudo systemctl restart postgresql # Restart
```

### Application Updates
```bash
# Pull latest changes
cd /var/www/crm
git pull

# Update server
cd server
npm install --production
pm2 restart crm-backend

# Update client (after building locally)
# Upload new dist folder via SCP
```

## Troubleshooting

### Check if server is running
```bash
pm2 status
pm2 logs crm-backend
curl http://localhost:5000/api/health
```

### Check Nginx
```bash
sudo nginx -t
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log
```

### Check PostgreSQL
```bash
sudo systemctl status postgresql
sudo -u postgres psql -c "SELECT version();"
```

### Database connection issues
```bash
# Test connection
sudo -u postgres psql -d crm_db -U crm_user -h localhost
```

### Port conflicts
```bash
# Check what's using port 5000
sudo lsof -i :5000
sudo netstat -tulpn | grep 5000
```

## Security Best Practices

1. **Change default passwords** - Use strong passwords for database and JWT secret
2. **Keep system updated** - Run `sudo apt update && sudo apt upgrade` regularly
3. **Use SSL/HTTPS** - Always use SSL certificates in production
4. **Firewall** - Keep UFW enabled and only allow necessary ports
5. **Regular backups** - Backup your database regularly:
   ```bash
   pg_dump -U crm_user -h localhost crm_db > backup_$(date +%Y%m%d).sql
   ```
6. **Monitor logs** - Regularly check PM2 and Nginx logs
7. **Environment variables** - Never commit `.env` file to git

## Backup Database

```bash
# Create backup
sudo -u postgres pg_dump crm_db > /var/backups/crm_backup_$(date +%Y%m%d).sql

# Restore backup
sudo -u postgres psql crm_db < /var/backups/crm_backup_20251104.sql

# Setup automated daily backups
sudo crontab -e
# Add this line:
0 2 * * * sudo -u postgres pg_dump crm_db > /var/backups/crm_backup_$(date +\%Y\%m\%d).sql
```

## Access Your Application

Once deployed, access your CRM at:
- **HTTP**: `http://your-domain.com` or `http://your-vps-ip`
- **HTTPS** (if SSL configured): `https://your-domain.com`

Default admin credentials (change these immediately):
- Check your database seed file or create admin user via API

## Support

For issues:
1. Check PM2 logs: `pm2 logs crm-backend`
2. Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`
3. Check database connection
4. Verify environment variables in `.env`
