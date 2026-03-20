"""
FastAPI Backend for Apartmani & Restorani System
Complete REST API with CRUD operations
"""

from fastapi import FastAPI, HTTPException, Depends, status, Query, Body
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from datetime import datetime, date
import sqlite3
from contextlib import contextmanager
from passlib.context import CryptContext
import secrets
import os
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from models import (
    Vlasnik, VlasnikCreate, VlasnikUpdate, Apartman, Restoran, Gost, 
    StoloviRezervacija, Rezervacija, CijenaApartmana,
    PostavkeVlasnika, AuditLog, SpamLog, BlockedIP,
    SystemData, Role, StatusRezervacije,
    Modul, VlasnikModul,  # Module system
    ZaposlenikObjekt  # Granular permissions
)

# OAuth providers
from auth.google import GoogleOAuthProvider

# ============================================
# APP CONFIGURATION
# ============================================

app = FastAPI(
    title="Apartmani & Restorani API",
    description="Complete REST API for apartment and restaurant management system",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
security = HTTPBasic(auto_error=False)

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Database path
DATABASE = "baza_prod1.db"


# ============================================
# DATABASE CONNECTION
# ============================================

@contextmanager
def get_db():
    """Database connection context manager"""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def dict_from_row(row: sqlite3.Row) -> dict:
    """Convert SQLite Row to dict"""
    return dict(row) if row else None


# ============================================
# AUTHENTICATION
# ============================================

def get_current_user(credentials: HTTPBasicCredentials = Depends(security)) -> dict:
    """Authenticate user with HTTP Basic Auth and fetch assigned modules"""
    # Check if credentials are provided
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing credentials",
            headers={"X-Error": "Authentication required"}
        )
    
    with get_db() as conn:
        user = conn.execute(
            "SELECT * FROM vlasnici WHERE email = ?",
            (credentials.username,)
        ).fetchone()
        
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid credentials",
                headers={"X-Error": "Invalid email or password"}
            )
        
        user_dict = dict_from_row(user)
        
        # Debug OAuth
        #print(f"🔐 DEBUG get_current_user:")
        #print(f"   Email: {credentials.username}")
        #print(f"   Password starts with 'oauth_': {credentials.password.startswith('oauth_')}")
        #print(f"   User auth_provider: {user_dict.get('auth_provider')}")
        #print(f"   User oauth_id: {user_dict.get('oauth_id')}")
        
        # Check authentication based on auth_provider
        if user_dict.get('auth_provider') == 'google':
            # OAuth users: Accept any password that starts with 'oauth_'
            # (This is a session token from frontend, not a real password)
            if not credentials.password.startswith('oauth_'):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid OAuth session",
                    headers={"X-Error": "OAuth authentication required"}
                )
        else:
            # Password users: Verify password hash
            if not user_dict.get('lozinka') or not pwd_context.verify(credentials.password, user_dict['lozinka']):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid credentials",
                    headers={"X-Error": "Invalid email or password"}
                )
        
        # Fetch user's modules - everyone gets their own modules from vlasnik_moduli
        modules = conn.execute("""
            SELECT m.naziv 
            FROM vlasnik_moduli vm
            JOIN moduli m ON vm.modul_id = m.id
            WHERE vm.vlasnik_id = ? AND m.aktivan = 1
        """, (user_dict['id'],)).fetchall()
        
        user_dict['moduli'] = [m['naziv'] for m in modules]
        
        return user_dict


def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    """Require admin role"""
    if current_user['role'] != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


def get_creator_id(current_user: dict = Depends(get_current_user)) -> int:
    """Get creator ID from current user"""
    return current_user['id']


# ============================================
# ZAPOSLENIK PERMISSIONS
# ============================================

def check_zaposlenik_objekt_access(
    db: sqlite3.Connection,
    zaposlenik_id: int,
    objekt_type: str,
    objekt_id: int,
    action: str = 'view'
) -> bool:
    """
    Check if zaposlenik has access to specific object
    
    Args:
        db: Database connection
        zaposlenik_id: Zaposlenik user ID
        objekt_type: 'restoran' or 'apartman'
        objekt_id: ID of restoran or apartman
        action: 'view', 'edit', 'create', 'delete'
    
    Returns:
        True if has permission, False otherwise
    """
    result = db.execute("""
        SELECT can_view, can_edit, can_create, can_delete
        FROM zaposlenik_objekti
        WHERE zaposlenik_id = ? 
        AND objekt_type = ? 
        AND objekt_id = ?
    """, (zaposlenik_id, objekt_type, objekt_id)).fetchone()
    
    if not result:
        # No record = no access
        return False
    
    permission_map = {
        'view': result['can_view'],
        'edit': result['can_edit'],
        'create': result['can_create'],
        'delete': result['can_delete'],
    }
    
    return bool(permission_map.get(action, False))


def get_zaposlenik_accessible_objects(
    db: sqlite3.Connection,
    zaposlenik_id: int,
    objekt_type: str,
    action: str = 'view'
) -> list[int]:
    """
    Get list of object IDs that zaposlenik can access
    
    Args:
        db: Database connection
        zaposlenik_id: Zaposlenik user ID
        objekt_type: 'restoran' or 'apartman'
        action: 'view', 'edit', 'create', 'delete'
    
    Returns:
        List of object IDs
    """
    permission_column = f"can_{action}"
    
    results = db.execute(f"""
        SELECT objekt_id
        FROM zaposlenik_objekti
        WHERE zaposlenik_id = ? 
        AND objekt_type = ?
        AND {permission_column} = 1
    """, (zaposlenik_id, objekt_type)).fetchall()
    
    return [row['objekt_id'] for row in results]


# ============================================
# AUDIT LOGGING
# ============================================

