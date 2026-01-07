#!/bin/bash

# 1. Update & Install Prerequisites
echo "Updating system..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx mysql-server

# 2. Install Node.js 20 (LTS)
echo "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 3. Install PM2 Global
echo "Installing PM2..."
sudo npm install -g pm2

# 4. Setup MySQL (Interactive Step - you might need to do this manually if script hangs)
# We will create a user and database. 
# NOTE: Replace 'password123' with a secure password!
echo "Configuring MySQL..."
sudo mysql -e "CREATE DATABASE IF NOT EXISTS accounting_db;"
sudo mysql -e "CREATE USER IF NOT EXISTS 'accounting_user'@'localhost' IDENTIFIED BY 'password123';"
sudo mysql -e "GRANT ALL PRIVILEGES ON accounting_db.* TO 'accounting_user'@'localhost';"
sudo mysql -e "FLUSH PRIVILEGES;"

# 5. Clone Repository
# Ensure SSH keys are set up on GitHub for this server, or use HTTPS with token.
echo "Cloning repository..."
mkdir -p /var/www
cd /var/www
# Check if directory exists to avoid error
if [ ! -d "accounting" ]; then
    # REPLACE WITH YOUR ACTUAL REPO URL
    git clone https://github.com/yourusername/acnting-software.git accounting
else
    echo "Directory already exists, pulling latest..."
    cd accounting
    git pull
fi

# 6. Setup Project
cd /var/www/accounting
echo "Installing dependencies..."
npm install

# 7. Environment Setup
# You need to manually copy .env.production.template to .env and fill it in!
if [ ! -f .env ]; then
    echo "Creating .env from template..."
    cp .env.production.template .env
    echo "⚠️  PLEASE EDIT .env FILE WITH REAL CREDENTIALS AFTER SCRIPT FINISHES ⚠️"
fi

# 8. Build
echo "Building Next.js app..."
npm run build

# 9. Database Migration
echo "Running database migrations..."
npx prisma migrate deploy

# 10. Start with PM2
echo "Starting application..."
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup

# 11. Configure Nginx
echo "Configuring Nginx..."
# Assuming nginx.conf is in your repo after you push my previous changes
sudo cp nginx.conf /etc/nginx/sites-available/accounting
sudo ln -sf /etc/nginx/sites-available/accounting /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx

echo "✅ Setup Complete! Environment file needs to be updated manually."
