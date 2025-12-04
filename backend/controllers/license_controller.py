from flask import Blueprint, request, jsonify
from models.license_model import get_all_licenses, create_license, update_license, reactivate_license_db, get_system_analytics
import mysql.connector

license_bp = Blueprint('license', __name__)

@license_bp.route('/api/licenses', methods=['GET'])
def get_licenses():
    """
    Retrieves licenses from the database, with optional filtering.
    """
    try:
        filters = {
            'system': request.args.get('system'),
            'status': request.args.get('status'),
            'query': request.args.get('query'),
            'assignment_date_start': request.args.get('assignment_date_start'),
            'assignment_date_end': request.args.get('assignment_date_end')
        }
        licenses_data = get_all_licenses(filters)
        return jsonify(licenses_data)
    except mysql.connector.Error as err:
        return jsonify({'message': 'Database error', 'error': str(err)}), 500
    except Exception as e:
        print(f"ERROR: An unexpected error occurred in get_licenses: {e}")
        return jsonify({'message': 'An unexpected error occurred', 'error': str(e)}), 500

@license_bp.route('/api/licenses', methods=['POST'])
def add_license():
    """
    Adds a new license to the database.
    """
    data = request.get_json()
    print(f"DEBUG: Received data for add_license: {data}")

    required_fields = ['ticketId', 'system', 'name', 'assignmentDate', 'requestedDate', 'requestorName']
    if not all(field in data for field in required_fields):
        missing = [field for field in required_fields if field not in data]
        print(f"ERROR: Missing required fields for add_license: {missing}")
        return jsonify({'success': False, 'message': f'Missing required license data: {", ".join(missing)}'}), 400

    try:
        license_id = create_license(data)
        print(f"DEBUG: License added successfully: {license_id}")
        return jsonify({'success': True, 'message': 'License added successfully', 'id': license_id}), 201
    except mysql.connector.Error as err:
        return jsonify({'success': False, 'message': 'Database error', 'error': str(err)}), 500
    except Exception as e:
        print(f"ERROR: An unexpected error occurred in add_license: {e}")
        return jsonify({'success': False, 'message': 'An unexpected error occurred', 'error': str(e)}), 500

@license_bp.route('/api/licenses/<string:license_id>', methods=['PUT'])
def update_license_route(license_id):
    """
    Updates an existing license's status, removal details, and attachment data.
    """
    data = request.get_json()
    print(f"DEBUG: Received data for update_license (ID: {license_id}): {data}")

    try:
        success, message = update_license(license_id, data)
        if not success:
             # If message indicates no fields provided, return 400, else 200 with failure message (as per original logic somewhat)
             # Original logic: if not set_clauses return 400. if rowcount 0 return 200 with success=False.
             if message == 'No fields provided for update':
                 return jsonify({'success': False, 'message': message}), 400
             return jsonify({'success': False, 'message': message})
        
        print(f"DEBUG: License ID {license_id} updated successfully.")
        return jsonify({'success': True, 'message': message})
    except mysql.connector.Error as err:
        return jsonify({'success': False, 'message': 'Database error', 'error': str(err)}), 500
    except Exception as e:
        print(f"ERROR: An unexpected error occurred in update_license: {e}")
        return jsonify({'success': False, 'message': 'An unexpected error occurred', 'error': str(e)}), 500

@license_bp.route('/api/licenses/<string:license_id>/reactivate', methods=['PUT'])
def reactivate_license(license_id):
    """
    Reactivates an inactive license.
    """
    data = request.get_json()
    reason = data.get('reason')
    new_assignment_date = data.get('newAssignmentDate')
    attachment_data = data.get('attachmentData')

    print(f"DEBUG: Reactivate endpoint hit for license ID: {license_id}")

    if not reason or not new_assignment_date:
        print("ERROR: Reactivation reason or new assignment date missing.")
        return jsonify({'success': False, 'message': 'Reactivation reason and new assignment date are required'}), 400

    try:
        success, result = reactivate_license_db(license_id, reason, new_assignment_date, attachment_data)
        if not success:
            print(f"WARNING: License ID {license_id} not found or no changes made during reactivation update.")
            return jsonify({'success': False, 'message': result}), 404
        
        print(f"DEBUG: License ID {license_id} reactivated successfully. Ticket {result} created.")
        return jsonify({'success': True, 'message': 'License reactivated successfully'})
    except mysql.connector.Error as err:
        return jsonify({'success': False, 'message': 'Database error', 'error': str(err)}), 500
    except Exception as e:
        print(f"ERROR: An unexpected error occurred in reactivate_license: {e}")
        return jsonify({'success': False, 'message': 'An unexpected error occurred', 'error': str(e)}), 500

# Analytics Routes
@license_bp.route('/api/lsq_analytics', methods=['GET'])
def get_lsq_analytics():
    """Retrieves LSQ-specific license data for analytics."""
    try:
        return jsonify(get_system_analytics('LSQ', '$.lsq.licenseType'))
    except Exception as e:
        return jsonify({'success': False, 'message': 'An unexpected error occurred', 'error': str(e)}), 500

@license_bp.route('/api/dms_analytics', methods=['GET'])
def get_dms_analytics():
    """Retrieves DMS-specific license data for analytics."""
    try:
        return jsonify(get_system_analytics('DMS', '$.dms.dealerName'))
    except Exception as e:
        return jsonify({'success': False, 'message': 'An unexpected error occurred', 'error': str(e)}), 500

@license_bp.route('/api/crm_analytics', methods=['GET'])
def get_crm_analytics():
    """Retrieves CRM-specific license data for analytics."""
    try:
        return jsonify(get_system_analytics('CRM', '$.crm.hubName'))
    except Exception as e:
        return jsonify({'success': False, 'message': 'An unexpected error occurred', 'error': str(e)}), 500

@license_bp.route('/api/zoho_analytics', methods=['GET'])
def get_zoho_analytics():
    """Retrieves ZOHO-specific license data for analytics."""
    try:
        return jsonify(get_system_analytics('ZOHO', '$.zoho.role'))
    except Exception as e:
        return jsonify({'success': False, 'message': 'An unexpected error occurred', 'error': str(e)}), 500
