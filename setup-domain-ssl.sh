#!/bin/bash
# Complete Domain Setup with SSL for crm.rmaoverseas.com

echo "=========================================="
echo "Domain Setup: crm.rmaoverseas.com"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Step 1: Check DNS
echo -e "${YELLOW}Step 1: Checking DNS resolution...${NC}"
if ping -c 2 crm.rmaoverseas.com &> /dev/null; then
    echo -e "${GREEN}✓ DNS is resolving to this server${NC}"
else
    echo -e "${RED}✗ DNS not resolving yet${NC}"
    echo "Please configure DNS in GoDaddy:"
    echo "  Type: A"
    echo "  Name: crm"
    echo "  Value: 147.79.71.15"
    echo ""
    echo "Wait 15-30 minutes and run this script again."
    exit 1
fi

# Step 2: Fix database enum
echo ""
echo -e "${YELLOW}Step 2: Fixing database enum...${NC}"
sudo -u postgres psql -d crm_db -c "ALTER TYPE \"enum_Leads_status\" ADD VALUE IF NOT EXISTS 'closed';" 2>/dev/null
echo -e "${GREEN}✓ Database enum updated${NC}"

# Step 3: Update Nginx config for domain
echo ""
echo -e "${YELLOW}Step 3: Updating Nginx configuration...${NC}"

cat > /tmp/crm-nginx-domain.conf << 'EOF'
server {
    listen 80;
    server_name crm.rmaoverseas.com www.crm.rmaoverseas.com;

    # Frontend (React build)
    location / {
        root /var/www/crm/RMA/client/dist;
        try_files $uri $uri/ /index.html;
        
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

sudo cp /tmp/crm-nginx-domain.conf /etc/nginx/sites-available/crm
echo -e "${GREEN}✓ Nginx config updated${NC}"

# Step 4: Test Nginx
echo ""
echo -e "${YELLOW}Step 4: Testing Nginx configuration...${NC}"
sudo nginx -t
if [ $? -ne 0 ]; then
    echo -e "${RED}✗ Nginx configuration error${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Nginx configuration valid${NC}"

# Step 5: Install Certbot if needed
echo ""
echo -e "${YELLOW}Step 5: Checking Certbot...${NC}"
if ! command -v certbot &> /dev/null; then
    echo "Installing Certbot..."
    sudo apt update
    sudo apt install -y certbot python3-certbot-nginx
fi
echo -e "${GREEN}✓ Certbot ready${NC}"

# Step 6: Get SSL certificate
echo ""
echo -e "${YELLOW}Step 6: Obtaining SSL certificate...${NC}"
echo "This will ask for your email and agreement."
echo ""

sudo certbot --nginx -d crm.rmaoverseas.com -d www.crm.rmaoverseas.com --non-interactive --agree-tos --email admin@rmaoverseas.com --redirect

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ SSL certificate installed${NC}"
else
    echo -e "${YELLOW}⚠ SSL installation failed or already exists${NC}"
    echo "You can run manually: sudo certbot --nginx -d crm.rmaoverseas.com"
fi

# Step 7: Restart services
echo ""
echo -e "${YELLOW}Step 7: Restarting services...${NC}"

cd /var/www/crm/RMA/server
pm2 restart crm-backend
echo -e "${GREEN}✓ Backend restarted${NC}"

sudo systemctl restart nginx
echo -e "${GREEN}✓ Nginx restarted${NC}"

# Step 8: Check status
echo ""
echo -e "${YELLOW}Step 8: Service status...${NC}"
pm2 status
sudo systemctl status nginx --no-pager -l | head -10

# Final message
echo ""
echo "=========================================="
echo -e "${GREEN}Setup Complete!${NC}"
echo "=========================================="
echo ""
echo "Your CRM is now accessible at:"
echo -e "${GREEN}https://crm.rmaoverseas.com${NC}"
echo ""
echo "Login:"
echo "  Email: admin@rmaoverseas.com"
echo "  Password: Rma.admin@123"
echo ""
echo "Useful commands:"
echo "  pm2 logs crm-backend"
echo "  sudo tail -f /var/log/nginx/error.log"
echo "  sudo certbot renew --dry-run"
echo ""
