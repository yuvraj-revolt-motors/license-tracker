import mysql.connector

# Database connection configuration
# IMPORTANT: Replace with your actual MySQL credentials
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',    # e.g., 'root'
    'password': 'Revolt123@', # e.g., 'password' or leave empty if no password
    'database': 'license_tracker_db'
}

def get_db_connection():
    """Establishes and returns a database connection."""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        return conn
    except mysql.connector.Error as err:
        print(f"Database connection error: {err}")
        raise # Re-raise to be caught by Flask's error handling or calling function
