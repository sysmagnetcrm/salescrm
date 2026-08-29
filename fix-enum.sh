#!/bin/bash
# Fix database enum to add 'closed' status

echo "Fixing database enum..."

# Connect to database and add 'closed' to enum
sudo -u postgres psql -d crm_db << EOF
ALTER TYPE "enum_Leads_status" ADD VALUE IF NOT EXISTS 'closed';
\q
EOF

echo "Enum updated!"
echo "Restarting backend..."

# Restart backend
pm2 restart crm-backend

echo "Done! Checking logs..."
pm2 logs crm-backend --lines 10
