from .db_connection import get_db_connection
import mysql.connector

def get_user_by_credentials(username, password):
    """
    Retrieves a user by username and password.
    """
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        query = "SELECT * FROM `users` WHERE `username` = %s AND `password` = %s"
        cursor.execute(query, (username, password))
        user = cursor.fetchone()
        return user
    except mysql.connector.Error as err:
        print(f"ERROR: Database error during login: {err}")
        raise
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
