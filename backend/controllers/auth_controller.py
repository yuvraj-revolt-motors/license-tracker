from flask import Blueprint, request, jsonify
from models.user_model import get_user_by_credentials
import mysql.connector

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/api/login', methods=['POST'])
def login():
    """Handles user login."""
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    print(f"DEBUG: Attempting login for username: {username}")

    if not username or not password:
        return jsonify({'success': False, 'message': 'Username and password are required'}), 400

    try:
        user = get_user_by_credentials(username, password)

        if user:
            print(f"DEBUG: Login successful for user: {username}")
            return jsonify({'success': True, 'message': 'Login successful', 'token': 'dummy_token_123'})
        else:
            print(f"DEBUG: Login failed for user: {username} - Invalid credentials")
            return jsonify({'success': False, 'message': 'Invalid username or password'}), 401
    except mysql.connector.Error as err:
        print(f"ERROR: Database error during login: {err}")
        return jsonify({'success': False, 'message': 'Database error during login', 'error': str(err)}), 500
    except Exception as e:
        print(f"ERROR: An unexpected error occurred during login: {e}")
        return jsonify({'success': False, 'message': 'An unexpected error occurred', 'error': str(e)}), 500
