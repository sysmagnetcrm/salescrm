# Quick Update Script
Write-Host "Uploading updated files..." -ForegroundColor Yellow

# Upload client
cd d:\POPEYE\rma\client
Write-Host "Uploading client..." -ForegroundColor Cyan
scp -r dist/* root@147.79.71.15:/var/www/crm/RMA/client/dist/

# Upload .env
cd d:\POPEYE\rma
Write-Host "Uploading .env..." -ForegroundColor Cyan
scp server/.env.production root@147.79.71.15:/var/www/crm/RMA/server/.env

Write-Host ""
Write-Host "Files uploaded! Now run on VPS:" -ForegroundColor Green
Write-Host "ssh root@147.79.71.15" -ForegroundColor White
Write-Host "bash /tmp/vps-setup-http-only.sh" -ForegroundColor White
Write-Host ""
Write-Host "Then access: http://147.79.71.15" -ForegroundColor Cyan
