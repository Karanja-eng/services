"""
Database Initialization Script
Run this script to create all database tables
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from Databases.config import engine, check_db_connection
from Databases.models import Base


def init_database():
    """Initialize database - create all tables"""
    print("🔍 Checking database connection...")
    success, message = check_db_connection()
    
    if not success:
        print(f"❌ {message}")
        print("\n📝 Please ensure PostgreSQL is running and connection details are correct.")
        print("   Default connection: postgresql://postgres:postgres@localhost:5432/services_db")
        return False
    
    print(f"✅ {message}")
    
    print("\n🔨 Creating database tables...")
    try:
        Base.metadata.create_all(bind=engine)
        print("✅ All database tables created successfully!")
        
        # Print created tables
        print("\n📊 Created tables:")
        for table_name in Base.metadata.tables.keys():
            print(f"   - {table_name}")
        
        return True
    except Exception as e:
        print(f"❌ Error creating tables: {str(e)}")
        return False


def drop_all_tables():
    """Drop all tables - USE WITH CAUTION!"""
    print("⚠️  WARNING: This will delete all data!")
    confirm = input("Type 'DELETE ALL DATA' to confirm: ")
    
    if confirm == "DELETE ALL DATA":
        print("🗑️  Dropping all tables...")
        Base.metadata.drop_all(bind=engine)
        print("✅ All tables dropped")
    else:
        print("❌ Cancelled")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Database initialization script")
    parser.add_argument(
        "--drop",
        action="store_true",
        help="Drop all tables before creating (DANGEROUS!)"
    )
    
    args = parser.parse_args()
    
    if args.drop:
        drop_all_tables()
    
    init_database()
