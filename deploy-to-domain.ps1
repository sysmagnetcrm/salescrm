# PowerShell Deployment Script for crm.rmaoverseas.com
# Run this script from Windows PowerShell

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "CRM Deployment to crm.rmaoverseas.com" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Upload built client files
Write-Host "Step 1: Uploading client files..." -ForegroundColor Yellow
cd d:\POPEYE\rma\client
scp -r dist/* root@147.79.71.15:/var/www/crm/RMA/client/dist/

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Client files uploaded successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to upload client files" -ForegroundColor Red
    exit 1
}

# Step 2: Upload .env file
Write-Host ""
Write-Host "Step 2: Uploading .env configuration..." -ForegroundColor Yellow
cd d:\POPEYE\rma
scp server/.env.production root@147.79.71.15:/var/www/crm/RMA/server/.env

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ .env file uploaded successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to upload .env file" -ForegroundColor Red
    exit 1
}

# Step 3: Upload Nginx config
Write-Host ""
Write-Host "Step 3: Uploading Nginx configuration..." -ForegroundColor Yellow
scp nginx-config-domain.conf root@147.79.71.15:/tmp/crm-nginx.conf

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Nginx config uploaded successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to upload Nginx config" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Upload Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps to run on VPS (ssh root@147.79.71.15):" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Copy Nginx config:" -ForegroundColor White
Write-Host "   sudo cp /tmp/crm-nginx.conf /etc/nginx/sites-available/crm" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Install SSL certificate:" -ForegroundColor White
Write-Host "   sudo certbot --nginx -d crm.rmaoverseas.com -d www.crm.rmaoverseas.com" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Restart services:" -ForegroundColor White
Write-Host "   pm2 restart crm-backend" -ForegroundColor Gray
Write-Host "   sudo nginx -t" -ForegroundColor Gray
Write-Host "   sudo systemctl restart nginx" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Access your CRM at: https://crm.rmaoverseas.com" -ForegroundColor Cyan
Write-Host ""
