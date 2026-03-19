"""
Database Initialization Script
Creates all tables and adds default admin user
"""

import sqlite3
from passlib.context import CryptContext
import os
import sys

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Database path
DATABASE = "baza_prod1.db"

# Default admin credentials
DEFAULT_ADMIN_EMAIL = "admin@admin.com"
DEFAULT_ADMIN_PASSWORD = "admin123"
DEFAULT_ADMIN_NAME = "Administrator"


def create_database():
    """Create database and all tables"""
    
    # Check if database already exists
    if os.path.exists(DATABASE):
        response = input(f"⚠️  Database '{DATABASE}' already exists. Delete and recreate? (yes/no): ")
        if response.lower() not in ['yes', 'y']:
            print("❌ Initialization cancelled.")
            sys.exit(0)
        else:
            os.remove(DATABASE)
            print(f"🗑️  Deleted existing database: {DATABASE}")
    
    print(f"📦 Creating database: {DATABASE}")
    
    conn = sqlite3.connect(DATABASE)
    c = conn.cursor()
    
    # ============================================
    # VLASNICI (Users) TABLE
    # ============================================
    print("  ✓ Creating table: vlasnici")
    c.execute('''
        CREATE TABLE IF NOT EXISTS vlasnici (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ime TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            lozinka TEXT,
            role TEXT NOT NULL DEFAULT 'vlasnik',
            nadredeni_vlasnik_id INTEGER,
            auth_provider TEXT DEFAULT 'password',
            oauth_id TEXT,
            FOREIGN KEY (nadredeni_vlasnik_id) REFERENCES vlasnici (id)
        )
    ''')
    
    # ============================================
    # MODULI TABLE (Admin manages available modules)
    # ============================================
    print("  ✓ Creating table: moduli")
    c.execute('''
        CREATE TABLE IF NOT EXISTS moduli (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            naziv TEXT UNIQUE NOT NULL,
            opis TEXT,
            ikona TEXT,
            aktivan BOOLEAN DEFAULT 1
        )
    ''')
    
    # ============================================
    # VLASNIK_MODULI TABLE (Many-to-Many relationship)
    # ============================================
    print("  ✓ Creating table: vlasnik_moduli")
    c.execute('''
        CREATE TABLE IF NOT EXISTS vlasnik_moduli (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vlasnik_id INTEGER NOT NULL,
            modul_id INTEGER NOT NULL,
            FOREIGN KEY (vlasnik_id) REFERENCES vlasnici (id) ON DELETE CASCADE,
            FOREIGN KEY (modul_id) REFERENCES moduli (id) ON DELETE CASCADE,
            UNIQUE(vlasnik_id, modul_id)
        )
    ''')
    
    # ============================================
    # APARTMANI TABLE
    # ============================================
    print("  ✓ Creating table: apartmani")
    c.execute('''
        CREATE TABLE IF NOT EXISTS apartmani (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vlasnik_id INTEGER NOT NULL,
            ime TEXT NOT NULL,
            kapacitet INTEGER NOT NULL,
            opis TEXT NOT NULL,
            creator_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (vlasnik_id) REFERENCES vlasnici (id),
            FOREIGN KEY (creator_id) REFERENCES vlasnici (id)
        )
    ''')
    
    # ============================================
    # RESTORANI TABLE
    # ============================================
    print("  ✓ Creating table: restorani")
    c.execute('''
        CREATE TABLE IF NOT EXISTS restorani (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vlasnik_id INTEGER NOT NULL,
            ime TEXT NOT NULL,
            opis TEXT NOT NULL,
            rucak_od TEXT DEFAULT '12:00',
            rucak_do TEXT DEFAULT '15:00',
            vecera_od TEXT DEFAULT '18:00',
            vecera_do TEXT DEFAULT '22:00',
            max_osoba_rucak INTEGER DEFAULT 50,
            max_osoba_vecera INTEGER DEFAULT 80,
            creator_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (vlasnik_id) REFERENCES vlasnici (id),
            FOREIGN KEY (creator_id) REFERENCES vlasnici (id)
        )
    ''')
    
    # ============================================
    # GOSTI TABLE
    # ============================================
    print("  ✓ Creating table: gosti")
    c.execute('''
        CREATE TABLE IF NOT EXISTS gosti (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vlasnik_id INTEGER NOT NULL,
            naziv TEXT NOT NULL,
            ime_prezime TEXT,
            email TEXT,
            telefon TEXT,
            napomena TEXT,
            creator_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (vlasnik_id) REFERENCES vlasnici (id),
            FOREIGN KEY (creator_id) REFERENCES vlasnici (id)
        )
    ''')
    
    # ============================================
    # STOLOVI REZERVACIJE TABLE
    # ============================================
    print("  ✓ Creating table: stolovi_rezervacije")
    c.execute('''
        CREATE TABLE IF NOT EXISTS stolovi_rezervacije (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            restoran_id INTEGER NOT NULL,
            gost_id INTEGER NOT NULL,
            datum TEXT NOT NULL,
            od_vremena TEXT NOT NULL,
            do_vremena TEXT NOT NULL,
            broj_osoba INTEGER NOT NULL,
            status TEXT DEFAULT 'na_čekanju',
            napomena TEXT,
            creator_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (restoran_id) REFERENCES restorani (id),
            FOREIGN KEY (gost_id) REFERENCES gosti (id),
            FOREIGN KEY (creator_id) REFERENCES vlasnici (id)
        )
    ''')
    
    # ============================================
    # CIJENE APARTMANA TABLE
    # ============================================
    print("  ✓ Creating table: cijene_apartmana")
    c.execute('''
        CREATE TABLE IF NOT EXISTS cijene_apartmana (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            apartman_id INTEGER NOT NULL,
            od_datuma TEXT NOT NULL,
            do_datuma TEXT NOT NULL,
            cijena_po_noci REAL NOT NULL,
            naziv TEXT,
            creator_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (apartman_id) REFERENCES apartmani (id),
            FOREIGN KEY (creator_id) REFERENCES vlasnici (id)
        )
    ''')
    
    # ============================================
    # POSTAVKE VLASNIKA TABLE
    # ============================================
    print("  ✓ Creating table: postavke_vlasnika")
    c.execute('''
        CREATE TABLE IF NOT EXISTS postavke_vlasnika (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vlasnik_id INTEGER UNIQUE NOT NULL,
            naziv_aplikacije TEXT DEFAULT 'Apartmani',
            FOREIGN KEY (vlasnik_id) REFERENCES vlasnici (id)
        )
    ''')
    
    # ============================================
    # REZERVACIJE TABLE
    # ============================================
    print("  ✓ Creating table: rezervacije")
    c.execute('''
        CREATE TABLE IF NOT EXISTS rezervacije (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            apartman_id INTEGER NOT NULL,
            gost_id INTEGER NOT NULL,
            od_datuma TEXT NOT NULL,
            do_datuma TEXT NOT NULL,
            cijena REAL NOT NULL,
            status TEXT DEFAULT 'na_čekanju',
            napomena TEXT,
            creator_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (apartman_id) REFERENCES apartmani (id),
            FOREIGN KEY (gost_id) REFERENCES gosti (id),
            FOREIGN KEY (creator_id) REFERENCES vlasnici (id)
        )
    ''')
    
    # ============================================
    # ZAPOSLENIK OBJEKTI (Granular Permissions)
    # ============================================
    print("  ✓ Creating table: zaposlenik_objekti")
    c.execute('''
        CREATE TABLE IF NOT EXISTS zaposlenik_objekti (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            zaposlenik_id INTEGER NOT NULL,
            objekt_type TEXT NOT NULL CHECK(objekt_type IN ('restoran', 'apartman')),
            objekt_id INTEGER NOT NULL,
            can_view BOOLEAN DEFAULT 1,
            can_edit BOOLEAN DEFAULT 1,
            can_create BOOLEAN DEFAULT 1,
            can_delete BOOLEAN DEFAULT 0,
            creator_id INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (zaposlenik_id) REFERENCES vlasnici (id) ON DELETE CASCADE,
            FOREIGN KEY (creator_id) REFERENCES vlasnici (id),
            UNIQUE(zaposlenik_id, objekt_type, objekt_id)
        )
    ''')
    
    # ============================================
    # AUDIT LOG TABLE
    # ============================================
    print("  ✓ Creating table: audit_log")
    c.execute('''
        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            korisnik_id INTEGER NOT NULL,
            korisnik_ime TEXT NOT NULL,
            korisnik_role TEXT NOT NULL,
            akcija TEXT NOT NULL,
            entitet_tip TEXT NOT NULL,
            entitet_id INTEGER,
            entitet_naziv TEXT,
            detalji TEXT,
            ip_adresa TEXT,
            FOREIGN KEY (korisnik_id) REFERENCES vlasnici(id)
        )
    ''')
    
    # ============================================
    # SPAM PROTECTION TABLES
    # ============================================
    print("  ✓ Creating table: spam_log")
    c.execute('''
        CREATE TABLE IF NOT EXISTS spam_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ip_address TEXT NOT NULL,
            restaurant_id INTEGER,
            action TEXT NOT NULL,
            reason TEXT,
            details TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (restaurant_id) REFERENCES restorani (id)
        )
    ''')
    
    print("  ✓ Creating table: blocked_ips")
    c.execute('''
        CREATE TABLE IF NOT EXISTS blocked_ips (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ip_address TEXT UNIQUE NOT NULL,
            blocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            blocked_until DATETIME,
            reason TEXT,
            attempts_count INTEGER DEFAULT 0
        )
    ''')
    
    # ============================================
    # INDEXES
    # ============================================
    print("  ✓ Creating indexes")
    
    # Audit log indexes
    c.execute('CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp DESC)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_audit_korisnik ON audit_log(korisnik_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_audit_entitet ON audit_log(entitet_tip, entitet_id)')
    
    # Zaposlenik objekti indexes
    c.execute('CREATE INDEX IF NOT EXISTS idx_zaposlenik_objekti_zaposlenik ON zaposlenik_objekti(zaposlenik_id)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_zaposlenik_objekti_objekt ON zaposlenik_objekti(objekt_type, objekt_id)')
    
    # Spam log indexes
    c.execute('CREATE INDEX IF NOT EXISTS idx_spam_ip ON spam_log(ip_address, timestamp)')
    c.execute('CREATE INDEX IF NOT EXISTS idx_spam_restaurant ON spam_log(restaurant_id, timestamp)')
    
    # Blocked IPs index
    c.execute('CREATE INDEX IF NOT EXISTS idx_blocked_ip ON blocked_ips(ip_address)')
    
    # ============================================
    # INSERT INITIAL MODULES
    # ============================================
    print("\n📦 Inserting initial modules...")
    
    modules_data = [
        ('apartmani', 'Upravljanje apartmanima i rezervacijama apartmana', 'home'),
        ('restorani', 'Upravljanje restoranima i rezervacijama stolova', 'restaurant'),
    ]
    
    for naziv, opis, ikona in modules_data:
        c.execute("""
            INSERT OR IGNORE INTO moduli (naziv, opis, ikona, aktivan)
            VALUES (?, ?, ?, 1)
        """, (naziv, opis, ikona))
        print(f"  ✓ Module added: {naziv}")
    
    # ============================================
    # CREATE ADMIN USER
    # ============================================
    print("\n👤 Creating admin user...")
    
    # Check if admin already exists
    c.execute("SELECT * FROM vlasnici WHERE email = ?", (DEFAULT_ADMIN_EMAIL,))
    if c.fetchone():
        print(f"  ⚠️  Admin user already exists: {DEFAULT_ADMIN_EMAIL}")
    else:
        # Hash password
        hashed_password = pwd_context.hash(DEFAULT_ADMIN_PASSWORD)
        
        # Create admin (no tip_vlasnika - admin has access to everything)
        c.execute("""
            INSERT INTO vlasnici (ime, email, lozinka, role, auth_provider)
            VALUES (?, ?, ?, ?, ?)
        """, (DEFAULT_ADMIN_NAME, DEFAULT_ADMIN_EMAIL, hashed_password, 'admin', 'password'))
        
        admin_id = c.lastrowid
        
        # Admin automatically gets ALL modules
        c.execute("SELECT id FROM moduli")
        for (modul_id,) in c.fetchall():
            c.execute("""
                INSERT INTO vlasnik_moduli (vlasnik_id, modul_id)
                VALUES (?, ?)
            """, (admin_id, modul_id))
        
        print(f"  ✅ Admin user created successfully!")
        print(f"     Email: {DEFAULT_ADMIN_EMAIL}")
        print(f"     Password: {DEFAULT_ADMIN_PASSWORD}")
        print(f"     ID: {admin_id}")
        print(f"     Modules: ALL")
    
    # Commit changes
    conn.commit()
    conn.close()
    
    print(f"\n✅ Database initialization complete!")
    print(f"📁 Database file: {DATABASE}")
    print(f"📊 Total tables: 13")  # +2 tables (moduli, vlasnik_moduli)
    print(f"🔐 Default admin credentials:")
    print(f"   Email: {DEFAULT_ADMIN_EMAIL}")
    print(f"   Password: {DEFAULT_ADMIN_PASSWORD}")
    print(f"\n⚠️  IMPORTANT: Change admin password after first login!")


