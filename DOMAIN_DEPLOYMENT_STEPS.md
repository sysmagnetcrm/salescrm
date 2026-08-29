# Domain Deployment Steps for crm.rmaoverseas.com

## ✅ Completed Steps:
1. Updated API URL to https://crm.rmaoverseas.com/api
2. Built client application
3. Created Nginx configuration for domain
4. Created production .env file

## 📋 Next Steps to Execute on VPS:

### Step 1: Upload Built Files

**On Windows PowerShell:**
```powershell
cd d:\POPEYE\rma\client
scp -r dist/* root@147.79.71.15:/var/www/crm/RMA/client/dist/
```

### Step 2: Upload Configuration Files

```powershell
cd d:\POPEYE\rma

# Upload .env file
scp server/.env.production root@147.79.71.15:/var/www/crm/RMA/server/.env

# Upload Nginx config
scp nginx-config-domain.conf root@147.79.71.15:/tmp/crm-nginx.conf
```

### Step 3: SSH into VPS

```bash
ssh root@147.79.71.15
```

### Step 4: Update Nginx Configuration

```bash
# Copy the uploaded config to Nginx
sudo cp /tmp/crm-nginx.conf /etc/nginx/sites-available/crm

# Test configuration (will fail until SSL is installed - that's OK)
sudo nginx -t
```

### Step 5: Install SSL Certificate

```bash
# Install Certbot if not already installed
sudo apt update
sudo apt install -y certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d crm.rmaoverseas.com -d www.crm.rmaoverseas.com

# Follow prompts:
# - Enter email: your-email@example.com
# - Agree to terms: Y
# - Share email: N (or Y)
```

### Step 6: Restart Services

```bash
# Restart backend
cd /var/www/crm/RMA/server
pm2 restart crm-backend

# Test Nginx
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx

# Check status
pm2 status
sudo systemctl status nginx
```

### Step 7: Verify Deployment

```bash
# Check backend logs
pm2 logs crm-backend --lines 30

# Check if services are running
sudo netstat -tulpn | grep -E ':(80|443|5000)'

# Test API
curl https://crm.rmaoverseas.com/api/auth/health
```

---

## 🌐 DNS Configuration Required

**Before SSL will work, configure DNS in your domain registrar:**

| Type  | Name | Value          | TTL  |
|-------|------|----------------|------|
| A     | crm  | 147.79.71.15   | 3600 |

**Or if using subdomain:**

| Type  | Name | Value          | TTL  |
|-------|------|----------------|------|
| CNAME | crm  | rmaoverseas.com | 3600 |

**Wait 5-30 minutes for DNS propagation, then run Certbot.**

---

## 🎯 Access Your Application

After DNS propagates and SSL is installed:

**URL:** https://crm.rmaoverseas.com

**Login:**
- Email: admin@rmaoverseas.com
- Password: Admin123!@#

---

## 🔧 Troubleshooting

### DNS not resolving:
```bash
ping crm.rmaoverseas.com
nslookup crm.rmaoverseas.com
```

### SSL certificate fails:
- Make sure DNS is pointing to 147.79.71.15
- Wait for DNS propagation (can take up to 48 hours)
- Check firewall allows ports 80 and 443

### Backend not connecting:
```bash
pm2 logs crm-backend
cat /var/www/crm/RMA/server/.env
```

### Nginx errors:
```bash
sudo tail -50 /var/log/nginx/error.log
sudo nginx -t
```

---

## 📝 Important Notes

1. **Database Password**: Set to `2255` as requested
2. **Domain**: crm.rmaoverseas.com
3. **Main Domain**: rmaoverseas.com
4. **VPS IP**: 147.79.71.15
5. **CORS**: Configured for https://crm.rmaoverseas.com
6. **SSL**: Required - will be auto-configured by Certbot

---

## 🚀 Quick Command Reference

```bash
# Restart everything
pm2 restart crm-backend
sudo systemctl restart nginx

# View logs
pm2 logs crm-backend
sudo tail -f /var/log/nginx/error.log

# Check status
pm2 status
sudo systemctl status nginx
sudo ufw status

# Test SSL
curl -I https://crm.rmaoverseas.com
```