def log_audit(
    db: sqlite3.Connection,
    user_id: int,
    user_name: str,
    user_role: str,
    action: str,
    entity_type: str,
    entity_id: Optional[int] = None,
    entity_name: Optional[str] = None,
    details: Optional[str] = None
):
    """Log action to audit_log"""
    db.execute("""
        INSERT INTO audit_log 
        (korisnik_id, korisnik_ime, korisnik_role, akcija, entitet_tip, entitet_id, entitet_naziv, detalji)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (user_id, user_name, user_role, action, entity_type, entity_id, entity_name, details))
    db.commit()


# ============================================
# ROOT & HEALTH
# ============================================

@app.get("/", tags=["Root"])
def root():
    """API root endpoint"""
    return {
        "message": "Apartmani & Restorani API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get("/health", tags=["Root"])
def health_check():
    """Health check endpoint"""
    try:
        with get_db() as conn:
            conn.execute("SELECT 1").fetchone()
        return {"status": "healthy", "database": "connected"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


# ============================================
# AUTH ENDPOINTS (for audit logging)
# ============================================

@app.post("/login", tags=["Auth"])
def login(current_user: dict = Depends(get_current_user)):
    """
    Login endpoint for audit logging purposes.
    Actual auth is done via HTTP Basic Auth.
    This endpoint just logs the login event.
    """
    with get_db() as conn:
        # Log login event
        log_audit(
            conn, 
            current_user['id'], 
            current_user['ime'], 
            current_user['role'],
            'prijava', 
            'auth', 
            current_user['id'], 
            current_user['ime'], 
            f"Logged in as {current_user['role']}"
        )
        conn.commit()
    
    return {
        "id": current_user['id'],
        "ime": current_user['ime'],
        "email": current_user['email'],
        "role": current_user['role'],
        "moduli": current_user.get('moduli', [])
    }


@app.post("/logout", tags=["Auth"])
def logout(current_user: dict = Depends(get_current_user)):
    """
    Logout endpoint for audit logging purposes.
    Logs the logout event.
    """
    with get_db() as conn:
        # Log logout event
        log_audit(
            conn, 
            current_user['id'], 
            current_user['ime'], 
            current_user['role'],
            'odjava', 
            'auth', 
            current_user['id'], 
            current_user['ime'], 
            f"Logged out"
        )
        conn.commit()
    
    return {"message": "Logged out successfully"}


# ============================================
# OAUTH AUTHENTICATION
# ============================================

class OAuthLoginRequest(BaseModel):
    """Request model for OAuth login"""
    token: str


# Initialize Google OAuth provider
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
if not GOOGLE_CLIENT_ID:
    print("⚠️  WARNING: GOOGLE_CLIENT_ID not set. OAuth will not work!")

google_oauth = GoogleOAuthProvider(client_id=GOOGLE_CLIENT_ID) if GOOGLE_CLIENT_ID else None


@app.post("/auth/oauth/google", tags=["Auth"])
async def google_oauth_login(request: OAuthLoginRequest):
    """
    Google OAuth login endpoint.
    
    Frontend sends user info from Google, backend verifies email exists in database.
    """
    try:
        # Parse token as JSON (from frontend)
        import json
        user_info = json.loads(request.token)
        
        email = user_info.get('email')
        name = user_info.get('name', '')
        google_id = user_info.get('sub')
        email_verified = user_info.get('email_verified', False)
        
        if not email or not email_verified:
            raise HTTPException(
                status_code=401,
                detail="Email not verified by Google"
            )
        
        with get_db() as conn:
            # Check if user exists with this email
            user = conn.execute(
                "SELECT * FROM vlasnici WHERE email = ?",
                (email,)
            ).fetchone()
            
            if not user:
                raise HTTPException(
                    status_code=403,
                    detail=f"Korisnik sa email-om '{email}' nije pronađen u sustavu. Kontaktirajte administratora."
                )
            
            user_dict = dict_from_row(user)
            
            # Check if this is their first OAuth login
            if user_dict.get('auth_provider') == 'password' and not user_dict.get('oauth_id'):
                # Upgrade to OAuth - update provider and oauth_id
                conn.execute(
                    "UPDATE vlasnici SET auth_provider = ?, oauth_id = ? WHERE id = ?",
                    ('google', google_id, user_dict['id'])
                )
                conn.commit()
                user_dict['auth_provider'] = 'google'
                user_dict['oauth_id'] = google_id
            elif user_dict.get('auth_provider') != 'google':
                raise HTTPException(
                    status_code=403,
                    detail=f"Ovaj korisnik koristi {user_dict.get('auth_provider')} autentifikaciju."
                )
            
            # Get user's modules
            moduli_rows = conn.execute(
                "SELECT m.naziv FROM vlasnik_moduli vm JOIN moduli m ON vm.modul_id = m.id WHERE vm.vlasnik_id = ?",
                (user_dict['id'],)
            ).fetchall()
            moduli = [row[0] for row in moduli_rows]
            
            # Log login event
            log_audit(
                conn,
                user_dict['id'],
                user_dict['ime'],
                user_dict['role'],
                'prijava',
                'auth',
                user_dict['id'],
                user_dict['ime'],
                f"Logged in via Google OAuth"
            )
            conn.commit()
            
            return {
                "id": user_dict['id'],
                "ime": user_dict['ime'],
                "email": user_dict['email'],
                "role": user_dict['role'],
                "moduli": moduli
            }
            
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid Google token: {str(e)}"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"OAuth login failed: {str(e)}"
        )


# ============================================
# MODULI CRUD
# ============================================

@app.get("/moduli", response_model=List[Modul], tags=["Moduli"])
def list_moduli(current_user: dict = Depends(require_admin)):
    """List all available modules (admin only)"""
    with get_db() as conn:
        rows = conn.execute("SELECT * FROM moduli ORDER BY naziv").fetchall()
        return [dict_from_row(row) for row in rows]


@app.get("/vlasnici/{vlasnik_id}/moduli", tags=["Moduli"])
def get_vlasnik_moduli(vlasnik_id: int, current_user: dict = Depends(get_current_user)):
    """Get modules assigned to a specific vlasnik"""
    with get_db() as conn:
        # Check access
        if current_user['role'] == 'admin':
            # Admin can view anyone's modules
            pass
        elif current_user['role'] == 'vlasnik':
            # Vlasnik can view their own modules OR their zaposlenici's modules
            if current_user['id'] != vlasnik_id:
                # Check if this is their zaposlenik
                zaposlenik = conn.execute(
                    "SELECT * FROM vlasnici WHERE id = ? AND role = 'zaposlenik' AND nadredeni_vlasnik_id = ?",
                    (vlasnik_id, current_user['id'])
                ).fetchone()
                if not zaposlenik:
                    raise HTTPException(status_code=403, detail="Access denied")
        else:
            # Others can only view their own modules
            if current_user['id'] != vlasnik_id:
                raise HTTPException(status_code=403, detail="Access denied")
        
        rows = conn.execute("""
            SELECT m.* 
            FROM vlasnik_moduli vm
            JOIN moduli m ON vm.modul_id = m.id
            WHERE vm.vlasnik_id = ?
            ORDER BY m.naziv
        """, (vlasnik_id,)).fetchall()
        
        return [dict_from_row(row) for row in rows]


@app.post("/vlasnici/{vlasnik_id}/moduli", tags=["Moduli"])
def assign_vlasnik_moduli(
    vlasnik_id: int, 
    modul_ids: List[int],
    current_user: dict = Depends(require_admin)
):
    """Assign modules to a vlasnik (admin only)"""
    with get_db() as conn:
        # Verify vlasnik exists
        vlasnik = conn.execute("SELECT * FROM vlasnici WHERE id = ?", (vlasnik_id,)).fetchone()
        if not vlasnik:
            raise HTTPException(status_code=404, detail="Vlasnik not found")
        
        # Delete existing assignments
        conn.execute("DELETE FROM vlasnik_moduli WHERE vlasnik_id = ?", (vlasnik_id,))
        
        # Insert new assignments
        for modul_id in modul_ids:
            # Verify module exists
            modul = conn.execute("SELECT * FROM moduli WHERE id = ?", (modul_id,)).fetchone()
            if not modul:
                raise HTTPException(status_code=404, detail=f"Module ID {modul_id} not found")
            
            conn.execute("""
                INSERT INTO vlasnik_moduli (vlasnik_id, modul_id)
                VALUES (?, ?)
            """, (vlasnik_id, modul_id))
        
        conn.commit()
        
        log_audit(conn, current_user['id'], current_user['ime'], current_user['role'],
                 'uredi', 'vlasnik', vlasnik_id, vlasnik['ime'], 
                 f"Assigned {len(modul_ids)} modules")
        
        return {"message": f"Assigned {len(modul_ids)} modules to vlasnik {vlasnik_id}"}


# ============================================
# ZAPOSLENIK OBJEKTI (Granular Permissions)
# ============================================

@app.get("/zaposlenici/{zaposlenik_id}/objekti", response_model=List[ZaposlenikObjekt], tags=["Zaposlenik Objekti"])
def get_zaposlenik_objekti(
    zaposlenik_id: int,
    objekt_type: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get all object permissions for a zaposlenik"""
    with get_db() as conn:
        # Check zaposlenik exists and get nadredeni
        zaposlenik = conn.execute(
            "SELECT * FROM vlasnici WHERE id = ? AND role = 'zaposlenik'",
            (zaposlenik_id,)
        ).fetchone()
        
        if not zaposlenik:
            raise HTTPException(status_code=404, detail="Zaposlenik not found")
        
        # Permission check
        if current_user['role'] == 'admin':
            pass  # Admin sees all
        elif current_user['role'] == 'vlasnik':
            # Vlasnik can only see their own zaposlenici
            if zaposlenik['nadredeni_vlasnik_id'] != current_user['id']:
                raise HTTPException(status_code=403, detail="Access denied")
        elif current_user['id'] == zaposlenik_id:
            pass  # Zaposlenik can see their own permissions
        else:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Build query
        query = "SELECT * FROM zaposlenik_objekti WHERE zaposlenik_id = ?"
        params = [zaposlenik_id]
        
        if objekt_type:
            query += " AND objekt_type = ?"
            params.append(objekt_type)
        
        query += " ORDER BY objekt_type, objekt_id"
        
        rows = conn.execute(query, params).fetchall()
        return [dict_from_row(row) for row in rows]


@app.post("/zaposlenici/{zaposlenik_id}/objekti", response_model=ZaposlenikObjekt, tags=["Zaposlenik Objekti"])
def create_zaposlenik_objekt(
    zaposlenik_id: int,
    objekt: ZaposlenikObjekt,
    creator_id: int = Depends(get_creator_id),
    current_user: dict = Depends(get_current_user)
):
    """Assign object permission to zaposlenik"""
    with get_db() as conn:
        # Check zaposlenik exists and get nadredeni
        zaposlenik = conn.execute(
            "SELECT * FROM vlasnici WHERE id = ? AND role = 'zaposlenik'",
            (zaposlenik_id,)
        ).fetchone()
        
        if not zaposlenik:
            raise HTTPException(status_code=404, detail="Zaposlenik not found")
        
        # Permission check - only vlasnik or admin can assign
        if current_user['role'] == 'admin':
            pass
        elif current_user['role'] == 'vlasnik':
            # Must be their zaposlenik
            if zaposlenik['nadredeni_vlasnik_id'] != current_user['id']:
                raise HTTPException(status_code=403, detail="Access denied")
            
            # Verify vlasnik owns the object
            if objekt.objekt_type == 'restoran':
                obj_row = conn.execute(
                    "SELECT * FROM restorani WHERE id = ? AND vlasnik_id = ?",
                    (objekt.objekt_id, current_user['id'])
                ).fetchone()
            elif objekt.objekt_type == 'apartman':
                obj_row = conn.execute(
                    "SELECT * FROM apartmani WHERE id = ? AND vlasnik_id = ?",
                    (objekt.objekt_id, current_user['id'])
                ).fetchone()
            else:
                raise HTTPException(status_code=400, detail="Invalid objekt_type")
            
            if not obj_row:
                raise HTTPException(status_code=404, detail=f"{objekt.objekt_type.capitalize()} not found or access denied")
        else:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Check if already exists
        existing = conn.execute("""
            SELECT * FROM zaposlenik_objekti 
            WHERE zaposlenik_id = ? AND objekt_type = ? AND objekt_id = ?
        """, (zaposlenik_id, objekt.objekt_type, objekt.objekt_id)).fetchone()
        
        if existing:
            raise HTTPException(status_code=400, detail="Permission already exists. Use PUT to update.")
        
        # Insert
        cursor = conn.execute("""
            INSERT INTO zaposlenik_objekti 
            (zaposlenik_id, objekt_type, objekt_id, can_view, can_edit, can_create, can_delete, creator_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (zaposlenik_id, objekt.objekt_type, objekt.objekt_id, 
              objekt.can_view, objekt.can_edit, objekt.can_create, objekt.can_delete, creator_id))
        
        obj_id = cursor.lastrowid
        conn.commit()
        
        log_audit(conn, current_user['id'], current_user['ime'], current_user['role'],
                 'dodaj', 'zaposlenik_objekt', obj_id, 
                 f"{objekt.objekt_type}:{objekt.objekt_id}", 
                 f"Assigned to zaposlenik {zaposlenik_id}")
        
        row = conn.execute("SELECT * FROM zaposlenik_objekti WHERE id = ?", (obj_id,)).fetchone()
        return dict_from_row(row)


@app.put("/zaposlenici/{zaposlenik_id}/objekti/{objekt_id}", response_model=ZaposlenikObjekt, tags=["Zaposlenik Objekti"])
def update_zaposlenik_objekt(
    zaposlenik_id: int,
    objekt_id: int,
    objekt: ZaposlenikObjekt,
    current_user: dict = Depends(get_current_user)
):
    """Update object permission for zaposlenik"""
    with get_db() as conn:
        # Check exists
        existing = conn.execute(
            "SELECT * FROM zaposlenik_objekti WHERE id = ?",
            (objekt_id,)
        ).fetchone()
        
        if not existing:
            raise HTTPException(status_code=404, detail="Permission not found")
        
        if existing['zaposlenik_id'] != zaposlenik_id:
            raise HTTPException(status_code=400, detail="Zaposlenik ID mismatch")
        
        # Get zaposlenik
        zaposlenik = conn.execute(
            "SELECT * FROM vlasnici WHERE id = ?", (zaposlenik_id,)
        ).fetchone()
        
        # Permission check
        if current_user['role'] == 'admin':
            pass
        elif current_user['role'] == 'vlasnik':
            if zaposlenik['nadredeni_vlasnik_id'] != current_user['id']:
                raise HTTPException(status_code=403, detail="Access denied")
        else:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Update
        conn.execute("""
            UPDATE zaposlenik_objekti 
            SET can_view = ?, can_edit = ?, can_create = ?, can_delete = ?
            WHERE id = ?
        """, (objekt.can_view, objekt.can_edit, objekt.can_create, objekt.can_delete, objekt_id))
        
        conn.commit()
        
        log_audit(conn, current_user['id'], current_user['ime'], current_user['role'],
                 'uredi', 'zaposlenik_objekt', objekt_id, 
                 f"{existing['objekt_type']}:{existing['objekt_id']}", "Updated permissions")
        
        row = conn.execute("SELECT * FROM zaposlenik_objekti WHERE id = ?", (objekt_id,)).fetchone()
        return dict_from_row(row)


@app.delete("/zaposlenici/{zaposlenik_id}/objekti/{objekt_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Zaposlenik Objekti"])
def delete_zaposlenik_objekt(
    zaposlenik_id: int,
    objekt_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Remove object permission from zaposlenik"""
    with get_db() as conn:
        # Check exists
        existing = conn.execute(
            "SELECT * FROM zaposlenik_objekti WHERE id = ?",
            (objekt_id,)
        ).fetchone()
        
        if not existing:
            raise HTTPException(status_code=404, detail="Permission not found")
        
        if existing['zaposlenik_id'] != zaposlenik_id:
            raise HTTPException(status_code=400, detail="Zaposlenik ID mismatch")
        
        # Get zaposlenik
        zaposlenik = conn.execute(
            "SELECT * FROM vlasnici WHERE id = ?", (zaposlenik_id,)
        ).fetchone()
        
        # Permission check
        if current_user['role'] == 'admin':
            pass
        elif current_user['role'] == 'vlasnik':
            if zaposlenik['nadredeni_vlasnik_id'] != current_user['id']:
                raise HTTPException(status_code=403, detail="Access denied")
        else:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Delete
        conn.execute("DELETE FROM zaposlenik_objekti WHERE id = ?", (objekt_id,))
        conn.commit()
        
        log_audit(conn, current_user['id'], current_user['ime'], current_user['role'],
                 'obrisi', 'zaposlenik_objekt', objekt_id, 
                 f"{existing['objekt_type']}:{existing['objekt_id']}", 
                 f"Removed from zaposlenik {zaposlenik_id}")
        
        return None


@app.post("/zaposlenici/{zaposlenik_id}/objekti/bulk", tags=["Zaposlenik Objekti"])
def bulk_assign_zaposlenik_objekti(
    zaposlenik_id: int,
    assignments: List[dict],  # [{"objekt_type": "restoran", "objekt_id": 1, "can_view": true, ...}]
    creator_id: int = Depends(get_creator_id),
    current_user: dict = Depends(get_current_user)
):
    """Bulk assign/update object permissions for zaposlenik"""
    with get_db() as conn:
        # Check zaposlenik exists
        zaposlenik = conn.execute(
            "SELECT * FROM vlasnici WHERE id = ? AND role = 'zaposlenik'",
            (zaposlenik_id,)
        ).fetchone()
        
        if not zaposlenik:
            raise HTTPException(status_code=404, detail="Zaposlenik not found")
        
        # Permission check
        if current_user['role'] == 'admin':
            pass
        elif current_user['role'] == 'vlasnik':
            if zaposlenik['nadredeni_vlasnik_id'] != current_user['id']:
                raise HTTPException(status_code=403, detail="Access denied")
        else:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Delete all existing permissions
        conn.execute("DELETE FROM zaposlenik_objekti WHERE zaposlenik_id = ?", (zaposlenik_id,))
        
        # Insert new permissions
        created_count = 0
        for item in assignments:
            conn.execute("""
                INSERT INTO zaposlenik_objekti 
                (zaposlenik_id, objekt_type, objekt_id, can_view, can_edit, can_create, can_delete, creator_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                zaposlenik_id, 
                item.get('objekt_type'), 
                item.get('objekt_id'),
                item.get('can_view', True),
                item.get('can_edit', True),
                item.get('can_create', True),
                item.get('can_delete', False),
                creator_id
            ))
            created_count += 1
        
        conn.commit()
        
        log_audit(conn, current_user['id'], current_user['ime'], current_user['role'],
                 'uredi', 'zaposlenik', zaposlenik_id, zaposlenik['ime'], 
                 f"Bulk assigned {created_count} object permissions")
        
        return {"message": f"Assigned {created_count} permissions to zaposlenik {zaposlenik_id}"}


# ============================================
# VLASNICI (Users) CRUD
# ============================================

@app.get("/vlasnici", response_model=List[Vlasnik], tags=["Vlasnici"])
def list_vlasnici(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    role: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List users - Admin sees all, Vlasnik sees only their zaposlenici"""
    with get_db() as conn:
        query = "SELECT * FROM vlasnici WHERE 1=1"
        params = []
        
        # Filter based on user role
        if current_user['role'] == 'vlasnik':
            # Vlasnik sees only their zaposlenici
            query += " AND role = 'zaposlenik' AND nadredeni_vlasnik_id = ?"
            params.append(current_user['id'])
        elif current_user['role'] == 'zaposlenik':
            # Zaposlenik cannot access this endpoint
            raise HTTPException(status_code=403, detail="Access denied")
        # else: admin sees all (no filter)
        
        if role:
            query += " AND role = ?"
            params.append(role)
        
        query += " ORDER BY ime LIMIT ? OFFSET ?"
        params.extend([limit, skip])
        
        rows = conn.execute(query, params).fetchall()
        return [dict_from_row(row) for row in rows]


@app.get("/vlasnici/{vlasnik_id}", response_model=Vlasnik, tags=["Vlasnici"])
def get_vlasnik(
    vlasnik_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Get user by ID"""
    # Admin can see all, others only themselves
    if current_user['role'] != 'admin' and current_user['id'] != vlasnik_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    with get_db() as conn:
        row = conn.execute("SELECT * FROM vlasnici WHERE id = ?", (vlasnik_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Vlasnik not found")
        return dict_from_row(row)


@app.post("/vlasnici", response_model=Vlasnik, status_code=status.HTTP_201_CREATED, tags=["Vlasnici"])
def create_vlasnik(
    vlasnik: VlasnikCreate,
    current_user: dict = Depends(get_current_user)
):
    """Create new user - Admin creates any role, Vlasnik creates only zaposlenik"""
    with get_db() as conn:
        # Permission check
        if current_user['role'] == 'admin':
            # Admin can create any role
            pass
        elif current_user['role'] == 'vlasnik':
            # Vlasnik can only create zaposlenik
            if vlasnik.role != 'zaposlenik':
                raise HTTPException(status_code=403, detail="Vlasnik može kreirati samo zaposlenike")
            # Zaposlenik must be assigned to this vlasnik
            if vlasnik.nadredeni_vlasnik_id != current_user['id']:
                raise HTTPException(status_code=403, detail="Zaposlenik mora biti dodijeljen vama")
            # Vlasnik can only assign their own modules
            user_moduli = [m['id'] for m in conn.execute("""
                SELECT modul_id as id FROM vlasnik_moduli WHERE vlasnik_id = ?
            """, (current_user['id'],)).fetchall()]
            
            for modul_id in vlasnik.modul_ids:
                if modul_id not in user_moduli:
                    raise HTTPException(
                        status_code=403, 
                        detail=f"Ne možete dodijeliti modul koji nemate"
                    )
        else:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Check if email exists
        existing = conn.execute("SELECT id FROM vlasnici WHERE email = ?", (vlasnik.email,)).fetchone()
        if existing:
            raise HTTPException(status_code=400, detail="Email already exists")
        
        # Hash password
        hashed_password = pwd_context.hash(vlasnik.lozinka)
        
        cursor = conn.execute("""
            INSERT INTO vlasnici (ime, email, lozinka, role, nadredeni_vlasnik_id)
            VALUES (?, ?, ?, ?, ?)
        """, (vlasnik.ime, vlasnik.email, hashed_password, vlasnik.role, 
              vlasnik.nadredeni_vlasnik_id))
        
        vlasnik_id = cursor.lastrowid
        
        # Assign modules if provided
        if vlasnik.modul_ids:
            for modul_id in vlasnik.modul_ids:
                conn.execute("""
                    INSERT INTO vlasnik_moduli (vlasnik_id, modul_id)
                    VALUES (?, ?)
                """, (vlasnik_id, modul_id))
        
        conn.commit()
        
        log_audit(conn, current_user['id'], current_user['ime'], current_user['role'],
                 'dodaj', 'vlasnik', vlasnik_id, vlasnik.ime, 
                 f"Role: {vlasnik.role}, Modules: {len(vlasnik.modul_ids)}")
        
        # Return created user
        row = conn.execute("SELECT * FROM vlasnici WHERE id = ?", (vlasnik_id,)).fetchone()
        return dict_from_row(row)


@app.put("/vlasnici/{vlasnik_id}", response_model=Vlasnik, tags=["Vlasnici"])
def update_vlasnik(
    vlasnik_id: int,
    vlasnik: VlasnikUpdate,
    current_user: dict = Depends(get_current_user)
):
    """Update user"""
    with get_db() as conn:
        # Check exists
        existing = conn.execute("SELECT * FROM vlasnici WHERE id = ?", (vlasnik_id,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Vlasnik not found")
        
        # Permission check
        if current_user['role'] == 'admin':
            # Admin can update anyone
            pass
        elif current_user['role'] == 'vlasnik':
            # Vlasnik can update themselves OR their zaposlenici
            if current_user['id'] != vlasnik_id:
                # Updating someone else - must be their zaposlenik
                if existing['role'] != 'zaposlenik' or existing['nadredeni_vlasnik_id'] != current_user['id']:
                    raise HTTPException(status_code=403, detail="Možete editirati samo sebe ili svoje zaposlenike")
        else:
            # Zaposlenik can only update themselves
            if current_user['id'] != vlasnik_id:
                raise HTTPException(status_code=403, detail="Access denied")
    
    with get_db() as conn:
        # Check exists
        existing = conn.execute("SELECT * FROM vlasnici WHERE id = ?", (vlasnik_id,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Vlasnik not found")
        
        # Hash password if changed
        if vlasnik.lozinka and not vlasnik.lozinka.startswith('$2b$'):  # bcrypt hash starts with $2b$
            hashed_password = pwd_context.hash(vlasnik.lozinka)
        else:
            hashed_password = existing['lozinka']
        
        conn.execute("""
            UPDATE vlasnici 
            SET ime=?, email=?, lozinka=?, role=?, nadredeni_vlasnik_id=?
            WHERE id=?
        """, (vlasnik.ime, vlasnik.email, hashed_password, vlasnik.role,
              vlasnik.nadredeni_vlasnik_id, vlasnik_id))
        
        # Update modules if provided
        if vlasnik.modul_ids is not None:
            if current_user['role'] == 'admin':
                # Admin can assign any modules
                pass
            elif current_user['role'] == 'vlasnik':
                # Vlasnik can only assign their own modules
                user_moduli = [m['id'] for m in conn.execute("""
                    SELECT modul_id as id FROM vlasnik_moduli WHERE vlasnik_id = ?
                """, (current_user['id'],)).fetchall()]
                
                for modul_id in vlasnik.modul_ids:
                    if modul_id not in user_moduli:
                        raise HTTPException(
                            status_code=403, 
                            detail=f"Ne možete dodijeliti modul koji nemate"
                        )
            else:
                # Zaposlenik cannot update modules
                raise HTTPException(status_code=403, detail="Access denied")
            
            # Delete existing
            conn.execute("DELETE FROM vlasnik_moduli WHERE vlasnik_id = ?", (vlasnik_id,))
            # Insert new
            for modul_id in vlasnik.modul_ids:
                conn.execute("""
                    INSERT INTO vlasnik_moduli (vlasnik_id, modul_id)
                    VALUES (?, ?)
                """, (vlasnik_id, modul_id))
        
        conn.commit()
        
        log_audit(conn, current_user['id'], current_user['ime'], current_user['role'],
                 'uredi', 'vlasnik', vlasnik_id, vlasnik.ime, 
                 f"Updated, Modules: {len(vlasnik.modul_ids) if vlasnik.modul_ids else 'unchanged'}")
        
        row = conn.execute("SELECT * FROM vlasnici WHERE id = ?", (vlasnik_id,)).fetchone()
        return dict_from_row(row)


@app.delete("/vlasnici/{vlasnik_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Vlasnici"])
def delete_vlasnik(
    vlasnik_id: int,
    current_user: dict = Depends(get_current_user)
):
    """Delete user - Admin deletes anyone, Vlasnik deletes only their zaposlenici"""
    with get_db() as conn:
        vlasnik = conn.execute("SELECT * FROM vlasnici WHERE id = ?", (vlasnik_id,)).fetchone()
        if not vlasnik:
            raise HTTPException(status_code=404, detail="Vlasnik not found")
        
        # Permission check
        if current_user['role'] == 'admin':
            # Admin can delete anyone
            pass
        elif current_user['role'] == 'vlasnik':
            # Vlasnik can delete only their zaposlenici
            if vlasnik['role'] != 'zaposlenik' or vlasnik['nadredeni_vlasnik_id'] != current_user['id']:
                raise HTTPException(status_code=403, detail="Možete brisati samo svoje zaposlenike")
        else:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Check for dependencies
        apartmani_count = conn.execute("SELECT COUNT(*) as c FROM apartmani WHERE vlasnik_id = ?", (vlasnik_id,)).fetchone()['c']
        if apartmani_count > 0:
            raise HTTPException(status_code=400, detail=f"Cannot delete: {apartmani_count} apartmani exist")
        
        conn.execute("DELETE FROM vlasnici WHERE id = ?", (vlasnik_id,))
        conn.commit()
        
        log_audit(conn, current_user['id'], current_user['ime'], current_user['role'],
                 'obrisi', 'vlasnik', vlasnik_id, vlasnik['ime'], "Deleted")


# ============================================
# APARTMANI CRUD
# ============================================

@app.get("/apartmani", response_model=List[Apartman], tags=["Apartmani"])
def list_apartmani(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    vlasnik_id: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """List apartments"""
    with get_db() as conn:
        query = "SELECT * FROM apartmani WHERE 1=1"
        params = []
        
        # Filter by role and granular permissions
        if current_user['role'] == 'admin':
            # Admin sees all
            if vlasnik_id:
                query += " AND vlasnik_id = ?"
                params.append(vlasnik_id)
        elif current_user['role'] == 'vlasnik':
            # Vlasnik sees only their own
            query += " AND vlasnik_id = ?"
            params.append(current_user['id'])
        elif current_user['role'] == 'zaposlenik':
            # Zaposlenik sees only apartmani they have access to
            accessible_ids = get_zaposlenik_accessible_objects(
                conn, current_user['id'], 'apartman', 'view'
            )
            if not accessible_ids:
                # No access to any apartmani
                return []
            
            query += f" AND id IN ({','.join('?' * len(accessible_ids))})"
            params.extend(accessible_ids)
        
        query += " ORDER BY ime LIMIT ? OFFSET ?"
        params.extend([limit, skip])
        
        rows = conn.execute(query, params).fetchall()
        return [dict_from_row(row) for row in rows]


@app.get("/apartmani/{apartman_id}", response_model=Apartman, tags=["Apartmani"])
def get_apartman(apartman_id: int, current_user: dict = Depends(get_current_user)):
    """Get apartment by ID"""
    with get_db() as conn:
        row = conn.execute("SELECT * FROM apartmani WHERE id = ?", (apartman_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Apartman not found")
        
        # Access control
        if current_user['role'] != 'admin':
            if current_user['role'] == 'zaposlenik':
                if row['vlasnik_id'] != current_user.get('nadredeni_vlasnik_id'):
                    raise HTTPException(status_code=403, detail="Access denied")
            else:
                if row['vlasnik_id'] != current_user['id']:
                    raise HTTPException(status_code=403, detail="Access denied")
        
        return dict_from_row(row)


@app.post("/apartmani", response_model=Apartman, status_code=status.HTTP_201_CREATED, tags=["Apartmani"])
def create_apartman(
    apartman: Apartman,
    creator_id: int = Depends(get_creator_id),
    current_user: dict = Depends(get_current_user)
):
    """Create new apartment"""
    # Access control
    if current_user['role'] != 'admin':
        if current_user['role'] == 'zaposlenik':
            if apartman.vlasnik_id != current_user.get('nadredeni_vlasnik_id'):
                raise HTTPException(status_code=403, detail="Access denied")
        else:
            apartman.vlasnik_id = current_user['id']  # Force own ID
    
    with get_db() as conn:
        cursor = conn.execute("""
            INSERT INTO apartmani (vlasnik_id, ime, kapacitet, opis, creator_id)
            VALUES (?, ?, ?, ?, ?)
        """, (apartman.vlasnik_id, apartman.ime, apartman.kapacitet, apartman.opis, creator_id))
        
        apartman_id = cursor.lastrowid
        conn.commit()
        
        log_audit(conn, current_user['id'], current_user['ime'], current_user['role'],
                 'dodaj', 'apartman', apartman_id, apartman.ime, f"Kapacitet: {apartman.kapacitet}")
        
        row = conn.execute("SELECT * FROM apartmani WHERE id = ?", (apartman_id,)).fetchone()
        return dict_from_row(row)


@app.put("/apartmani/{apartman_id}", response_model=Apartman, tags=["Apartmani"])
def update_apartman(
    apartman_id: int,
    apartman: Apartman,
    current_user: dict = Depends(get_current_user)
):
    """Update apartment"""
    with get_db() as conn:
        existing = conn.execute("SELECT * FROM apartmani WHERE id = ?", (apartman_id,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Apartman not found")
        
        # Access control
        if current_user['role'] != 'admin':
            if current_user['role'] == 'zaposlenik':
                if existing['vlasnik_id'] != current_user.get('nadredeni_vlasnik_id'):
                    raise HTTPException(status_code=403, detail="Access denied")
            else:
                if existing['vlasnik_id'] != current_user['id']:
                    raise HTTPException(status_code=403, detail="Access denied")
        
        conn.execute("""
            UPDATE apartmani 
            SET ime=?, kapacitet=?, opis=?
            WHERE id=?
        """, (apartman.ime, apartman.kapacitet, apartman.opis, apartman_id))
        
        conn.commit()
        
        log_audit(conn, current_user['id'], current_user['ime'], current_user['role'],
                 'uredi', 'apartman', apartman_id, apartman.ime, "Updated")
        
        row = conn.execute("SELECT * FROM apartmani WHERE id = ?", (apartman_id,)).fetchone()
        return dict_from_row(row)


@app.delete("/apartmani/{apartman_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Apartmani"])
def delete_apartman(apartman_id: int, current_user: dict = Depends(get_current_user)):
    """Delete apartment"""
    with get_db() as conn:
        apartman = conn.execute("SELECT * FROM apartmani WHERE id = ?", (apartman_id,)).fetchone()
        if not apartman:
            raise HTTPException(status_code=404, detail="Apartman not found")
        
        # Access control
        if current_user['role'] != 'admin' and apartman['vlasnik_id'] != current_user['id']:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Check dependencies
        rez_count = conn.execute("SELECT COUNT(*) as c FROM rezervacije WHERE apartman_id = ?", (apartman_id,)).fetchone()['c']
        if rez_count > 0:
            raise HTTPException(status_code=400, detail=f"Cannot delete: {rez_count} rezervacije exist")
        
        conn.execute("DELETE FROM apartmani WHERE id = ?", (apartman_id,))
        conn.commit()
        
        log_audit(conn, current_user['id'], current_user['ime'], current_user['role'],
                 'obrisi', 'apartman', apartman_id, apartman['ime'], "Deleted")


# ============================================
# RESTORANI CRUD
# ============================================

@app.get("/restorani", response_model=List[Restoran], tags=["Restorani"])
def list_restorani(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    vlasnik_id: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """List restaurants"""
    with get_db() as conn:
        query = "SELECT * FROM restorani WHERE 1=1"
        params = []
        
        # Filter by role and granular permissions
        if current_user['role'] == 'admin':
            # Admin sees all
            if vlasnik_id:
                query += " AND vlasnik_id = ?"
                params.append(vlasnik_id)
        elif current_user['role'] == 'vlasnik':
            # Vlasnik sees only their own
            query += " AND vlasnik_id = ?"
            params.append(current_user['id'])
        elif current_user['role'] == 'zaposlenik':
            # Zaposlenik sees only restorani they have access to
            accessible_ids = get_zaposlenik_accessible_objects(
                conn, current_user['id'], 'restoran', 'view'
            )
            if not accessible_ids:
                # No access to any restorani
                return []
            
            query += f" AND id IN ({','.join('?' * len(accessible_ids))})"
            params.extend(accessible_ids)
        
        query += " ORDER BY ime LIMIT ? OFFSET ?"
        params.extend([limit, skip])
        
        rows = conn.execute(query, params).fetchall()
        return [dict_from_row(row) for row in rows]


@app.post("/restorani", response_model=Restoran, status_code=status.HTTP_201_CREATED, tags=["Restorani"])
def create_restoran(
    restoran: Restoran,
    creator_id: int = Depends(get_creator_id),
    current_user: dict = Depends(get_current_user)
):
    """Create new restaurant - Admin and Vlasnik only"""
    # Zaposlenici CANNOT create restorani
    if current_user['role'] == 'zaposlenik':
        raise HTTPException(status_code=403, detail="Zaposlenici cannot create restorani")
    
    if current_user['role'] != 'admin':
        restoran.vlasnik_id = current_user['id']
    
    with get_db() as conn:
        cursor = conn.execute("""
            INSERT INTO restorani 
            (vlasnik_id, ime, opis, rucak_od, rucak_do, vecera_od, vecera_do, 
             max_osoba_rucak, max_osoba_vecera, creator_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (restoran.vlasnik_id, restoran.ime, restoran.opis, restoran.rucak_od,
              restoran.rucak_do, restoran.vecera_od, restoran.vecera_do,
              restoran.max_osoba_rucak, restoran.max_osoba_vecera, creator_id))
        
        restoran_id = cursor.lastrowid
        conn.commit()
        
        log_audit(conn, current_user['id'], current_user['ime'], current_user['role'],
                 'dodaj', 'restoran', restoran_id, restoran.ime, "Created")
        
        row = conn.execute("SELECT * FROM restorani WHERE id = ?", (restoran_id,)).fetchone()
        return dict_from_row(row)


@app.put("/restorani/{restoran_id}", response_model=Restoran, tags=["Restorani"])
def update_restoran(
    restoran_id: int,
    restoran: Restoran,
    current_user: dict = Depends(get_current_user)
):
    """Update restaurant"""
    with get_db() as conn:
        # Check exists
        existing = conn.execute("SELECT * FROM restorani WHERE id = ?", (restoran_id,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Restoran not found")
        
        # Permission check
        if current_user['role'] == 'admin':
            pass
        elif current_user['role'] == 'vlasnik':
            if existing['vlasnik_id'] != current_user['id']:
                raise HTTPException(status_code=403, detail="Access denied")
        elif current_user['role'] == 'zaposlenik':
            nadredeni_id = current_user.get('nadredeni_vlasnik_id')
            if existing['vlasnik_id'] != nadredeni_id:
                raise HTTPException(status_code=403, detail="Možete editirati samo restorane svog nadređenog")
        
        # Update
        conn.execute("""
            UPDATE restorani 
            SET ime=?, opis=?, rucak_od=?, rucak_do=?, vecera_od=?, vecera_do=?, 
                max_osoba_rucak=?, max_osoba_vecera=?
            WHERE id=?
        """, (restoran.ime, restoran.opis, restoran.rucak_od, restoran.rucak_do,
              restoran.vecera_od, restoran.vecera_do, restoran.max_osoba_rucak,
              restoran.max_osoba_vecera, restoran_id))
        
        conn.commit()
        
        log_audit(conn, current_user['id'], current_user['ime'], current_user['role'],
                 'uredi', 'restoran', restoran_id, restoran.ime, "Updated")
        
        row = conn.execute("SELECT * FROM restorani WHERE id = ?", (restoran_id,)).fetchone()
        return dict_from_row(row)


@app.delete("/restorani/{restoran_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Restorani"])
def delete_restoran(restoran_id: int, current_user: dict = Depends(get_current_user)):
    """Delete restaurant"""
    with get_db() as conn:
        restoran = conn.execute("SELECT * FROM restorani WHERE id = ?", (restoran_id,)).fetchone()
        if not restoran:
            raise HTTPException(status_code=404, detail="Restoran not found")
        
        if current_user['role'] != 'admin' and restoran['vlasnik_id'] != current_user['id']:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Check dependencies
        rez_count = conn.execute("SELECT COUNT(*) as c FROM stolovi_rezervacije WHERE restoran_id = ?", (restoran_id,)).fetchone()['c']
        if rez_count > 0:
            raise HTTPException(status_code=400, detail=f"Cannot delete: {rez_count} rezervacije exist")
        
        conn.execute("DELETE FROM restorani WHERE id = ?", (restoran_id,))
        conn.commit()
        
        log_audit(conn, current_user['id'], current_user['ime'], current_user['role'],
                 'obrisi', 'restoran', restoran_id, restoran['ime'], "Deleted")


# ============================================
# GOSTI CRUD
# ============================================

@app.get("/gosti", response_model=List[Gost], tags=["Gosti"])
def list_gosti(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """List guests"""
    with get_db() as conn:
        query = "SELECT * FROM gosti WHERE 1=1"
        params = []
        
        # Filter by vlasnik_id
        if current_user['role'] == 'admin':
            # Admin sees all guests
            pass
        elif current_user['role'] == 'vlasnik':
            # Vlasnik sees only their guests
            query += " AND vlasnik_id = ?"
            params.append(current_user['id'])
        elif current_user['role'] == 'zaposlenik':
            # Zaposlenik sees guests of their nadredeni vlasnik
            nadredeni_id = current_user.get('nadredeni_vlasnik_id')
            if not nadredeni_id:
                raise HTTPException(status_code=400, detail="Zaposlenik nema nadređenog vlasnika")
            query += " AND vlasnik_id = ?"
            params.append(nadredeni_id)
        
        # Search
        if search:
            query += " AND (naziv LIKE ? OR telefon LIKE ? OR email LIKE ?)"
            search_pattern = f"%{search}%"
            params.extend([search_pattern, search_pattern, search_pattern])
        
        query += " ORDER BY naziv LIMIT ? OFFSET ?"
        params.extend([limit, skip])
        
        rows = conn.execute(query, params).fetchall()
        return [dict_from_row(row) for row in rows]


@app.post("/gosti", response_model=Gost, status_code=status.HTTP_201_CREATED, tags=["Gosti"])
def create_gost(
    gost: Gost,
    creator_id: int = Depends(get_creator_id),
    current_user: dict = Depends(get_current_user)
):
    """Create new guest"""
    if current_user['role'] == 'admin':
        # Admin can set any vlasnik_id (from request)
        pass
    elif current_user['role'] == 'vlasnik':
        # Vlasnik sets themselves as owner
        gost.vlasnik_id = current_user['id']
    elif current_user['role'] == 'zaposlenik':
        # Zaposlenik sets their nadredeni_vlasnik as owner
        gost.vlasnik_id = current_user.get('nadredeni_vlasnik_id')
        if not gost.vlasnik_id:
            raise HTTPException(status_code=400, detail="Zaposlenik nema nadređenog vlasnika")
    
    with get_db() as conn:
        # Auto-populate ime_prezime if empty
        ime_prezime = gost.ime_prezime or gost.naziv
        
        cursor = conn.execute("""
            INSERT INTO gosti (vlasnik_id, naziv, ime_prezime, email, telefon, napomena, creator_id)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (gost.vlasnik_id, gost.naziv, ime_prezime, gost.email, gost.telefon, gost.napomena, creator_id))
        
        gost_id = cursor.lastrowid
        conn.commit()
        
        log_audit(conn, current_user['id'], current_user['ime'], current_user['role'],
                 'dodaj', 'gost', gost_id, gost.naziv, f"Tel: {gost.telefon}")
        
        row = conn.execute("SELECT * FROM gosti WHERE id = ?", (gost_id,)).fetchone()
        return dict_from_row(row)


@app.put("/gosti/{gost_id}", response_model=Gost, tags=["Gosti"])
def update_gost(
    gost_id: int,
    gost: Gost,
    current_user: dict = Depends(get_current_user)
):
    """Update guest"""
    with get_db() as conn:
        # Check exists
        existing = conn.execute("SELECT * FROM gosti WHERE id = ?", (gost_id,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Gost not found")
        
        # Permission check
        if current_user['role'] == 'admin':
            # Admin can update any guest
            pass
        elif current_user['role'] == 'vlasnik':
            # Vlasnik can update only their guests
            if existing['vlasnik_id'] != current_user['id']:
                raise HTTPException(status_code=403, detail="Access denied")
        elif current_user['role'] == 'zaposlenik':
            # Zaposlenik can update guests of their nadredeni vlasnik
            nadredeni_id = current_user.get('nadredeni_vlasnik_id')
            if existing['vlasnik_id'] != nadredeni_id:
                raise HTTPException(status_code=403, detail="Access denied")
        
        # Auto-populate ime_prezime if empty
        ime_prezime = gost.ime_prezime or gost.naziv
        
        # Update
        conn.execute("""
            UPDATE gosti 
            SET naziv=?, ime_prezime=?, email=?, telefon=?, napomena=?
            WHERE id=?
        """, (gost.naziv, ime_prezime, gost.email, gost.telefon, gost.napomena, gost_id))
        
        conn.commit()
        
        log_audit(conn, current_user['id'], current_user['ime'], current_user['role'],
                 'uredi', 'gost', gost_id, gost.naziv, f"Updated")
        
        row = conn.execute("SELECT * FROM gosti WHERE id = ?", (gost_id,)).fetchone()
        return dict_from_row(row)


@app.delete("/gosti/{gost_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Gosti"])
def delete_gost(gost_id: int, current_user: dict = Depends(get_current_user)):
    """Delete guest"""
    with get_db() as conn:
        gost = conn.execute("SELECT * FROM gosti WHERE id = ?", (gost_id,)).fetchone()
        if not gost:
            raise HTTPException(status_code=404, detail="Gost not found")
        
        # Permission check
        if current_user['role'] == 'admin':
            pass
        elif current_user['role'] == 'vlasnik':
            if gost['vlasnik_id'] != current_user['id']:
                raise HTTPException(status_code=403, detail="Access denied")
        elif current_user['role'] == 'zaposlenik':
            # Zaposlenik can delete guests of their nadredeni vlasnik
            nadredeni_id = current_user.get('nadredeni_vlasnik_id')
            if gost['vlasnik_id'] != nadredeni_id:
                raise HTTPException(status_code=403, detail="Access denied")
        
        # Check dependencies
        rez_count = conn.execute("SELECT COUNT(*) as c FROM rezervacije WHERE gost_id = ?", (gost_id,)).fetchone()['c']
        stolovi_count = conn.execute("SELECT COUNT(*) as c FROM stolovi_rezervacije WHERE gost_id = ?", (gost_id,)).fetchone()['c']
        
        if rez_count > 0 or stolovi_count > 0:
            raise HTTPException(status_code=400, detail=f"Cannot delete: {rez_count + stolovi_count} rezervacije exist")
        
        conn.execute("DELETE FROM gosti WHERE id = ?", (gost_id,))
        conn.commit()
        
        log_audit(conn, current_user['id'], current_user['ime'], current_user['role'],
                 'obrisi', 'gost', gost_id, gost['naziv'], "Deleted")


# ============================================
# REZERVACIJE (APARTMANI) CRUD
# ============================================

@app.get("/rezervacije", response_model=List[Rezervacija], tags=["Rezervacije"])
def list_rezervacije(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    apartman_id: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """List apartment reservations"""
    with get_db() as conn:
        query = """
            SELECT r.id, r.apartman_id, r.gost_id, r.od_datuma, r.do_datuma, 
                   r.cijena, COALESCE(r.status, 'na_čekanju') as status, r.napomena,
                   r.creator_id, r.created_at
            FROM rezervacije r
            JOIN apartmani a ON r.apartman_id = a.id
            WHERE 1=1
        """
        params = []
        
        # Filter by role and granular permissions
        if current_user['role'] == 'admin':
            # Admin sees all
            pass
        elif current_user['role'] == 'vlasnik':
            # Vlasnik sees their apartmani
            query += " AND a.vlasnik_id = ?"
            params.append(current_user['id'])
        elif current_user['role'] == 'zaposlenik':
            # Zaposlenik sees only rezervacije for apartmani they have access to
            accessible_apartman_ids = get_zaposlenik_accessible_objects(
                conn, current_user['id'], 'apartman', 'view'
            )
            if not accessible_apartman_ids:
                # No access to any apartmani
                return []
            
            query += f" AND r.apartman_id IN ({','.join('?' * len(accessible_apartman_ids))})"
            params.extend(accessible_apartman_ids)
        
        # Filter by apartman
        if apartman_id:
            query += " AND r.apartman_id = ?"
            params.append(apartman_id)
        
        query += " ORDER BY r.od_datuma DESC LIMIT ? OFFSET ?"
        params.extend([limit, skip])
        
        rows = conn.execute(query, params).fetchall()
        return [dict_from_row(row) for row in rows]


@app.post("/rezervacije", response_model=Rezervacija, status_code=status.HTTP_201_CREATED, tags=["Rezervacije"])
def create_rezervacija(
    rezervacija: Rezervacija,
    creator_id: int = Depends(get_creator_id),
    current_user: dict = Depends(get_current_user)
):
    """Create apartment reservation"""
    with get_db() as conn:
        # Check access to apartman
        apartman = conn.execute("SELECT * FROM apartmani WHERE id = ?", (rezervacija.apartman_id,)).fetchone()
        if not apartman:
            raise HTTPException(status_code=404, detail="Apartman not found")
        
        # Permission check
        if current_user['role'] == 'admin':
            pass
        elif current_user['role'] == 'vlasnik':
            if apartman['vlasnik_id'] != current_user['id']:
                raise HTTPException(status_code=403, detail="Access denied")
        elif current_user['role'] == 'zaposlenik':
            # Zaposlenik can create for apartments of their nadredeni vlasnik
            nadredeni_id = current_user.get('nadredeni_vlasnik_id')
            if apartman['vlasnik_id'] != nadredeni_id:
                raise HTTPException(status_code=403, detail="Access denied")
        
        cursor = conn.execute("""
            INSERT INTO rezervacije 
            (apartman_id, gost_id, od_datuma, do_datuma, cijena, status, napomena, creator_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (rezervacija.apartman_id, rezervacija.gost_id, rezervacija.od_datuma.isoformat(),
              rezervacija.do_datuma.isoformat(), rezervacija.cijena, rezervacija.status, rezervacija.napomena, creator_id))
        
        rez_id = cursor.lastrowid
        conn.commit()
        
        log_audit(conn, current_user['id'], current_user['ime'], current_user['role'],
                 'dodaj', 'rezervacija', rez_id, apartman['ime'], 
                 f"{rezervacija.od_datuma} - {rezervacija.do_datuma}")
        
        row = conn.execute("SELECT * FROM rezervacije WHERE id = ?", (rez_id,)).fetchone()
        return dict_from_row(row)


@app.put("/rezervacije/{rez_id}", response_model=Rezervacija, tags=["Rezervacije"])
def update_rezervacija(
    rez_id: int,
    rezervacija: Rezervacija,
    current_user: dict = Depends(get_current_user)
):
    """Update apartment reservation"""
    with get_db() as conn:
        # Get existing reservation
        existing = conn.execute("SELECT * FROM rezervacije WHERE id = ?", (rez_id,)).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Reservation not found")
        
        # Check access to apartman
        apartman = conn.execute("SELECT * FROM apartmani WHERE id = ?", (rezervacija.apartman_id,)).fetchone()
        if not apartman:
            raise HTTPException(status_code=404, detail="Apartman not found")
        
        # Permission check
        if current_user['role'] == 'admin':
            pass
        elif current_user['role'] == 'vlasnik':
            if apartman['vlasnik_id'] != current_user['id']:
                raise HTTPException(status_code=403, detail="Access denied")
        elif current_user['role'] == 'zaposlenik':
            # Zaposlenik can update for apartments of their nadredeni vlasnik
            nadredeni_id = current_user.get('nadredeni_vlasnik_id')
            if apartman['vlasnik_id'] != nadredeni_id:
                raise HTTPException(status_code=403, detail="Access denied")
        
        conn.execute("""
            UPDATE rezervacije 
            SET apartman_id = ?, gost_id = ?, od_datuma = ?, do_datuma = ?, 
                cijena = ?, status = ?, napomena = ?
            WHERE id = ?
        """, (rezervacija.apartman_id, rezervacija.gost_id, rezervacija.od_datuma.isoformat(),
              rezervacija.do_datuma.isoformat(), rezervacija.cijena, rezervacija.status, rezervacija.napomena, rez_id))
        
        conn.commit()
        
        log_audit(conn, current_user['id'], current_user['ime'], current_user['role'],
                 'uredi', 'rezervacija', rez_id, apartman['ime'], 
                 f"{rezervacija.od_datuma} - {rezervacija.do_datuma}")
        
        row = conn.execute("SELECT * FROM rezervacije WHERE id = ?", (rez_id,)).fetchone()
        return dict_from_row(row)


@app.delete("/rezervacije/{rez_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Rezervacije"])
def delete_rezervacija(rez_id: int, current_user: dict = Depends(get_current_user)):
    """Delete apartment reservation"""
    with get_db() as conn:
        rez = conn.execute("""
            SELECT r.*, a.ime as apartman_ime, a.vlasnik_id
            FROM rezervacije r
            JOIN apartmani a ON r.apartman_id = a.id
            WHERE r.id = ?
        """, (rez_id,)).fetchone()
        
        if not rez:
            raise HTTPException(status_code=404, detail="Rezervacija not found")
        
        if current_user['role'] != 'admin' and rez['vlasnik_id'] != current_user['id']:
            raise HTTPException(status_code=403, detail="Access denied")
        
        conn.execute("DELETE FROM rezervacije WHERE id = ?", (rez_id,))
        conn.commit()
        
        log_audit(conn, current_user['id'], current_user['ime'], current_user['role'],
                 'obrisi', 'rezervacija', rez_id, rez['apartman_ime'], "Deleted")


@app.patch("/rezervacije/{rez_id}/status", tags=["Rezervacije"])
def update_apartman_rezervacija_status(
    rez_id: int,
    status: StatusRezervacije = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Update apartment reservation status"""
    with get_db() as conn:
        rez = conn.execute("""
            SELECT r.*, a.vlasnik_id, a.ime as apartman_ime
            FROM rezervacije r
            JOIN apartmani a ON r.apartman_id = a.id
            WHERE r.id = ?
        """, (rez_id,)).fetchone()
        
        if not rez:
            raise HTTPException(status_code=404, detail="Rezervacija not found")
        
        # Permission check
        if current_user['role'] == 'admin':
            pass
        elif current_user['role'] == 'vlasnik':
            if rez['vlasnik_id'] != current_user['id']:
                raise HTTPException(status_code=403, detail="Access denied")
        elif current_user['role'] == 'zaposlenik':
            # Zaposlenik can update status for nadredeni's reservations
            nadredeni_id = current_user.get('nadredeni_vlasnik_id')
            if rez['vlasnik_id'] != nadredeni_id:
                raise HTTPException(status_code=403, detail="Access denied")
        
        conn.execute("UPDATE rezervacije SET status = ? WHERE id = ?", (status.value, rez_id))
        conn.commit()
        
        log_audit(conn, current_user['id'], current_user['ime'], current_user['role'],
                 'uredi', 'rezervacija_apartman', rez_id, rez['apartman_ime'], f"Status: {status.value}")
        
        return {"message": "Status updated", "new_status": status.value}


# ============================================
# STOLOVI REZERVACIJE CRUD
# ============================================

@app.get("/stolovi-rezervacije", response_model=List[StoloviRezervacija], tags=["Stolovi Rezervacije"])
def list_stolovi_rezervacije(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    restoran_id: Optional[int] = None,
    status: Optional[StatusRezervacije] = None,
    datum_od: Optional[date] = None,
    datum_do: Optional[date] = None,
    current_user: dict = Depends(get_current_user)
):
    """List table reservations"""
    with get_db() as conn:
        query = """
            SELECT sr.* FROM stolovi_rezervacije sr
            JOIN restorani r ON sr.restoran_id = r.id
            WHERE 1=1
        """
        params = []
        
        # Filter by role and granular permissions
        if current_user['role'] == 'admin':
            # Admin sees all
            pass
        elif current_user['role'] == 'vlasnik':
            # Vlasnik sees their restorani
            query += " AND r.vlasnik_id = ?"
            params.append(current_user['id'])
        elif current_user['role'] == 'zaposlenik':
            # Zaposlenik sees only rezervacije for restorani they have access to
            accessible_restoran_ids = get_zaposlenik_accessible_objects(
                conn, current_user['id'], 'restoran', 'view'
            )
            if not accessible_restoran_ids:
                # No access to any restorani
                return []
            
            query += f" AND sr.restoran_id IN ({','.join('?' * len(accessible_restoran_ids))})"
            params.extend(accessible_restoran_ids)
        
        # Filters
        if restoran_id:
            query += " AND sr.restoran_id = ?"
            params.append(restoran_id)
        
        if status:
            query += " AND sr.status = ?"
            params.append(status.value)
        
        if datum_od:
            query += " AND sr.datum >= ?"
            params.append(datum_od.isoformat())
        
        if datum_do:
            query += " AND sr.datum <= ?"
            params.append(datum_do.isoformat())
        
        query += " ORDER BY sr.datum DESC, sr.od_vremena DESC LIMIT ? OFFSET ?"
        params.extend([limit, skip])
        
        rows = conn.execute(query, params).fetchall()
        return [dict_from_row(row) for row in rows]


@app.post("/stolovi-rezervacije/check-availability", tags=["Stolovi Rezervacije"])
def check_availability(
    restoran_id: int,
    datum: str,
    od_vremena: str,
    do_vremena: str,
    broj_osoba: int,
    exclude_reservation_id: Optional[int] = None,  # For editing existing reservation
    current_user: dict = Depends(get_current_user)
):
    """
    Check table availability for given date/time
    Returns available seats and whether reservation is possible
    """
    with get_db() as conn:
        # Get restaurant details
        restoran = conn.execute("SELECT * FROM restorani WHERE id = ?", (restoran_id,)).fetchone()
        if not restoran:
            raise HTTPException(status_code=404, detail="Restaurant not found")
        
        # Determine if this is lunch or dinner based on time
        is_lunch = od_vremena >= restoran['rucak_od'] and od_vremena < restoran['rucak_do']
        is_dinner = od_vremena >= restoran['vecera_od'] and od_vremena < restoran['vecera_do']
        
        # Get max capacity for this time slot
        if is_lunch:
            max_capacity = restoran['max_osoba_rucak']
            time_slot = "ručak"
        elif is_dinner:
            max_capacity = restoran['max_osoba_vecera']
            time_slot = "večera"
        else:
            return {
                "available": False,
                "available_seats": 0,
                "max_capacity": 0,
                "message": f"Restoran ne radi u ovom terminu. Radno vrijeme: ručak {restoran['rucak_od']}-{restoran['rucak_do']}, večera {restoran['vecera_od']}-{restoran['vecera_do']}"
            }
        
        # Get all overlapping reservations for this date/time
        # Two reservations overlap if: (start1 < end2) AND (end1 > start2)
        query = """
            SELECT SUM(broj_osoba) as reserved_seats
            FROM stolovi_rezervacije
            WHERE restoran_id = ?
            AND datum = ?
            AND status != 'otkazana'
            AND (
                (od_vremena < ? AND do_vremena > ?)
                OR (od_vremena < ? AND do_vremena > ?)
                OR (od_vremena >= ? AND do_vremena <= ?)
            )
        """
        params = [restoran_id, datum, do_vremena, od_vremena, do_vremena, od_vremena, od_vremena, do_vremena]
        
        # Exclude current reservation if editing
        if exclude_reservation_id:
            query += " AND id != ?"
            params.append(exclude_reservation_id)
        
        result = conn.execute(query, params).fetchone()
        reserved_seats = result['reserved_seats'] or 0
        
        available_seats = max_capacity - reserved_seats
        can_accommodate = available_seats >= broj_osoba
        
        return {
            "available": can_accommodate,
            "available_seats": available_seats,
            "max_capacity": max_capacity,
            "reserved_seats": reserved_seats,
            "time_slot": time_slot,
            "message": f"Dostupno {available_seats} od {max_capacity} mjesta za {time_slot}" if can_accommodate 
                      else f"Nema dovoljno mjesta. Dostupno {available_seats} mjesta, zatraženo {broj_osoba}"
        }


@app.post("/stolovi-rezervacije", response_model=StoloviRezervacija, status_code=status.HTTP_201_CREATED, tags=["Stolovi Rezervacije"])
def create_stolovi_rezervacija(
    rezervacija: StoloviRezervacija,
    creator_id: int = Depends(get_creator_id),
    current_user: dict = Depends(get_current_user)
):
    """Create table reservation"""
    with get_db() as conn:
        # Check access to restaurant
        restoran = conn.execute("SELECT * FROM restorani WHERE id = ?", (rezervacija.restoran_id,)).fetchone()
        if not restoran:
            raise HTTPException(status_code=404, detail="Restoran not found")
        
        # Permission check
        if current_user['role'] == 'admin':
            pass
        elif current_user['role'] == 'vlasnik':
            if restoran['vlasnik_id'] != current_user['id']:
                raise HTTPException(status_code=403, detail="Access denied")
        elif current_user['role'] == 'zaposlenik':
            # Zaposlenik must have 'create' permission for this restoran
            if not check_zaposlenik_objekt_access(
                conn, current_user['id'], 'restoran', rezervacija.restoran_id, 'create'
            ):
                raise HTTPException(status_code=403, detail="Nemate pristup ovom restoranu")
        
        # Check availability before creating
        availability = check_availability(
            restoran_id=rezervacija.restoran_id,
            datum=rezervacija.datum.isoformat(),
            od_vremena=rezervacija.od_vremena,
            do_vremena=rezervacija.do_vremena,
            broj_osoba=rezervacija.broj_osoba,
            exclude_reservation_id=None,
            current_user=current_user
        )
        
        if not availability['available']:
            raise HTTPException(
                status_code=400, 
                detail=availability['message']
            )
        
        cursor = conn.execute("""
            INSERT INTO stolovi_rezervacije 
            (restoran_id, gost_id, datum, od_vremena, do_vremena, broj_osoba, 
             status, napomena, creator_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (rezervacija.restoran_id, rezervacija.gost_id, rezervacija.datum.isoformat(),
              rezervacija.od_vremena, rezervacija.do_vremena, rezervacija.broj_osoba,
              rezervacija.status, rezervacija.napomena, creator_id))
        
        rez_id = cursor.lastrowid
        conn.commit()
        
        log_audit(conn, current_user['id'], current_user['ime'], current_user['role'],
                 'dodaj', 'rezervacija_stola', rez_id, f"{restoran['ime']}", 
                 f"{rezervacija.datum}, {rezervacija.broj_osoba} os.")
        
        row = conn.execute("SELECT * FROM stolovi_rezervacije WHERE id = ?", (rez_id,)).fetchone()
        return dict_from_row(row)


@app.patch("/stolovi-rezervacije/{rez_id}/status", tags=["Stolovi Rezervacije"])
def update_rezervacija_status(
    rez_id: int,
    status: StatusRezervacije = Query(...),
    current_user: dict = Depends(get_current_user)
):
    """Update reservation status"""
    with get_db() as conn:
        rez = conn.execute("""
            SELECT sr.*, r.vlasnik_id 
            FROM stolovi_rezervacije sr
            JOIN restorani r ON sr.restoran_id = r.id
            WHERE sr.id = ?
        """, (rez_id,)).fetchone()
        
        if not rez:
            raise HTTPException(status_code=404, detail="Rezervacija not found")
        
        # Permission check
        if current_user['role'] == 'admin':
            pass
        elif current_user['role'] == 'vlasnik':
            if rez['vlasnik_id'] != current_user['id']:
                raise HTTPException(status_code=403, detail="Access denied")
        elif current_user['role'] == 'zaposlenik':
            # Zaposlenik can update status for nadredeni's reservations
            nadredeni_id = current_user.get('nadredeni_vlasnik_id')
            if rez['vlasnik_id'] != nadredeni_id:
                raise HTTPException(status_code=403, detail="Access denied")
        
        conn.execute("UPDATE stolovi_rezervacije SET status = ? WHERE id = ?", (status.value, rez_id))
        conn.commit()
        
        log_audit(conn, current_user['id'], current_user['ime'], current_user['role'],
                 'uredi', 'rezervacija_stola', rez_id, f"Status", f"Changed to {status.value}")
        
        return {"message": "Status updated", "new_status": status.value}


@app.put("/stolovi-rezervacije/{rez_id}", response_model=StoloviRezervacija, tags=["Stolovi Rezervacije"])
def update_stolovi_rezervacija(
    rez_id: int,
    rezervacija: StoloviRezervacija,
    current_user: dict = Depends(get_current_user)
):
    """Update table reservation"""
    with get_db() as conn:
        # Check exists and get vlasnik_id
        existing = conn.execute("""
            SELECT sr.*, r.vlasnik_id 
            FROM stolovi_rezervacije sr
            JOIN restorani r ON sr.restoran_id = r.id
            WHERE sr.id = ?
        """, (rez_id,)).fetchone()
        
        if not existing:
            raise HTTPException(status_code=404, detail="Rezervacija not found")
        
        # Permission check
        if current_user['role'] == 'admin':
            pass
        elif current_user['role'] == 'vlasnik':
            if existing['vlasnik_id'] != current_user['id']:
                raise HTTPException(status_code=403, detail="Access denied")
        elif current_user['role'] == 'zaposlenik':
            nadredeni_id = current_user.get('nadredeni_vlasnik_id')
            if existing['vlasnik_id'] != nadredeni_id:
                raise HTTPException(status_code=403, detail="Access denied")
        
        # Check availability before updating (exclude current reservation)
        availability = check_availability(
            restoran_id=rezervacija.restoran_id,
            datum=rezervacija.datum.isoformat(),
            od_vremena=rezervacija.od_vremena,
            do_vremena=rezervacija.do_vremena,
            broj_osoba=rezervacija.broj_osoba,
            exclude_reservation_id=rez_id,  # Don't count current reservation
            current_user=current_user
        )
        
        if not availability['available']:
            raise HTTPException(
                status_code=400,
                detail=availability['message']
            )
        
        # Update
        conn.execute("""
            UPDATE stolovi_rezervacije 
            SET restoran_id=?, gost_id=?, datum=?, od_vremena=?, do_vremena=?, 
                broj_osoba=?, status=?, napomena=?
            WHERE id=?
        """, (rezervacija.restoran_id, rezervacija.gost_id, rezervacija.datum.isoformat(),
              rezervacija.od_vremena, rezervacija.do_vremena, rezervacija.broj_osoba,
              rezervacija.status, rezervacija.napomena, rez_id))
        
        conn.commit()
        
        log_audit(conn, current_user['id'], current_user['ime'], current_user['role'],
                 'uredi', 'rezervacija_stola', rez_id, f"Rezervacija", "Updated")
        
        row = conn.execute("SELECT * FROM stolovi_rezervacije WHERE id = ?", (rez_id,)).fetchone()
        return dict_from_row(row)


@app.delete("/stolovi-rezervacije/{rez_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["Stolovi Rezervacije"])
def delete_stolovi_rezervacija(rez_id: int, current_user: dict = Depends(get_current_user)):
    """Delete table reservation"""
    with get_db() as conn:
        rez = conn.execute("""
            SELECT sr.*, r.vlasnik_id, r.ime as restoran_ime
            FROM stolovi_rezervacije sr
            JOIN restorani r ON sr.restoran_id = r.id
            WHERE sr.id = ?
        """, (rez_id,)).fetchone()
        
        if not rez:
            raise HTTPException(status_code=404, detail="Rezervacija not found")
        
        if current_user['role'] != 'admin' and rez['vlasnik_id'] != current_user['id']:
            raise HTTPException(status_code=403, detail="Access denied")
        
        conn.execute("DELETE FROM stolovi_rezervacije WHERE id = ?", (rez_id,))
        conn.commit()
        
        log_audit(conn, current_user['id'], current_user['ime'], current_user['role'],
                 'obrisi', 'rezervacija_stola', rez_id, rez['restoran_ime'], "Deleted")


# ============================================
# BULK OPERATIONS
# ============================================

@app.post("/bulk/approve-pending", tags=["Bulk Operations"])
def bulk_approve_pending(
    restoran_id: Optional[int] = None,
    current_user: dict = Depends(get_current_user)
):
    """Bulk approve all pending reservations"""
    with get_db() as conn:
        query = """
            UPDATE stolovi_rezervacije
            SET status = 'potvrđena'
            WHERE status = 'na_čekanju'
        """
        params = []
        
        if current_user['role'] != 'admin':
            query += """ AND restoran_id IN (
                SELECT id FROM restorani WHERE vlasnik_id = ?
            )"""
            params.append(current_user['id'])
        elif restoran_id:
            query += " AND restoran_id = ?"
            params.append(restoran_id)
        
        cursor = conn.execute(query, params)
        count = cursor.rowcount
        conn.commit()
        
        log_audit(conn, current_user['id'], current_user['ime'], current_user['role'],
                 'uredi', 'rezervacija_stola', None, "Bulk approve", f"{count} approved")
        
        return {"message": f"Approved {count} reservations"}


# ============================================
# STATISTICS
# ============================================

@app.get("/stats/overview", tags=["Statistics"])
def get_stats_overview(current_user: dict = Depends(get_current_user)):
    """Get system statistics"""
    with get_db() as conn:
        if current_user['role'] == 'admin':
            stats = {
                "vlasnici": conn.execute("SELECT COUNT(*) as c FROM vlasnici WHERE role='vlasnik'").fetchone()['c'],
                "apartmani": conn.execute("SELECT COUNT(*) as c FROM apartmani").fetchone()['c'],
                "restorani": conn.execute("SELECT COUNT(*) as c FROM restorani").fetchone()['c'],
                "gosti": conn.execute("SELECT COUNT(*) as c FROM gosti").fetchone()['c'],
                "rezervacije_apartmana": conn.execute("SELECT COUNT(*) as c FROM rezervacije").fetchone()['c'],
                "rezervacije_stolova": conn.execute("SELECT COUNT(*) as c FROM stolovi_rezervacije").fetchone()['c'],
            }
        else:
            vlasnik_id = current_user['id']
            stats = {
                "apartmani": conn.execute("SELECT COUNT(*) as c FROM apartmani WHERE vlasnik_id=?", (vlasnik_id,)).fetchone()['c'],
                "restorani": conn.execute("SELECT COUNT(*) as c FROM restorani WHERE vlasnik_id=?", (vlasnik_id,)).fetchone()['c'],
                "gosti": conn.execute("SELECT COUNT(*) as c FROM gosti WHERE vlasnik_id=?", (vlasnik_id,)).fetchone()['c'],
            }
        
        return stats


# ============================================
# AUDIT LOG
# ============================================

@app.get("/audit-log", tags=["Audit"])
def get_audit_log(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    akcija: Optional[str] = None,
    entitet_tip: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    """Get audit log - Admin sees all, Vlasnik sees only their actions"""
    with get_db() as conn:
        query = "SELECT * FROM audit_log WHERE 1=1"
        params = []
        
        # Filter based on role
        if current_user['role'] == 'vlasnik':
            # Vlasnik sees their own actions + their zaposlenici's actions
            # Get list of zaposlenik IDs
            zaposlenik_ids = [row['id'] for row in conn.execute("""
                SELECT id FROM vlasnici 
                WHERE role = 'zaposlenik' AND nadredeni_vlasnik_id = ?
            """, (current_user['id'],)).fetchall()]
            
            # Include vlasnik ID + all zaposlenik IDs
            all_ids = [current_user['id']] + zaposlenik_ids
            
            if len(all_ids) == 1:
                query += " AND korisnik_id = ?"
                params.append(all_ids[0])
            else:
                placeholders = ','.join(['?'] * len(all_ids))
                query += f" AND korisnik_id IN ({placeholders})"
                params.extend(all_ids)
        elif current_user['role'] == 'zaposlenik':
            # Zaposlenik sees only their own actions
            query += " AND korisnik_id = ?"
            params.append(current_user['id'])
        # else: admin sees all
        
        # Filters
        if akcija:
            query += " AND akcija = ?"
            params.append(akcija)
        
        if entitet_tip:
            query += " AND entitet_tip = ?"
            params.append(entitet_tip)
        
        query += " ORDER BY timestamp DESC LIMIT ? OFFSET ?"
        params.extend([limit, skip])
        
        rows = conn.execute(query, params).fetchall()
        return [dict_from_row(row) for row in rows]


# ============================================
# EXPORT/IMPORT
# ============================================

@app.get("/export", response_model=SystemData, tags=["Export/Import"])
def export_data(current_user: dict = Depends(get_current_user)):
    """Export all data (filtered by access)"""
    with get_db() as conn:
        data = {
            "vlasnici": [],
            "moduli": [],
            "vlasnik_moduli": [],
            "zaposlenik_objekti": [],  # ← NOVO!
            "apartmani": [],
            "restorani": [],
            "gosti": [],
            "stolovi_rezervacije": [],
            "rezervacije": [],
            "cijene_apartmana": [],
            "postavke_vlasnika": [],
            "audit_log": [],
            "spam_log": [],
            "blocked_ips": []
        }
        
        # Determine access scope
        if current_user['role'] == 'admin':
            # Admin exports everything
            data['vlasnici'] = [dict_from_row(r) for r in conn.execute("SELECT * FROM vlasnici").fetchall()]
            data['moduli'] = [dict_from_row(r) for r in conn.execute("SELECT * FROM moduli").fetchall()]
            data['vlasnik_moduli'] = [dict_from_row(r) for r in conn.execute("SELECT * FROM vlasnik_moduli").fetchall()]
            data['zaposlenik_objekti'] = [dict_from_row(r) for r in conn.execute("SELECT * FROM zaposlenik_objekti").fetchall()]  # ← NOVO!
            data['apartmani'] = [dict_from_row(r) for r in conn.execute("SELECT * FROM apartmani").fetchall()]
            data['restorani'] = [dict_from_row(r) for r in conn.execute("SELECT * FROM restorani").fetchall()]
            data['gosti'] = [dict_from_row(r) for r in conn.execute("SELECT * FROM gosti").fetchall()]
            data['audit_log'] = [dict_from_row(r) for r in conn.execute("SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 1000").fetchall()]
        else:
            # Vlasnik exports only their data
            vlasnik_id = current_user['id']
            
            # Export moduli table (needed for import)
            data['moduli'] = [dict_from_row(r) for r in conn.execute("SELECT * FROM moduli").fetchall()]
            
            # Export vlasnik's own record
            data['vlasnici'] = [dict_from_row(r) for r in conn.execute(
                "SELECT * FROM vlasnici WHERE id=?", (vlasnik_id,)
            ).fetchall()]
            
            # Export vlasnik's zaposlenici
            zaposlenici = [dict_from_row(r) for r in conn.execute(
                "SELECT * FROM vlasnici WHERE role='zaposlenik' AND nadredeni_vlasnik_id=?", (vlasnik_id,)
            ).fetchall()]
            data['vlasnici'].extend(zaposlenici)
            
            # Export module assignments (vlasnik + zaposlenici)
            zaposlenik_ids = [z['id'] for z in zaposlenici]
            all_user_ids = [vlasnik_id] + zaposlenik_ids
            
            if len(all_user_ids) == 1:
                data['vlasnik_moduli'] = [dict_from_row(r) for r in conn.execute(
                    "SELECT * FROM vlasnik_moduli WHERE vlasnik_id=?", (all_user_ids[0],)
                ).fetchall()]
            else:
                placeholders = ','.join(['?'] * len(all_user_ids))
                data['vlasnik_moduli'] = [dict_from_row(r) for r in conn.execute(
                    f"SELECT * FROM vlasnik_moduli WHERE vlasnik_id IN ({placeholders})", all_user_ids
                ).fetchall()]
            
            # Export zaposlenik objekti permissions (only for zaposlenici)
            if zaposlenik_ids:
                placeholders_zap = ','.join(['?'] * len(zaposlenik_ids))
                data['zaposlenik_objekti'] = [dict_from_row(r) for r in conn.execute(
                    f"SELECT * FROM zaposlenik_objekti WHERE zaposlenik_id IN ({placeholders_zap})", zaposlenik_ids
                ).fetchall()]
            
            # Export apartmani
            data['apartmani'] = [dict_from_row(r) for r in conn.execute(
                "SELECT * FROM apartmani WHERE vlasnik_id=?", (vlasnik_id,)
            ).fetchall()]
            
            # Export restorani
            data['restorani'] = [dict_from_row(r) for r in conn.execute(
                "SELECT * FROM restorani WHERE vlasnik_id=?", (vlasnik_id,)
            ).fetchall()]
            
            # Export gosti
            data['gosti'] = [dict_from_row(r) for r in conn.execute(
                "SELECT * FROM gosti WHERE vlasnik_id=?", (vlasnik_id,)
            ).fetchall()]
            
            # Export reservations for vlasnik's apartments
            data['rezervacije'] = [dict_from_row(r) for r in conn.execute("""
                SELECT rez.* FROM rezervacije rez
                JOIN apartmani a ON rez.apartman_id = a.id
                WHERE a.vlasnik_id = ?
            """, (vlasnik_id,)).fetchall()]
            
            # Export table reservations for vlasnik's restaurants
            data['stolovi_rezervacije'] = [dict_from_row(r) for r in conn.execute("""
                SELECT sr.* FROM stolovi_rezervacije sr
                JOIN restorani r ON sr.restoran_id = r.id
                WHERE r.vlasnik_id = ?
            """, (vlasnik_id,)).fetchall()]
            
            # Export cijene apartmana
            if data['apartmani']:
                apt_ids = [a['id'] for a in data['apartmani']]
                if len(apt_ids) == 1:
                    data['cijene_apartmana'] = [dict_from_row(r) for r in conn.execute(
                        "SELECT * FROM cijene_apartmana WHERE apartman_id=?", (apt_ids[0],)
                    ).fetchall()]
                else:
                    placeholders = ','.join(['?'] * len(apt_ids))
                    data['cijene_apartmana'] = [dict_from_row(r) for r in conn.execute(
                        f"SELECT * FROM cijene_apartmana WHERE apartman_id IN ({placeholders})", apt_ids
                    ).fetchall()]
            
            # Export audit log (vlasnik + zaposlenici actions)
            if len(all_user_ids) == 1:
                data['audit_log'] = [dict_from_row(r) for r in conn.execute(
                    "SELECT * FROM audit_log WHERE korisnik_id=? ORDER BY timestamp DESC LIMIT 1000", 
                    (all_user_ids[0],)
                ).fetchall()]
            else:
                placeholders = ','.join(['?'] * len(all_user_ids))
                data['audit_log'] = [dict_from_row(r) for r in conn.execute(
                    f"SELECT * FROM audit_log WHERE korisnik_id IN ({placeholders}) ORDER BY timestamp DESC LIMIT 1000", 
                    all_user_ids
                ).fetchall()]
        
        return data


@app.post("/import", tags=["Export/Import"])
def import_data(
    data: SystemData,
    current_user: dict = Depends(get_current_user)
):
    """Import data - OVERWRITES existing data (admin and vlasnik only)"""
    # Permission check
    if current_user['role'] not in ['admin', 'vlasnik']:
        raise HTTPException(status_code=403, detail="Only admin and vlasnik can import data")
    
    # Convert Pydantic models to dicts for easier access
    data_dict = data.model_dump()
    
    with get_db() as conn:
        if current_user['role'] == 'admin':
            # Admin can import everything - FULL WIPE AND RESTORE
            # WARNING: This deletes ALL data!
            
            # Delete all data (in reverse dependency order)
            conn.execute("DELETE FROM audit_log")
            conn.execute("DELETE FROM stolovi_rezervacije")
            conn.execute("DELETE FROM rezervacije")
            conn.execute("DELETE FROM cijene_apartmana")
            conn.execute("DELETE FROM gosti")
            conn.execute("DELETE FROM apartmani")
            conn.execute("DELETE FROM restorani")
            conn.execute("DELETE FROM vlasnik_moduli WHERE vlasnik_id != ?", (current_user['id'],))
            conn.execute("DELETE FROM vlasnici WHERE role != 'admin' OR id != ?", (current_user['id'],))
            # Keep current admin to avoid locking out
            
            # Import moduli (if provided)
            for modul in data_dict.get("moduli", []):
                conn.execute("""
                    INSERT OR REPLACE INTO moduli (id, naziv, opis, ikona, aktivan)
                    VALUES (?, ?, ?, ?, ?)
                """, (modul.get('id'), modul.get('naziv'), modul.get('opis'),
                      modul.get('ikona'), modul.get('aktivan', True)))
            
            # Import vlasnici (except current admin)
            for vlasnik in data_dict.get("vlasnici", []):
                if vlasnik.get('id') == current_user['id']:
                    continue  # Skip current admin
                conn.execute("""
                    INSERT OR REPLACE INTO vlasnici (id, ime, email, lozinka, role, nadredeni_vlasnik_id)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (vlasnik.get('id'), vlasnik.get('ime'), vlasnik.get('email'),
                      vlasnik.get('lozinka'), vlasnik.get('role'), vlasnik.get('nadredeni_vlasnik_id')))
            
            # Import vlasnik_moduli (after vlasnici and moduli)
            for vm in data_dict.get("vlasnik_moduli", []):
                if vm.get('vlasnik_id') == current_user['id']:
                    continue  # Keep current admin modules
                conn.execute("""
                    INSERT OR REPLACE INTO vlasnik_moduli (id, vlasnik_id, modul_id)
                    VALUES (?, ?, ?)
                """, (vm.get('id'), vm.get('vlasnik_id'), vm.get('modul_id')))
            
            # Import zaposlenik_objekti (after vlasnici)
            for zo in data_dict.get("zaposlenik_objekti", []):
                conn.execute("""
                    INSERT OR REPLACE INTO zaposlenik_objekti 
                    (id, zaposlenik_id, objekt_type, objekt_id, can_view, can_edit, can_create, can_delete, creator_id, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (zo.get('id'), zo.get('zaposlenik_id'), zo.get('objekt_type'), zo.get('objekt_id'),
                      zo.get('can_view', True), zo.get('can_edit', True), zo.get('can_create', True), 
                      zo.get('can_delete', False), zo.get('creator_id'), zo.get('created_at')))
            
            # Import apartmani
            for apt in data_dict.get("apartmani", []):
                conn.execute("""
                    INSERT OR REPLACE INTO apartmani 
                    (id, vlasnik_id, ime, kapacitet, opis, creator_id, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (apt.get('id'), apt.get('vlasnik_id'), apt.get('ime'), 
                      apt.get('kapacitet') or apt.get('broj_kreveta') or 1,  # Fallback to broj_kreveta if kapacitet missing
                      apt.get('opis'), apt.get('creator_id'), apt.get('created_at')))
            
            # Import restorani
            for rest in data_dict.get("restorani", []):
                conn.execute("""
                    INSERT OR REPLACE INTO restorani 
                    (id, vlasnik_id, ime, opis, rucak_od, rucak_do, vecera_od, vecera_do,
                     max_osoba_rucak, max_osoba_vecera, creator_id, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (rest.get('id'), rest.get('vlasnik_id'), rest.get('ime'), rest.get('opis'),
                      rest.get('rucak_od'), rest.get('rucak_do'), rest.get('vecera_od'),
                      rest.get('vecera_do'), rest.get('max_osoba_rucak'),
                      rest.get('max_osoba_vecera'), rest.get('creator_id'),
                      rest.get('created_at')))
            
            # Import gosti
            for gost in data_dict.get("gosti", []):
                conn.execute("""
                    INSERT OR REPLACE INTO gosti 
                    (id, vlasnik_id, naziv, ime_prezime, email, telefon, napomena, creator_id, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (gost.get('id'), gost.get('vlasnik_id'), gost.get('naziv'),
                      gost.get('ime_prezime'), gost.get('email'), gost.get('telefon'),
                      gost.get('napomena'), gost.get('creator_id'),
                      gost.get('created_at')))
            
            # Import rezervacije
            for rez in data_dict.get("rezervacije", []):
                conn.execute("""
                    INSERT OR REPLACE INTO rezervacije 
                    (id, apartman_id, gost_id, od_datuma, do_datuma, cijena, napomena, creator_id, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (rez.get('id'), rez.get('apartman_id'), rez.get('gost_id'),
                      rez.get('od_datuma'), rez.get('do_datuma'), rez.get('cijena'),
                      rez.get('napomena'), rez.get('creator_id'),
                      rez.get('created_at')))
            
            # Import stolovi_rezervacije
            for sr in data_dict.get("stolovi_rezervacije", []):
                conn.execute("""
                    INSERT OR REPLACE INTO stolovi_rezervacije 
                    (id, restoran_id, gost_id, datum, od_vremena, do_vremena, broj_osoba,
                     status, napomena, creator_id, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (sr.get('id'), sr.get('restoran_id'), sr.get('gost_id'),
                      sr.get('datum'), sr.get('od_vremena'), sr.get('do_vremena'),
                      sr.get('broj_osoba'), sr.get('status'),
                      sr.get('napomena'), sr.get('creator_id'),
                      sr.get('created_at')))
            
        else:
            # Vlasnik can only import their own data - OVERWRITES their data only
            vlasnik_id = current_user['id']
            
            # Delete vlasnik's existing data
            conn.execute("DELETE FROM rezervacije WHERE apartman_id IN (SELECT id FROM apartmani WHERE vlasnik_id=?)", (vlasnik_id,))
            conn.execute("DELETE FROM stolovi_rezervacije WHERE restoran_id IN (SELECT id FROM restorani WHERE vlasnik_id=?)", (vlasnik_id,))
            conn.execute("DELETE FROM apartmani WHERE vlasnik_id=?", (vlasnik_id,))
            conn.execute("DELETE FROM restorani WHERE vlasnik_id=?", (vlasnik_id,))
            conn.execute("DELETE FROM gosti WHERE vlasnik_id=?", (vlasnik_id,))
            
            # Delete vlasnik's zaposlenici
            conn.execute("DELETE FROM zaposlenik_objekti WHERE zaposlenik_id IN (SELECT id FROM vlasnici WHERE nadredeni_vlasnik_id=?)", (vlasnik_id,))  # ← NOVO!
            conn.execute("DELETE FROM vlasnik_moduli WHERE vlasnik_id IN (SELECT id FROM vlasnici WHERE nadredeni_vlasnik_id=?)", (vlasnik_id,))
            conn.execute("DELETE FROM vlasnici WHERE role='zaposlenik' AND nadredeni_vlasnik_id=?", (vlasnik_id,))
            
            # Import zaposlenici
            for vlasnik in data_dict.get("vlasnici", []):
                if vlasnik.get('role') == 'zaposlenik' and vlasnik.get('nadredeni_vlasnik_id') == vlasnik_id:
                    conn.execute("""
                        INSERT OR REPLACE INTO vlasnici (id, ime, email, lozinka, role, nadredeni_vlasnik_id)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (vlasnik.get('id'), vlasnik.get('ime'), vlasnik.get('email'),
                          vlasnik.get('lozinka'), vlasnik.get('role'), vlasnik_id))
            
            # Import vlasnik_moduli for vlasnik and zaposlenici
            zaposlenik_ids = [v.get('id') for v in data_dict.get("vlasnici", []) 
                             if v.get('role') == 'zaposlenik' and v.get('nadredeni_vlasnik_id') == vlasnik_id]
            all_user_ids = [vlasnik_id] + zaposlenik_ids
            
            for vm in data_dict.get("vlasnik_moduli", []):
                if vm.get('vlasnik_id') in all_user_ids:
                    conn.execute("""
                        INSERT OR REPLACE INTO vlasnik_moduli (id, vlasnik_id, modul_id)
                        VALUES (?, ?, ?)
                    """, (vm.get('id'), vm.get('vlasnik_id'), vm.get('modul_id')))
            
            # Import zaposlenik_objekti for zaposlenici
            for zo in data_dict.get("zaposlenik_objekti", []):
                if zo.get('zaposlenik_id') in zaposlenik_ids:
                    conn.execute("""
                        INSERT OR REPLACE INTO zaposlenik_objekti 
                        (id, zaposlenik_id, objekt_type, objekt_id, can_view, can_edit, can_create, can_delete, creator_id, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (zo.get('id'), zo.get('zaposlenik_id'), zo.get('objekt_type'), zo.get('objekt_id'),
                          zo.get('can_view', True), zo.get('can_edit', True), zo.get('can_create', True), 
                          zo.get('can_delete', False), zo.get('creator_id'), zo.get('created_at')))
            
            # Import vlasnik's data
            for apt in data_dict.get("apartmani", []):
                if apt.get('vlasnik_id') != vlasnik_id:
                    continue  # Skip other vlasnici data
                conn.execute("""
                    INSERT OR REPLACE INTO apartmani 
                    (id, vlasnik_id, ime, kapacitet, opis, creator_id, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (apt.get('id'), vlasnik_id, apt.get('ime'),
                      apt.get('kapacitet') or apt.get('broj_kreveta') or 1,
                      apt.get('opis'), apt.get('creator_id'), apt.get('created_at')))
            
            for rest in data_dict.get("restorani", []):
                if rest.get('vlasnik_id') != vlasnik_id:
                    continue
                conn.execute("""
                    INSERT OR REPLACE INTO restorani 
                    (id, vlasnik_id, ime, opis, rucak_od, rucak_do, vecera_od, vecera_do,
                     max_osoba_rucak, max_osoba_vecera, creator_id, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (rest.get('id'), vlasnik_id, rest.get('ime'), rest.get('opis'),
                      rest.get('rucak_od'), rest.get('rucak_do'), rest.get('vecera_od'),
                      rest.get('vecera_do'), rest.get('max_osoba_rucak'),
                      rest.get('max_osoba_vecera'), rest.get('creator_id'),
                      rest.get('created_at')))
            
            for gost in data_dict.get("gosti", []):
                if gost.get('vlasnik_id') != vlasnik_id:
                    continue
                conn.execute("""
                    INSERT OR REPLACE INTO gosti 
                    (id, vlasnik_id, naziv, ime_prezime, email, telefon, napomena, creator_id, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (gost.get('id'), vlasnik_id, gost.get('naziv'),
                      gost.get('ime_prezime'), gost.get('email'), gost.get('telefon'),
                      gost.get('napomena'), gost.get('creator_id'),
                      gost.get('created_at')))
            
            # Import rezervacije (only for vlasnik's apartments)
            for rez in data_dict.get("rezervacije", []):
                # Verify apartman belongs to vlasnik
                apt = conn.execute("SELECT id FROM apartmani WHERE id=? AND vlasnik_id=?", 
                                  (rez.get('apartman_id'), vlasnik_id)).fetchone()
                if not apt:
                    continue
                conn.execute("""
                    INSERT OR REPLACE INTO rezervacije 
                    (id, apartman_id, gost_id, od_datuma, do_datuma, cijena, napomena, creator_id, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (rez.get('id'), rez.get('apartman_id'), rez.get('gost_id'),
                      rez.get('od_datuma'), rez.get('do_datuma'), rez.get('cijena'),
                      rez.get('napomena'), rez.get('creator_id'),
                      rez.get('created_at')))
            
            # Import stolovi_rezervacije (only for vlasnik's restaurants)
            for sr in data_dict.get("stolovi_rezervacije", []):
                rest = conn.execute("SELECT id FROM restorani WHERE id=? AND vlasnik_id=?",
                                   (sr.get('restoran_id'), vlasnik_id)).fetchone()
                if not rest:
                    continue
                conn.execute("""
                    INSERT OR REPLACE INTO stolovi_rezervacije 
                    (id, restoran_id, gost_id, datum, od_vremena, do_vremena, broj_osoba,
                     status, napomena, creator_id, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (sr.get('id'), sr.get('restoran_id'), sr.get('gost_id'),
                      sr.get('datum'), sr.get('od_vremena'), sr.get('do_vremena'),
                      sr.get('broj_osoba'), sr.get('status'),
                      sr.get('napomena'), sr.get('creator_id'),
                      sr.get('created_at')))
        
        conn.commit()
        
        log_audit(conn, current_user['id'], current_user['ime'], current_user['role'],
                 'import', 'system', None, "Data Import", 
                 f"Imported data for {current_user['role']}")
        
        return {"message": "Data successfully imported", "role": current_user['role']}


if __name__ == "__main__":
    import uvicorn
    # Use import string for reload to work properly
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
