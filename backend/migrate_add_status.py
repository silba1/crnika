#!/usr/bin/env python3
"""
Migration script: Add status column to rezervacije table
Run this BEFORE deploying new backend code!
"""

import sqlite3
import sys

def migrate_add_status(db_path='baza_prod1.db'):
    """Add status column to rezervacije table if it doesn't exist"""
    
    print(f"🔧 Migrating database: {db_path}")
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check if status column exists
        cursor.execute("PRAGMA table_info(rezervacije)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'status' in columns:
            print("✅ Column 'status' already exists in rezervacije table")
        else:
            print("➕ Adding 'status' column to rezervacije table...")
            cursor.execute("""
                ALTER TABLE rezervacije 
                ADD COLUMN status TEXT DEFAULT 'na_čekanju'
            """)
            conn.commit()
            print("✅ Column 'status' added successfully")
        
        # Verify
        cursor.execute("PRAGMA table_info(rezervacije)")
        print("\n📋 Current rezervacije schema:")
        for row in cursor.fetchall():
            print(f"  {row[1]} ({row[2]})")
        
        # Update existing rows to have default status if NULL
        cursor.execute("UPDATE rezervacije SET status = 'na_čekanju' WHERE status IS NULL")
        updated_rows = cursor.rowcount
        if updated_rows > 0:
            print(f"\n🔄 Updated {updated_rows} existing rows with default status")
            conn.commit()
        
        print("\n✅ Migration completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        conn.rollback()
        sys.exit(1)
    finally:
        conn.close()

if __name__ == '__main__':
    db_path = sys.argv[1] if len(sys.argv) > 1 else 'baza_prod1.db'
    migrate_add_status(db_path)
