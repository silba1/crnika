# 🚀 DEPLOYMENT GUIDE - Production Setup

## 📦 System Requirements

- **Python 3.9+**
- **Node.js 18+**
- **Apache 2.4+** (with mod_proxy, mod_ssl, mod_rewrite)
- **SQLite 3**
- **SSL Certificate** (Let's Encrypt)

---

## 🎯 Quick Start (Production)

### Backend Deployment

```bash
# 1. Upload backend files to server
scp -r backend/ user@server:/var/www/apartmani-backend/

# 2. SSH to server
ssh user@server

# 3. Setup backend
cd /var/www/apartmani-backend
python3 -m venv venv
source venv/bin/activate
pip install --break-system-packages -r requirements.txt

# 4. Initialize database (ONLY FIRST TIME!)
python init_db.py

# 5. Create systemd service
sudo nano /etc/systemd/system/apartmani-backend.service
```

**apartmani-backend.service:**
```ini
[Unit]
Description=Apartmani Backend API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/apartmani-backend
Environment="PATH=/var/www/apartmani-backend/venv/bin"
ExecStart=/var/www/apartmani-backend/venv/bin/python main.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
# 6. Start backend service
sudo systemctl daemon-reload
sudo systemctl enable apartmani-backend
sudo systemctl start apartmani-backend
sudo systemctl status apartmani-backend

# 7. Test backend
curl http://localhost:8000/health
```

---

### Frontend Deployment

```bash
# 1. Build locally (on your machine)
cd frontend
npm install
npm run build

# 2. Upload build to server
scp -r dist/ user@server:/var/www/html/apartmani-frontend/

# 3. Configure Apache
sudo nano /etc/apache2/sites-available/apartmani.conf
```

**apartmani.conf:**
```apache
<VirtualHost *:443>
    ServerName your-domain.com
    
    # API Proxy - MUST BE BEFORE DocumentRoot
    ProxyPreserveHost On
    ProxyPass /api http://localhost:8000
    ProxyPassReverse /api http://localhost:8000
    
    # Frontend Static Files
    DocumentRoot /var/www/html/apartmani-frontend
    
    <Directory /var/www/html/apartmani-frontend>
        Options -Indexes +FollowSymLinks
        AllowOverride None
        Require all granted
        
        # React Router Fallback (NOT for /api/*)
        RewriteEngine On
        RewriteCond %{REQUEST_URI} !^/api/
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule ^ /index.html [L]
    </Directory>
    
    # SSL Configuration
    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/your-domain.com/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/your-domain.com/privkey.pem
    Include /etc/letsencrypt/options-ssl-apache.conf
</VirtualHost>

# HTTP to HTTPS redirect
<VirtualHost *:80>
    ServerName your-domain.com
    Redirect permanent / https://your-domain.com/
</VirtualHost>
```

```bash
# 4. Enable site and restart Apache
sudo a2ensite apartmani.conf
sudo a2enmod proxy proxy_http ssl rewrite
sudo apache2ctl configtest
sudo systemctl restart apache2
```

---

## 🔑 Default Credentials

**Admin Account:**
- Email: `admin@admin.com`
- Password: `admin123`

**⚠️ CHANGE IMMEDIATELY AFTER FIRST LOGIN!**

---

## 🛡️ Security Checklist

- [ ] Change default admin password
- [ ] Configure firewall (ufw/iptables)
- [ ] Enable HTTPS (SSL certificate)
- [ ] Set strong SECRET_KEY in backend
- [ ] Disable debug mode in production
- [ ] Regular database backups
- [ ] Monitor logs for suspicious activity

---

## 📊 Database Backup

```bash
# Backup database
cd /var/www/apartmani-backend
cp baza_prod1.db baza_prod1_backup_$(date +%Y%m%d).db

# Or use export feature in app
# Login as Admin → Settings → Export System Data
```

---

## 🔄 Updating the Application

### Backend Update:
```bash
cd /var/www/apartmani-backend
git pull  # or upload new files
sudo systemctl restart apartmani-backend
```

### Frontend Update:
```bash
# Build locally
cd frontend
npm run build

# Upload to server
scp -r dist/* user@server:/var/www/html/apartmani-frontend/
```

---

## 🐛 Troubleshooting

### Backend not starting:
```bash
sudo systemctl status apartmani-backend
sudo journalctl -u apartmani-backend -n 50
```

### Frontend shows blank page:
```bash
# Check browser console for errors
# Check Apache error log
sudo tail -f /var/log/apache2/error.log
```

### API returns HTML instead of JSON:
```bash
# Check Apache proxy config
curl http://localhost:8000/health  # Should return JSON
curl https://your-domain.com/api/health  # Should also return JSON

# If different, fix Apache ProxyPass config
```

---

## 📞 Support

For issues or questions, check:
- Application logs: `/var/log/apache2/`
- Backend logs: `sudo journalctl -u apartmani-backend`
- Browser console (F12)

---

## 🎉 Done!

Your system should now be running at: `https://your-domain.com`
