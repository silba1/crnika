# 🔐 Google OAuth Setup Guide

Complete guide for enabling Google Sign-In in your application.

---

## 📋 **Prerequisites**

- Google Account
- Access to [Google Cloud Console](https://console.cloud.google.com/)

---

## 🚀 **Setup Steps**

### **1. Create Google Cloud Project**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **"Select a project"** → **"New Project"**
3. Enter project name: **"Apartmani & Restorani"**
4. Click **"Create"**

### **2. Enable Google+ API**

1. In your project, go to **"APIs & Services"** → **"Library"**
2. Search for **"Google+ API"**
3. Click **"Enable"**

### **3. Configure OAuth Consent Screen**

1. Go to **"APIs & Services"** → **"OAuth consent screen"**
2. Select **"External"** (unless you have Google Workspace)
3. Click **"Create"**

**Fill in required fields:**
- App name: `Apartmani & Restorani`
- User support email: `your-email@gmail.com`
- Developer contact: `your-email@gmail.com`

4. Click **"Save and Continue"**
5. **Scopes**: Click **"Add or Remove Scopes"**
   - Select: `./auth/userinfo.email`
   - Select: `./auth/userinfo.profile`
   - Click **"Update"** → **"Save and Continue"**

6. **Test users** (for development):
   - Add your email addresses
   - Click **"Save and Continue"**

7. Click **"Back to Dashboard"**

### **4. Create OAuth 2.0 Client ID**

1. Go to **"APIs & Services"** → **"Credentials"**
2. Click **"Create Credentials"** → **"OAuth client ID"**
3. Application type: **"Web application"**
4. Name: `Apartmani Web Client`

**Authorized JavaScript origins:**
```
http://localhost:5173
https://testing1.crnika.com
```

**Authorized redirect URIs:**
```
http://localhost:5173
https://testing1.crnika.com
```

5. Click **"Create"**
6. **IMPORTANT**: Copy **Client ID** - you'll need it!

---

## ⚙️ **Configuration**

### **Backend (.env file)**

Create `/backend/.env`:
```bash
GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
```

**Get Client ID from:**
Google Cloud Console → APIs & Services → Credentials → Your OAuth 2.0 Client

### **Frontend (.env file)**

Create `/frontend/.env`:
```bash
VITE_GOOGLE_CLIENT_ID=your_client_id_here.apps.googleusercontent.com
```

**Use the SAME Client ID for both frontend and backend!**

---

## 🧪 **Testing**

### **1. Start Backend**
```bash
cd backend
source venv/bin/activate  # or venv\Scripts\activate on Windows
python main.py
```

### **2. Start Frontend**
```bash
cd frontend
npm install  # First time only
npm run dev
```

### **3. Test Google Login**

1. Go to http://localhost:5173/login
2. Click **"Sign in with Google"**
3. Select your Google account
4. Grant permissions
5. **If email exists in database** → Login success!
6. **If email NOT in database** → Error message

---

## 👥 **Adding Users for OAuth**

Users must be added to the database FIRST before they can login via Google.

### **Admin adds Vlasnik:**

1. Login as admin
2. Go to **"Vlasnici"** → **"Dodaj Vlasnika"**
3. Enter:
   - **Email**: `vlasnik@gmail.com` (must match their Google email!)
   - **Ime**: `Marko Marić`
   - **Role**: `vlasnik`
   - **Auth Provider**: Will be set to `google` on first login
4. Save

### **Vlasnik logs in:**

1. Go to login page
2. Click **"Sign in with Google"**
3. Select Google account with email `vlasnik@gmail.com`
4. ✅ Login successful!

---

## 🔒 **Security Notes**

### **Production Checklist:**

- [ ] Update **Authorized JavaScript origins** in Google Console
- [ ] Update **Authorized redirect URIs** in Google Console  
- [ ] Change OAuth consent screen from **Testing** to **Production**
- [ ] Remove test users (production apps can use any Google account)
- [ ] Keep `.env` files OUT of git (add to `.gitignore`)
- [ ] Never commit Client ID/Secret to public repos

### **.gitignore**
```
# Environment variables
.env
.env.local
.env.production
```

---

## 🐛 **Troubleshooting**

### **"redirect_uri_mismatch" error**

**Problem**: Redirect URI not authorized

**Fix**:
1. Check exact URL in browser
2. Add it to **Authorized redirect URIs** in Google Console
3. **Must match EXACTLY** (including http/https, port, trailing slash)

### **"Access blocked: This app's request is invalid"**

**Problem**: OAuth consent screen not configured

**Fix**:
1. Complete OAuth consent screen setup
2. Add yourself as test user
3. Try again

### **"Email not found" error**

**Problem**: User email not in database

**Fix**:
1. Admin must add user to database FIRST
2. Email in database MUST match Google email exactly
3. Check for typos!

### **"Google OAuth not configured"**

**Problem**: `GOOGLE_CLIENT_ID` not set

**Fix**:
1. Check `/backend/.env` exists
2. Check `GOOGLE_CLIENT_ID` is set
3. Restart backend server

---

## 📊 **User Flow Diagram**

```
┌─────────────────────────────────────┐
│  Admin adds user to database        │
│  Email: vlasnik@gmail.com           │
│  auth_provider: 'password' (default)│
└─────────────┬───────────────────────┘
              │
              v
┌─────────────────────────────────────┐
│  User visits login page             │
│  Clicks "Sign in with Google"       │
└─────────────┬───────────────────────┘
              │
              v
┌─────────────────────────────────────┐
│  Google authentication              │
│  User selects account & grants auth │
└─────────────┬───────────────────────┘
              │
              v
┌─────────────────────────────────────┐
│  Backend checks database            │
│  Email exists? ✅                    │
└─────────────┬───────────────────────┘
              │
              v
┌─────────────────────────────────────┐
│  Update user record                 │
│  auth_provider: 'google'            │
│  oauth_id: Google user ID           │
└─────────────┬───────────────────────┘
              │
              v
┌─────────────────────────────────────┐
│  Login successful! ✅               │
│  User redirected to dashboard       │
└─────────────────────────────────────┘
```

---

## 🎯 **Next Steps (Future Enhancements)**

Once Google OAuth works, you can easily add:

### **Facebook Login**
- Similar setup in Meta for Developers
- Add `/auth/oauth/facebook` endpoint
- ~2 hours work

### **Microsoft Login**
- Setup in Azure Portal
- Add `/auth/oauth/microsoft` endpoint
- ~2 hours work

**All OAuth providers follow the same pattern!**

---

## ✅ **Success Checklist**

- [ ] Google Cloud project created
- [ ] OAuth consent screen configured
- [ ] OAuth Client ID created
- [ ] Backend `.env` configured with GOOGLE_CLIENT_ID
- [ ] Frontend `.env` configured with VITE_GOOGLE_CLIENT_ID
- [ ] Test user added to database
- [ ] Successfully logged in via Google
- [ ] Production URLs added to Google Console

---

**For support, check:**
- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [React OAuth Google Docs](https://www.npmjs.com/package/@react-oauth/google)

---

**🎉 Ready to deploy!**
