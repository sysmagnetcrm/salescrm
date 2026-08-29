#!/bin/bash
# VPS Deployment Script for crm.rmaoverseas.com
# Run this on your VPS after uploading files

echo "========================================"
echo "CRM Domain Setup - crm.rmaoverseas.com"
echo "========================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Copy Nginx configuration
echo -e "${YELLOW}Step 1: Installing Nginx configuration...${NC}"
sudo cp /tmp/crm-nginx.conf /etc/nginx/sites-available/crm

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Nginx config installed${NC}"
else
    echo -e "${RED}✗ Failed to install Nginx config${NC}"
    exit 1
fi

# Step 2: Install Certbot if not installed
echo ""
echo -e "${YELLOW}Step 2: Checking Certbot installation...${NC}"
if ! command -v certbot &> /dev/null; then
    echo "Installing Certbot..."
    sudo apt update
    sudo apt install -y certbot python3-certbot-nginx
    echo -e "${GREEN}✓ Certbot installed${NC}"
else
    echo -e "${GREEN}✓ Certbot already installed${NC}"
fi

# Step 3: Check DNS before SSL
echo ""
echo -e "${YELLOW}Step 3: Checking DNS resolution...${NC}"
if ping -c 1 crm.rmaoverseas.com &> /dev/null; then
    echo -e "${GREEN}✓ DNS is resolving correctly${NC}"
    
    # Step 4: Get SSL certificate
    echo ""
    echo -e "${YELLOW}Step 4: Obtaining SSL certificate...${NC}"
    echo "This will ask for your email and agreement to terms."
    echo ""
    sudo certbot --nginx -d crm.rmaoverseas.com -d www.crm.rmaoverseas.com
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ SSL certificate installed${NC}"
    else
        echo -e "${RED}✗ Failed to get SSL certificate${NC}"
        echo "You can run this manually later:"
        echo "sudo certbot --nginx -d crm.rmaoverseas.com -d www.crm.rmaoverseas.com"
    fi
else
    echo -e "${RED}✗ DNS not resolving yet${NC}"
    echo "Please configure DNS first:"
    echo "  Type: A"
    echo "  Name: crm"
    echo "  Value: 147.79.71.15"
    echo ""
    echo "After DNS propagates, run:"
    echo "sudo certbot --nginx -d crm.rmaoverseas.com -d www.crm.rmaoverseas.com"
fi

# Step 5: Test Nginx configuration
echo ""
echo -e "${YELLOW}Step 5: Testing Nginx configuration...${NC}"
sudo nginx -t

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Nginx configuration is valid${NC}"
else
    echo -e "${RED}✗ Nginx configuration has errors${NC}"
    exit 1
fi

# Step 6: Restart services
echo ""
echo -e "${YELLOW}Step 6: Restarting services...${NC}"

# Restart backend
cd /var/www/crm/RMA/server
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

# Step 7: Check status
echo ""
echo -e "${YELLOW}Step 7: Checking service status...${NC}"
echo ""
echo "PM2 Status:"
pm2 status

echo ""
echo "Nginx Status:"
sudo systemctl status nginx --no-pager -l

echo ""
echo "Listening Ports:"
sudo netstat -tulpn | grep -E ':(80|443|5000)'

# Final message
echo ""
echo "========================================"
echo -e "${GREEN}Deployment Complete!${NC}"
echo "========================================"
echo ""
echo "Your CRM should now be accessible at:"
echo -e "${GREEN}https://crm.rmaoverseas.com${NC}"
echo ""
echo "Login credentials:"
echo "  Email: admin@rmaoverseas.com"
echo "  Password: Admin123!@#"
echo ""
echo "Useful commands:"
echo "  pm2 logs crm-backend          - View backend logs"
echo "  sudo tail -f /var/log/nginx/error.log - View Nginx errors"
echo "  pm2 restart crm-backend       - Restart backend"
echo "  sudo systemctl restart nginx  - Restart Nginx"
echo ""