def verify_database():
    """Verify database structure"""
    print("\n🔍 Verifying database structure...")
    
    conn = sqlite3.connect(DATABASE)
    c = conn.cursor()
    
    # Get all tables
    c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    tables = [row[0] for row in c.fetchall()]
    
    expected_tables = [
        'apartmani',
        'audit_log',
        'blocked_ips',
        'cijene_apartmana',
        'gosti',
        'postavke_vlasnika',
        'restorani',
        'rezervacije',
        'spam_log',
        'stolovi_rezervacije',
        'vlasnici'
    ]
    
    print(f"\n📋 Tables found: {len(tables)}")
    for table in tables:
        # Count rows
        c.execute(f"SELECT COUNT(*) FROM {table}")
        count = c.fetchone()[0]
        
        status = "✓" if table in expected_tables else "?"
        print(f"  {status} {table}: {count} rows")
    
    # Check for missing tables
    missing = set(expected_tables) - set(tables)
    if missing:
        print(f"\n⚠️  Missing tables: {', '.join(missing)}")
    else:
        print(f"\n✅ All expected tables present")
    
    # Check admin user
    c.execute("SELECT id, ime, email, role FROM vlasnici WHERE role='admin'")
    admin = c.fetchone()
    if admin:
        print(f"\n👤 Admin user found:")
        print(f"   ID: {admin[0]}")
        print(f"   Name: {admin[1]}")
        print(f"   Email: {admin[2]}")
        print(f"   Role: {admin[3]}")
    else:
        print(f"\n⚠️  No admin user found!")
    
    conn.close()


def main():
    """Main initialization function"""
    print("=" * 60)
    print("  DATABASE INITIALIZATION SCRIPT")
    print("  Apartmani & Restorani System")
    print("=" * 60)
    print()
    
    try:
        # Create database
        create_database()
        
        # Verify structure
        verify_database()
        
        print("\n" + "=" * 60)
        print("🎉 INITIALIZATION SUCCESSFUL!")
        print("=" * 60)
        print("\n🚀 Next steps:")
        print("   1. Start the API: python main.py")
        print("   2. Open docs: http://localhost:8000/docs")
        print(f"   3. Login with: {DEFAULT_ADMIN_EMAIL} / {DEFAULT_ADMIN_PASSWORD}")
        print("   4. Change admin password via API")
        print()
        
    except Exception as e:
        print(f"\n❌ Error during initialization: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
