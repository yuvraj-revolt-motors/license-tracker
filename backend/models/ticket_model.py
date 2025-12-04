from .db_connection import get_db_connection
import mysql.connector
from datetime import datetime, date

def get_all_tickets():
    """
    Retrieves all tickets from the database.
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

        return tickets_data
    except mysql.connector.Error as err:
        print(f"ERROR: Database error in get_tickets: {err}")
        raise
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

def create_ticket(data):
    """
    Adds a new ticket entry to the database.
    """
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
            datetime.strptime(data['timestamp'], '%Y-%m-%dT%H:%M:%S.%fZ').strftime('%Y-%m-%d %H:%M:%S'),
            data.get('notes') or None
        )
        print(f"DEBUG: Executing add_ticket query: {insert_query} with params: {params}")
        cursor.execute(insert_query, params)
        conn.commit()
    except mysql.connector.Error as err:
        print(f"ERROR: Database error in add_ticket: {err}")
        raise
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

def update_ticket(ticket_id, data):
    """
    Updates the status and optionally notes of a specific ticket.
    """
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        new_status = data.get('status')
        new_notes = data.get('notes')

        set_clauses = []
        params = []
        if new_status:
            set_clauses.append("`status` = %s")
            params.append(new_status)
        if new_notes is not None:
            set_clauses.append("`notes` = %s")
            params.append(new_notes)
        
        update_query = f"UPDATE `tickets` SET {', '.join(set_clauses)} WHERE `ticket_id` = %s"
        params.append(ticket_id)

        cursor.execute(update_query, tuple(params))
        conn.commit()
        
        if cursor.rowcount == 0:
            return False
        return True
    except mysql.connector.Error as err:
        print(f"ERROR: Database error in update_ticket_status: {err}")
        raise
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
