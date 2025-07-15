# backend/app.py
from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import mysql.connector
import json
import uuid
from datetime import datetime, date

app = Flask(__name__)
CORS(app) # Enable CORS for all routes (important during development)

# Database connection configuration
# IMPORTANT: Replace with your actual MySQL credentials
DB_CONFIG = {
    'host': 'localhost',
    'user': 'root',    # e.g., 'root'
    'password': 'Ak8bp@12321', # e.g., 'password' or leave empty if no password
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

# --- Frontend Serving Route ---
@app.route('/')
def serve_frontend():
    """Serves the main frontend HTML file."""
    return render_template('index.html')

# --- API Endpoints ---

@app.route('/api/login', methods=['POST'])
def login():
    """Handles user login."""
    data = request.get_json()
    username = data.get('username')
    password = data.get('password')

    print(f"DEBUG: Attempting login for username: {username}")

    if not username or not password:
        return jsonify({'success': False, 'message': 'Username and password are required'}), 400

    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        query = "SELECT * FROM `users` WHERE `username` = %s AND `password` = %s"
        cursor.execute(query, (username, password))
        user = cursor.fetchone()

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
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.route('/api/licenses', methods=['GET'])
def get_licenses():
    """
    Retrieves licenses from the database, with optional filtering.
    Filters: system, status, query (name, email, mobile), assignment_date_start, assignment_date_end.
    Now also includes created_at, updated_at, requested_date, requestor_name.
    """
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Build dynamic WHERE clause based on query parameters
        conditions = []
        params = []

        system_filter = request.args.get('system')
        if system_filter:
            conditions.append("`system` = %s") # Quote column names to avoid conflicts
            params.append(system_filter)

        status_filter = request.args.get('status')
        if status_filter:
            conditions.append("`status` = %s")
            params.append(status_filter)

        search_query = request.args.get('query') # General search for name, email, mobile
        if search_query:
            search_pattern = f"%{search_query}%"
            conditions.append("(`name` LIKE %s OR `email` LIKE %s OR `mobile` LIKE %s)")
            params.extend([search_pattern, search_pattern, search_pattern])

        assignment_date_start = request.args.get('assignment_date_start')
        if assignment_date_start:
            conditions.append("`assignment_date` >= %s")
            params.append(assignment_date_start)

        assignment_date_end = request.args.get('assignment_date_end')
        if assignment_date_end:
            conditions.append("`assignment_date` <= %s")
            params.append(assignment_date_end)

        # Build the full query
        query = """
        SELECT `id`, `ticket_id`, `system`, `name`, `mobile`, `email`, `request_type`,
               `assignment_date`, `expiry_date`, `status`, `details_json`, `removal_details_json`,
               `attachment_data`, `created_at`, `updated_at`, `requested_date`, `requestor_name`
        FROM `licenses`
        """
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        query += " ORDER BY `assignment_date` DESC" # Always order by most recent

        print(f"DEBUG: Executing licenses GET query: {query} with params: {params}")

        cursor.execute(query, tuple(params))
        licenses_data = cursor.fetchall()

        # Parse JSON fields and format dates for frontend
        for license in licenses_data:
            for json_field in ['details_json', 'removal_details_json']:
                if license.get(json_field):
                    try:
                        license[json_field] = json.loads(license[json_field])
                    except json.JSONDecodeError:
                        print(f"WARNING: Could not decode {json_field} for license ID {license.get('id')}: {license[json_field]}")
                        license[json_field] = {}
                else:
                    license[json_field] = {}
            
            # Convert Date/Datetime objects to ISO format strings for JSON serialization
            for date_field in ['assignment_date', 'expiry_date', 'created_at', 'updated_at', 'requested_date']:
                if isinstance(license.get(date_field), (date, datetime)):
                    license[date_field] = license[date_field].isoformat()
                elif license.get(date_field) is None:
                    license[date_field] = None # Ensure explicit None for missing dates

        return jsonify(licenses_data)
    except mysql.connector.Error as err:
        print(f"ERROR: Database error in get_licenses: {err}")
        return jsonify({'message': 'Database error', 'error': str(err)}), 500
    except Exception as e:
        print(f"ERROR: An unexpected error occurred in get_licenses: {e}")
        return jsonify({'message': 'An unexpected error occurred', 'error': str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.route('/api/licenses', methods=['POST'])
def add_license():
    """
    Adds a new license to the database.
    Now includes requested_date, requestor_name.
    """
    data = request.get_json()
    print(f"DEBUG: Received data for add_license: {data}")

    required_fields = ['ticketId', 'system', 'name', 'assignmentDate', 'requestedDate', 'requestorName']
    if not all(field in data for field in required_fields):
        missing = [field for field in required_fields if field not in data]
        print(f"ERROR: Missing required fields for add_license: {missing}")
        return jsonify({'success': False, 'message': f'Missing required license data: {", ".join(missing)}'}), 400

    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        license_id = str(uuid.uuid4())

        details_json_str = json.dumps(data.get('details_json', {})) if data.get('details_json') else "{}"
        
        removal_details_json_str = None
        attachment_data = data.get('attachmentData')

        insert_query = """
        INSERT INTO `licenses` (`id`, `ticket_id`, `system`, `name`, `mobile`, `email`, `request_type`,
                              `assignment_date`, `expiry_date`, `status`, `details_json`, `removal_details_json`,
                              `attachment_data`, `requested_date`, `requestor_name`)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        params = (
            license_id,
            data['ticketId'],
            data['system'],
            data['name'],
            data.get('mobile') or None,
            data.get('email') or None,
            # Request type is now simplified, will be "Add License" implicitly for this form.
            # We can still send it if client provides, but it's not a 'Modify License' here.
            data.get('requestType', 'Add License'),
            data['assignmentDate'],
            data.get('expiryDate') or None,
            data.get('status', 'Active'),
            details_json_str,
            removal_details_json_str,
            attachment_data,
            data['requestedDate'],
            data['requestorName']
        )
        print(f"DEBUG: Executing add_license query: {insert_query} with params: {params}")

        cursor.execute(insert_query, params)
        conn.commit()
        print(f"DEBUG: License added successfully: {license_id}")
        return jsonify({'success': True, 'message': 'License added successfully', 'id': license_id}), 201
    except mysql.connector.Error as err:
        print(f"ERROR: Database error in add_license: {err}")
        return jsonify({'success': False, 'message': 'Database error', 'error': str(err)}), 500
    except Exception as e:
        print(f"ERROR: An unexpected error occurred in add_license: {e}")
        return jsonify({'success': False, 'message': 'An unexpected error occurred', 'error': str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.route('/api/licenses/<string:license_id>', methods=['PUT'])
def update_license(license_id):
    """
    Updates an existing license's status, removal details, and attachment data.
    updated_at is automatically handled by MySQL.
    """
    data = request.get_json()
    print(f"DEBUG: Received data for update_license (ID: {license_id}): {data}")

    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # No need to select current_license first just for status/removal_details/attachment
        # directly update. MySQL will handle updated_at.

        new_status = data.get('status') # This will be either 'Inactive' for removal or 'Active' for general modification if 'requestType' was 'Modify License'
        new_removal_details_json = data.get('removal_details_json')
        new_attachment_data = data.get('attachmentData')

        # Dynamically build parts of the update query
        set_clauses = []
        params = []

        if new_status is not None:
            set_clauses.append("`status` = %s")
            params.append(new_status)
        
        if new_removal_details_json is not None:
            set_clauses.append("`removal_details_json` = %s")
            params.append(json.dumps(new_removal_details_json))
        
        if new_attachment_data is not None:
            set_clauses.append("`attachment_data` = %s")
            params.append(new_attachment_data)
        
        # If 'details_json' is explicitly sent for modification (e.g., from 'Add/Modify' if it were still a 'Modify' form)
        # This part handles generic updates to details_json. For specific fields like LSQ team type,
        # the client should fetch existing details_json, modify it, and send it back.
        if 'details_json' in data and data['details_json'] is not None:
            set_clauses.append("`details_json` = %s")
            params.append(json.dumps(data['details_json']))

        # Ensure updated_at is always set by the DB
        set_clauses.append("`updated_at` = CURRENT_TIMESTAMP")

        if not set_clauses:
            return jsonify({'success': False, 'message': 'No fields provided for update'}), 400

        update_query = f"UPDATE `licenses` SET {', '.join(set_clauses)} WHERE `id` = %s"
        params.append(license_id) # Add license_id to the end of parameters

        print(f"DEBUG: Executing update_license query: {update_query} with params: {params}")

        cursor.execute(update_query, tuple(params))
        conn.commit()
        if cursor.rowcount == 0:
            print(f"WARNING: License ID {license_id} found but no changes made or ID not found. This might be fine if status is already correct.")
            return jsonify({'success': False, 'message': 'License not found or no changes applied'})
        print(f"DEBUG: License ID {license_id} updated successfully. Rows affected: {cursor.rowcount}")
        return jsonify({'success': True, 'message': 'License updated successfully'})
    except mysql.connector.Error as err:
        print(f"ERROR: Database error in update_license: {err}")
        return jsonify({'success': False, 'message': 'Database error', 'error': str(err)}), 500
    except Exception as e:
        print(f"ERROR: An unexpected error occurred in update_license: {e}")
        return jsonify({'success': False, 'message': 'An unexpected error occurred', 'error': str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.route('/api/licenses/<string:license_id>/reactivate', methods=['PUT'])
def reactivate_license(license_id):
    """
    Reactivates an inactive license, setting a new assignment date.
    updated_at is automatically handled by MySQL.
    """
    data = request.get_json()
    reason = data.get('reason')
    new_assignment_date = data.get('newAssignmentDate')
    attachment_data = data.get('attachmentData') # Optional Base64 attachment for reactivation

    print(f"DEBUG: Reactivate endpoint hit for license ID: {license_id}")
    print(f"DEBUG: Received data for reactivation: Reason='{reason}', NewAssignmentDate='{new_assignment_date}', AttachmentDataPresent={bool(attachment_data)}")

    if not reason or not new_assignment_date:
        print("ERROR: Reactivation reason or new assignment date missing.")
        return jsonify({'success': False, 'message': 'Reactivation reason and new assignment date are required'}), 400

    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        update_license_query = """
        UPDATE `licenses`
        SET `status` = 'Active',
            `assignment_date` = %s,
            `expiry_date` = NULL,
            `removal_details_json` = NULL,
            `attachment_data` = %s,
            `updated_at` = CURRENT_TIMESTAMP -- MySQL handles this
        WHERE `id` = %s
        """
        update_license_params = (new_assignment_date, attachment_data, license_id)
        print(f"DEBUG: Executing license update for reactivation: {update_license_query} with params: {update_license_params}")

        cursor.execute(update_license_query, update_license_params)
        
        rows_affected = cursor.rowcount
        conn.commit() # Commit license update first

        if rows_affected == 0:
            print(f"WARNING: License ID {license_id} not found or no changes made during reactivation update.")
            return jsonify({'success': False, 'message': 'License not found or already active, could not reactivate'}), 404

        # Add a ticket entry for reactivation
        ticket_id = f"REACTIVATE-{uuid.uuid4().hex[:8].upper()}"
        action_description = f"Reactivate License for ID {license_id} (Reason: {reason}, New Assignment Date: {new_assignment_date})"
        notes = f"License reactivated by user input. Reason: {reason}" # Add notes to ticket
        add_ticket_query = """
        INSERT INTO `tickets` (`ticket_id`, `action_description`, `status`, `timestamp`, `notes`)
        VALUES (%s, %s, %s, %s, %s)
        """
        # Format datetime to exclude milliseconds and 'Z' for MySQL compatibility
        ticket_timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        add_ticket_params = (ticket_id, action_description, 'Closed', ticket_timestamp, notes)
        print(f"DEBUG: Executing ticket insert for reactivation: {add_ticket_query} with params: {add_ticket_params}")
        
        cursor.execute(add_ticket_query, add_ticket_params)
        conn.commit() # Commit ticket insert

        print(f"DEBUG: License ID {license_id} reactivated successfully. Ticket {ticket_id} created.")
        return jsonify({'success': True, 'message': 'License reactivated successfully'})
    except mysql.connector.Error as err:
        print(f"ERROR: Database error in reactivate_license: {err}")
        # Rollback any changes if an error occurred during the transaction
        if conn:
            conn.rollback()
        return jsonify({'success': False, 'message': 'Database error', 'error': str(err)}), 500
    except Exception as e:
        print(f"ERROR: An unexpected error occurred in reactivate_license: {e}")
        if conn:
            conn.rollback()
        return jsonify({'success': False, 'message': 'An unexpected error occurred', 'error': str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.route('/api/tickets', methods=['GET'])
def get_tickets():
    """
    Retrieves all tickets from the database.
    Now includes notes.
    """
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT `ticket_id`, `action_description`, `timestamp`, `status`, `notes` FROM `tickets` ORDER BY `timestamp` DESC")
        tickets_data = cursor.fetchall()

        for ticket in tickets_data:
            if isinstance(ticket.get('timestamp'), (date, datetime)):
                ticket['timestamp'] = ticket['timestamp'].isoformat()
            elif ticket.get('timestamp') is None:
                ticket['timestamp'] = None

        return jsonify(tickets_data)
    except mysql.connector.Error as err:
        print(f"ERROR: Database error in get_tickets: {err}")
        return jsonify({'message': 'Database error', 'error': str(err)}), 500
    except Exception as e:
        print(f"ERROR: An unexpected error occurred in get_tickets: {e}")
        return jsonify({'message': 'An unexpected error occurred', 'error': str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.route('/api/tickets', methods=['POST'])
def add_ticket():
    """
    Adds a new ticket entry to the database.
    Now accepts notes.
    """
    data = request.get_json()
    print(f"DEBUG: Received data for add_ticket: {data}")

    required_fields = ['ticketId', 'action', 'status', 'timestamp']
    if not all(field in data for field in required_fields):
        missing = [field for field in required_fields if field not in data]
        print(f"ERROR: Missing required fields for add_ticket: {missing}.")
        return jsonify({'success': False, 'message': f'Missing required ticket data: {", ".join(missing)}'}), 400

    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        insert_query = """
        INSERT INTO `tickets` (`ticket_id`, `action_description`, `status`, `timestamp`, `notes`)
        VALUES (%s, %s, %s, %s, %s)
        """
        params = (
            data['ticketId'],
            data['action'],
            data['status'],
            # Fix: Format datetime to exclude milliseconds and 'Z' for MySQL compatibility
            datetime.strptime(data['timestamp'], '%Y-%m-%dT%H:%M:%S.%fZ').strftime('%Y-%m-%d %H:%M:%S'),
            data.get('notes') or None # Include notes field
        )
        print(f"DEBUG: Executing add_ticket query: {insert_query} with params: {params}")
        cursor.execute(insert_query, params)
        conn.commit()
        print(f"DEBUG: Ticket added successfully: {data['ticketId']}")
        return jsonify({'success': True, 'message': 'Ticket added successfully'}), 201
    except mysql.connector.Error as err:
        print(f"ERROR: Database error in add_ticket: {err}")
        return jsonify({'success': False, 'message': 'Database error', 'error': str(err)}), 500
    except Exception as e:
        print(f"ERROR: An unexpected error occurred in add_ticket: {e}")
        return jsonify({'success': False, 'message': 'An unexpected error occurred', 'error': str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.route('/api/tickets/<string:ticket_id_val>', methods=['PUT'])
def update_ticket_status(ticket_id_val):
    """
    Updates the status and optionally notes of a specific ticket.
    """
    data = request.get_json()
    new_status = data.get('status')
    new_notes = data.get('notes') # New: allow updating notes

    print(f"DEBUG: Attempting to update ticket {ticket_id_val} status to {new_status}, notes: {new_notes}")

    if not new_status and not new_notes: # Must provide at least status or notes
        return jsonify({'success': False, 'message': 'New status or notes are required for update'}), 400

    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        set_clauses = []
        params = []
        if new_status:
            set_clauses.append("`status` = %s")
            params.append(new_status)
        if new_notes is not None: # Allow setting to None/empty string
            set_clauses.append("`notes` = %s")
            params.append(new_notes)
        
        update_query = f"UPDATE `tickets` SET {', '.join(set_clauses)} WHERE `ticket_id` = %s"
        params.append(ticket_id_val)

        cursor.execute(update_query, tuple(params))
        conn.commit()
        if cursor.rowcount == 0:
            print(f"DEBUG: Ticket {ticket_id_val} not found for update.")
            return jsonify({'success': False, 'message': 'Ticket not found'}), 404
        print(f"DEBUG: Ticket {ticket_id_val} updated successfully.")
        return jsonify({'success': True, 'message': 'Ticket updated successfully'})
    except mysql.connector.Error as err:
        print(f"ERROR: Database error in update_ticket_status: {err}")
        return jsonify({'success': False, 'message': 'Database error', 'error': str(err)}), 500
    except Exception as e:
        print(f"ERROR: An unexpected error occurred in update_ticket_status: {e}")
        return jsonify({'success': False, 'message': 'An unexpected error occurred', 'error': str(e)}), 500
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

# --- Analytics Endpoints for All Systems ---

def get_system_analytics(system_name, detail_json_field=None):
    """
    Generic function to retrieve system-specific license data for analytics.
    :param system_name: The name of the system (e.g., 'LSQ', 'DMS').
    :param detail_json_field: Optional. The JSON path within details_json to extract for distribution (e.g., '$.lsq.licenseType').
    """
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Get monthly assignment trends for Active licenses of the given system
        assignment_trend_query = """
        SELECT
            DATE_FORMAT(assignment_date, '%Y-%m') AS month,
            COUNT(*) AS count
        FROM `licenses`
        WHERE `system` = %s AND `status` = 'Active'
        GROUP BY month
        ORDER BY month ASC;
        """
        cursor.execute(assignment_trend_query, (system_name,))
        assignment_trends = cursor.fetchall()
        print(f"DEBUG: {system_name} Assignment Trends: {assignment_trends}")

        # Get count of Active licenses by a specific detail field if provided
        distribution_data = []
        if detail_json_field:
            distribution_query = f"""
            SELECT
                JSON_UNQUOTE(JSON_EXTRACT(details_json, %s)) AS category,
                COUNT(*) AS count
            FROM `licenses`
            WHERE `system` = %s AND `status` = 'Active'
            GROUP BY category;
            """
            cursor.execute(distribution_query, (detail_json_field, system_name))
            distribution_data = cursor.fetchall()
            print(f"DEBUG: {system_name} Distribution by {detail_json_field}: {distribution_data}")

        return {
            'success': True,
            'distribution': distribution_data,
            'assignment_trends': assignment_trends
        }
    except mysql.connector.Error as err:
        print(f"ERROR: Database error in get_system_analytics for {system_name}: {err}")
        return {'success': False, 'message': 'Database error', 'error': str(err)}
    except Exception as e:
        print(f"ERROR: An unexpected error occurred in get_system_analytics for {system_name}: {e}")
        return {'success': False, 'message': 'An unexpected error occurred', 'error': str(e)}
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.route('/api/lsq_analytics', methods=['GET'])
def get_lsq_analytics():
    """Retrieves LSQ-specific license data for analytics."""
    return jsonify(get_system_analytics('LSQ', '$.lsq.licenseType'))

@app.route('/api/dms_analytics', methods=['GET'])
def get_dms_analytics():
    """Retrieves DMS-specific license data for analytics."""
    # For DMS, we can use dealerName for distribution, or just overall counts if no specific type field
    return jsonify(get_system_analytics('DMS', '$.dms.dealerName')) 

@app.route('/api/crm_analytics', methods=['GET'])
def get_crm_analytics():
    """Retrieves CRM-specific license data for analytics."""
    # For CRM, we can use hubName or dealerName for distribution
    return jsonify(get_system_analytics('CRM', '$.crm.hubName'))

@app.route('/api/zoho_analytics', methods=['GET'])
def get_zoho_analytics():
    """Retrieves ZOHO-specific license data for analytics."""
    # For ZOHO, we can use role for distribution
    return jsonify(get_system_analytics('ZOHO', '$.zoho.role'))


if __name__ == '__main__':
    app.run(debug=True, port=7878)