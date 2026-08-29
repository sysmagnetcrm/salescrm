#!/bin/bash
# VPS Setup Script - HTTP Only (No SSL)
# Run this on VPS: bash /tmp/vps-setup-http-only.sh

echo "========================================"
echo "CRM Setup - HTTP Only (Temporary)"
echo "========================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Create HTTP-only Nginx configuration
echo -e "${YELLOW}Step 1: Creating HTTP-only Nginx configuration...${NC}"

cat > /tmp/crm-nginx-http.conf << 'EOF'
server {
    listen 80;
    server_name crm.rmaoverseas.com www.crm.rmaoverseas.com 147.79.71.15;

    # Frontend (React build)
    location / {
        root /var/www/crm/RMA/client/dist;
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

    client_max_body_size 10M;
}
EOF

sudo cp /tmp/crm-nginx-http.conf /etc/nginx/sites-available/crm

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Nginx config created${NC}"
else
    echo -e "${RED}✗ Failed to create Nginx config${NC}"
    exit 1
fi

# Step 2: Update .env to use HTTP
echo ""
echo -e "${YELLOW}Step 2: Updating .env for HTTP...${NC}"

cd /var/www/crm/RMA/server

# Backup existing .env
cp .env .env.backup

# Update CORS_ORIGIN to HTTP
sed -i 's|CORS_ORIGIN=https://crm.rmaoverseas.com|CORS_ORIGIN=http://crm.rmaoverseas.com|g' .env

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ .env updated to use HTTP${NC}"
else
    echo -e "${RED}✗ Failed to update .env${NC}"
fi

# Step 3: Test Nginx configuration
echo ""
echo -e "${YELLOW}Step 3: Testing Nginx configuration...${NC}"
sudo nginx -t

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Nginx configuration is valid${NC}"
else
    echo -e "${RED}✗ Nginx configuration has errors${NC}"
    exit 1
fi

# Step 4: Restart services
echo ""
echo -e "${YELLOW}Step 4: Restarting services...${NC}"

# Restart backend
pm2 restart crm-backend

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Backend restarted${NC}"
else
    echo -e "${RED}✗ Failed to restart backend${NC}"
fi

# Restart Nginx
sudo systemctl restart nginx

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Nginx restarted${NC}"
else
    echo -e "${RED}✗ Failed to restart Nginx${NC}"
fi

# Step 5: Check status
echo ""
echo -e "${YELLOW}Step 5: Checking service status...${NC}"
echo ""
echo "PM2 Status:"
pm2 status

echo ""
echo "Nginx Status:"
sudo systemctl status nginx --no-pager -l | head -20

echo ""
echo "Listening Ports:"
sudo netstat -tulpn | grep -E ':(80|5000)'

# Step 6: Test endpoints
echo ""
echo -e "${YELLOW}Step 6: Testing endpoints...${NC}"

echo "Testing with IP:"
curl -I http://147.79.71.15 2>/dev/null | head -5

echo ""
echo "Testing API:"
curl http://localhost:5000/api/auth/health 2>/dev/null || echo "API test failed"

# Final message
echo ""
echo "========================================"
echo -e "${GREEN}HTTP Setup Complete!${NC}"
echo "========================================"
echo ""
echo "Your CRM is now accessible at:"
echo -e "${GREEN}http://147.79.71.15${NC}"
echo ""
echo "If DNS is configured:"
echo -e "${GREEN}http://crm.rmaoverseas.com${NC}"
echo ""
echo "Login credentials:"
echo "  Email: admin@rmaoverseas.com"
echo "  Password: Rma.admin@123"
echo ""
echo "========================================"
echo "To Add SSL (After DNS is working):"
echo "========================================"
echo ""
echo "1. Verify DNS is working:"
echo "   ping crm.rmaoverseas.com"
echo ""
echo "2. Install SSL certificate:"
echo "   sudo certbot --nginx -d crm.rmaoverseas.com -d www.crm.rmaoverseas.com"
echo ""
echo "3. Update .env to HTTPS:"
echo "   cd /var/www/crm/RMA/server"
echo "   sed -i 's|http://|https://|g' .env"
echo "   pm2 restart crm-backend"
echo ""
echo "Useful commands:"
echo "  pm2 logs crm-backend          - View backend logs"
echo "  sudo tail -f /var/log/nginx/error.log - View Nginx errors"
echo "  pm2 restart crm-backend       - Restart backend"
echo "  sudo systemctl restart nginx  - Restart Nginx"
echo ""
