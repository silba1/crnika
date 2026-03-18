# 🏨 Apartmani & Restorani - Management System

**Professional reservation management system for apartments and restaurants**

Version 1.0 - Production Ready ✅

---

## ✨ Key Features

### 👥 **User Management**
- 3 Role Types: Admin, Vlasnik (Owner), Zaposlenik (Employee)
- Granular Permissions: Per-object access control
- Multi-tenant architecture
- Employee property assignment

### 🏠 **Apartment Management**
- Full CRUD operations
- Dynamic pricing per day/date range
- Reservation system with status tracking
- Automatic availability checking

### 🍽️ **Restaurant Management**
- Restaurant CRUD
- Capacity management (lunch/dinner)
- Table reservations with real-time availability
- Auto 3-hour duration

### 📅 **Advanced Reservations**
- Apartment bookings with auto-pricing
- Table reservations with capacity validation
- Status workflow (pending → confirmed/cancelled)
- Quick guest creation from reservations

### 📊 **Dashboard & Analytics**
- Role-based statistics
- Real-time data
- System overview

### 🔒 **Security**
- JWT authentication
- Password hashing
- Audit logging
- Role-based access control

### 💾 **Data Management**
- Full system export/import (JSON)
- Database backups
- Data validation

---

## 🛠️ Tech Stack

**Backend:** FastAPI + SQLite + Pydantic + JWT  
**Frontend:** React 18 + TypeScript + MUI + Zustand + Vite

---

## 🚀 Quick Start

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for full setup instructions.

**Development:**
```bash
# Backend
cd backend && python init_db.py && python main.py

# Frontend
cd frontend && npm install && npm run dev
```

**Default Login:**
- Email: `admin@admin.com`
- Password: `admin123`

---

## 📖 Documentation

- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Production deployment guide
- **[CHANGELOG.md](CHANGELOG.md)** - Version history
- **API Docs**: http://localhost:8000/docs

---

**Built with ❤️ | Production Ready v1.0**
