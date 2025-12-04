from .db_connection import get_db_connection
import mysql.connector
import json
import uuid
from datetime import datetime, date

def get_all_licenses(filters):
    """
    Retrieves licenses from the database, with optional filtering.
    """
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Build dynamic WHERE clause based on query parameters
        conditions = []
        params = []

        if filters.get('system'):
            conditions.append("`system` = %s")
            params.append(filters['system'])

        if filters.get('status'):
            conditions.append("`status` = %s")
            params.append(filters['status'])

        if filters.get('query'):
            search_pattern = f"%{filters['query']}%"
            conditions.append("(`name` LIKE %s OR `email` LIKE %s OR `mobile` LIKE %s)")
            params.extend([search_pattern, search_pattern, search_pattern])

        if filters.get('assignment_date_start'):
            conditions.append("`assignment_date` >= %s")
            params.append(filters['assignment_date_start'])

        if filters.get('assignment_date_end'):
            conditions.append("`assignment_date` <= %s")
            params.append(filters['assignment_date_end'])

        # Build the full query
        query = """
        SELECT `id`, `ticket_id`, `system`, `name`, `mobile`, `email`, `request_type`,
               `assignment_date`, `expiry_date`, `status`, `details_json`, `removal_details_json`,
               `attachment_data`, `created_at`, `updated_at`, `requested_date`, `requestor_name`
        FROM `licenses`
        """
        if conditions:
            query += " WHERE " + " AND ".join(conditions)
        query += " ORDER BY `assignment_date` DESC"

        print(f"DEBUG: Executing licenses GET query: {query} with params: {params}")

        cursor.execute(query, tuple(params))
        licenses_data = cursor.fetchall()

        # Parse JSON fields and format dates
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
            
            for date_field in ['assignment_date', 'expiry_date', 'created_at', 'updated_at', 'requested_date']:
                if isinstance(license.get(date_field), (date, datetime)):
                    license[date_field] = license[date_field].isoformat()
                elif license.get(date_field) is None:
                    license[date_field] = None

        return licenses_data
    except mysql.connector.Error as err:
        print(f"ERROR: Database error in get_licenses: {err}")
        raise
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

def create_license(data):
    """
    Adds a new license to the database.
    """
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
        return license_id
    except mysql.connector.Error as err:
        print(f"ERROR: Database error in add_license: {err}")
        raise
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

def update_license(license_id, data):
    """
    Updates an existing license.
    """
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        new_status = data.get('status')
        new_removal_details_json = data.get('removal_details_json')
        new_attachment_data = data.get('attachmentData')

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
        
        if 'details_json' in data and data['details_json'] is not None:
            set_clauses.append("`details_json` = %s")
            params.append(json.dumps(data['details_json']))

        set_clauses.append("`updated_at` = CURRENT_TIMESTAMP")

        if not set_clauses:
            return False, 'No fields provided for update'

        update_query = f"UPDATE `licenses` SET {', '.join(set_clauses)} WHERE `id` = %s"
        params.append(license_id)

        print(f"DEBUG: Executing update_license query: {update_query} with params: {params}")

        cursor.execute(update_query, tuple(params))
        conn.commit()
        
        if cursor.rowcount == 0:
            return False, 'License not found or no changes applied'
        return True, 'License updated successfully'
    except mysql.connector.Error as err:
        print(f"ERROR: Database error in update_license: {err}")
        raise
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

def reactivate_license_db(license_id, reason, new_assignment_date, attachment_data):
    """
    Reactivates a license.
    """
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
            `updated_at` = CURRENT_TIMESTAMP
        WHERE `id` = %s
        """
        update_license_params = (new_assignment_date, attachment_data, license_id)
        print(f"DEBUG: Executing license update for reactivation: {update_license_query} with params: {update_license_params}")

        cursor.execute(update_license_query, update_license_params)
        rows_affected = cursor.rowcount
        conn.commit()

        if rows_affected == 0:
            return False, 'License not found or already active'

        # Add ticket
        ticket_id = f"REACTIVATE-{uuid.uuid4().hex[:8].upper()}"
        action_description = f"Reactivate License for ID {license_id} (Reason: {reason}, New Assignment Date: {new_assignment_date})"
        notes = f"License reactivated by user input. Reason: {reason}"
        add_ticket_query = """
        INSERT INTO `tickets` (`ticket_id`, `action_description`, `status`, `timestamp`, `notes`)
        VALUES (%s, %s, %s, %s, %s)
        """
        ticket_timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        add_ticket_params = (ticket_id, action_description, 'Closed', ticket_timestamp, notes)
        
        cursor.execute(add_ticket_query, add_ticket_params)
        conn.commit()

        return True, ticket_id
    except mysql.connector.Error as err:
        if conn:
            conn.rollback()
        print(f"ERROR: Database error in reactivate_license: {err}")
        raise
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

def get_system_analytics(system_name, detail_json_field=None):
    """
    Generic function to retrieve system-specific license data for analytics.
    """
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

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

        return {
            'success': True,
            'distribution': distribution_data,
            'assignment_trends': assignment_trends
        }
    except mysql.connector.Error as err:
        print(f"ERROR: Database error in get_system_analytics for {system_name}: {err}")
        raise
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
