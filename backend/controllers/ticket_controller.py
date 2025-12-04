from flask import Blueprint, request, jsonify
from models.ticket_model import get_all_tickets, create_ticket, update_ticket
import mysql.connector

ticket_bp = Blueprint('ticket', __name__)

@ticket_bp.route('/api/tickets', methods=['GET'])
def get_tickets():
    """
    Retrieves all tickets from the database.
    """
    try:
        tickets_data = get_all_tickets()
        return jsonify(tickets_data)
    except mysql.connector.Error as err:
        return jsonify({'message': 'Database error', 'error': str(err)}), 500
    except Exception as e:
        print(f"ERROR: An unexpected error occurred in get_tickets: {e}")
        return jsonify({'message': 'An unexpected error occurred', 'error': str(e)}), 500

@ticket_bp.route('/api/tickets', methods=['POST'])
def add_ticket():
    """
    Adds a new ticket entry to the database.
    """
    data = request.get_json()
    print(f"DEBUG: Received data for add_ticket: {data}")

    required_fields = ['ticketId', 'action', 'status', 'timestamp']
    if not all(field in data for field in required_fields):
        missing = [field for field in required_fields if field not in data]
        print(f"ERROR: Missing required fields for add_ticket: {missing}.")
        return jsonify({'success': False, 'message': f'Missing required ticket data: {", ".join(missing)}'}), 400

    try:
        create_ticket(data)
        print(f"DEBUG: Ticket added successfully: {data['ticketId']}")
        return jsonify({'success': True, 'message': 'Ticket added successfully'}), 201
    except mysql.connector.Error as err:
        return jsonify({'success': False, 'message': 'Database error', 'error': str(err)}), 500
    except Exception as e:
        print(f"ERROR: An unexpected error occurred in add_ticket: {e}")
        return jsonify({'success': False, 'message': 'An unexpected error occurred', 'error': str(e)}), 500

@ticket_bp.route('/api/tickets/<string:ticket_id_val>', methods=['PUT'])
def update_ticket_status(ticket_id_val):
    """
    Updates the status and optionally notes of a specific ticket.
    """
    data = request.get_json()
    new_status = data.get('status')
    new_notes = data.get('notes')

    print(f"DEBUG: Attempting to update ticket {ticket_id_val} status to {new_status}, notes: {new_notes}")

    if not new_status and not new_notes:
        return jsonify({'success': False, 'message': 'New status or notes are required for update'}), 400

    try:
        success = update_ticket(ticket_id_val, data)
        if not success:
            print(f"DEBUG: Ticket {ticket_id_val} not found for update.")
            return jsonify({'success': False, 'message': 'Ticket not found'}), 404
        print(f"DEBUG: Ticket {ticket_id_val} updated successfully.")
        return jsonify({'success': True, 'message': 'Ticket updated successfully'})
    except mysql.connector.Error as err:
        return jsonify({'success': False, 'message': 'Database error', 'error': str(err)}), 500
    except Exception as e:
        print(f"ERROR: An unexpected error occurred in update_ticket_status: {e}")
        return jsonify({'success': False, 'message': 'An unexpected error occurred', 'error': str(e)}), 500
