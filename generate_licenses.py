# generate_licenses.py
import uuid
import random
from datetime import datetime, timedelta
import json

# --- Data for Generation ---
indian_names = [
    "Ayush Rawat", "Ankit Jain", "Shobhit Acharya", "Deepak Lohani", "Parvesh Sharma",
    "Priya Singh", "Rahul Kumar", "Neha Gupta", "Amit Verma", "Sakshi Bansal",
    "Vikas Yadav", "Swati Mishra", "Gaurav Sharma", "Anjali Kumari", "Mohit Pandey",
    "Shruti Aggarwal", "Ashish Dixit", "Kajal Devi", "Sandeep Kumar", "Divya Sharma",
    "Manish Kumar", "Pooja Sharma", "Rohit Singh", "Sneha Kumari", "Vivek Patel",
    "Ritu Chauhan", "Saurabh Malik", "Meena Devi", "Arjun Sharma", "Preeti Singh",
    "Akash Verma", "Simran Kaur", "Harish Kumar", "Khushi Gupta", "Nitin Sharma",
    "Geeta Rani", "Sumit Singh", "Sonam Kumari", "Rakesh Kumar", "Shweta Sharma",
    "Ajay Rajput", "Sapna Devi", "Vijay Singh", "Reena Kumari", "Dinesh Kumar",
    "Madhu Sharma", "Pankaj Yadav", "Sunita Singh", "Rajesh Kumar", "Jyoti Devi",
    "Sanjay Singh", "Kiran Devi", "Ravi Kumar", "Poonam Sharma", "Anil Yadav",
    "Arti Devi", "Brijesh Singh", "Mamta Kumari", "Kamal Kumar", "Seema Sharma",
    "Chandan Singh", "Rekha Devi", "Gopal Kumar", "Sita Devi", "Prem Kumar",
    "Lata Devi", "Manoj Singh", "Rita Kumari", "Naveen Kumar", "Pinky Devi",
    "Surendra Singh", "Sarita Kumari", "Dharmendra Kumar", "Usha Devi", "Ashok Singh",
    "Pushpa Kumari", "Vinod Kumar", "Savita Devi", "Om Prakash", "Shanti Devi",
    "Ram Kumar", "Kanta Devi", "Shiv Kumar", "Priya Kumari", "Krishan Kumar",
    "Monika Devi", "Pradeep Singh", "Renu Devi", "Suresh Kumar", "Deepa Kumari",
    "Raj Kumar", "Nisha Devi", "Jagdish Singh", "Neelam Kumari", "Bharat Kumar",
    "Pawan Kumar", "Rani Devi", "Balram Singh", "Sheetal Kumari", "Arvind Kumar",
    "Ankita Devi", "Dinesh Sharma", "Poonam Rani", "Karan Singh", "Bharti Devi",
    "Amit Kumar", "Sushma Kumari", "Prakash Singh", "Nirmala Devi", "Girish Kumar",
    "Priyanka Devi", "Vijay Kumar", "Sonia Kumari", "Mithilesh Kumar", "Kusum Devi",
    "Sanju Singh", "Shivani Kumari", "Ashok Kumar", "Suman Devi", "Raju Singh",
    "Vandana Kumari", "Gopal Sharma", "Madhavi Devi", "Harish Singh", "Bindu Kumari",
    "Nilesh Kumar", "Anju Devi", "Pramod Singh", "Nidhi Kumari", "Mukesh Kumar",
    "Shalini Devi", "Santosh Singh", "Asha Kumari", "Deepak Kumar", "Mamta Sharma",
    "Kamlesh Singh", "Reema Devi", "Rajeshwari Kumari", "Dilip Kumar", "Pooja Rani",
    "Ranjit Singh", "Sunita Kumari", "Subhash Kumar", "Anjali Sharma", "Babloo Singh",
    "Meena Kumari"
]

hubs = [
    "Revolt Hub Kolkata", "Revolt Hub Kochi", "Revolt Hub Nellore", "Revolt Hub Patna",
    "Revolt Hub Bhopal", "Revolt Hub Noida", "Revolt Hub Bhubaneswar", "Revolt Hub DOMBIVLI",
    "Revolt Hub Raipur", "Revolt Hub Andheri", "Revolt Hub Agra", "Revolt Hub Aurangabad",
    "Revolt Hub Durg", "Revolt Hub Meerut", "Revolt Hub Purnia", "Revolt Hub Wazirabad",
    "Revolt Hub Gurgaon", "Revolt Hub Nagpur", "Revolt Hub Sasaram", "Revolt Hub BILASPUR",
    "Revolt Hub Naroda", "Revolt Hub Mahbubnagar", "Revolt Hub Palwal", "Revolt Hub Gwalior",
    "Revolt Hub Dhule", "Revolt Hub Aligarh", "Revolt Hub Amroha", "Revolt Hub Delhi"
]

dealer_codes = [
    "DLR-NAG-0046", "DLR-SAS-00142", "DLR-BIL-0106", "DLR-NAR-00142", "DLR-MAH-00143",
    "DLR-PAL-00148", "DLR-GWA-00145", "DLR-DHU-00144", "DLR-SUR-0119",
    "DLR-KOL-001", "DLR-KOC-002", "DLR-NEL-003", "DLR-PAT-004", "DLR-BHO-005",
    "DLR-NOI-006", "DLR-BHU-007", "DLR-DOM-008", "DLR-RAI-009", "DLR-AND-010",
    "DLR-AGR-011", "DLR-AUR-012", "DLR-DUR-013", "DLR-MEC-014", "DLR-PUR-015",
    "DLR-WAZ-016", "DLR-GUR-017", "DLR-NAG-018", "DLR-SAS-019", "DLR-BIP-020",
    "DLR-NAR-021", "DLR-MAH-022", "DLR-PAL-023", "DLR-GWA-024", "DLR-DHU-025",
    "DLR-ALI-026", "DLR-AMR-027", "DLR-DEL-028"
]

systems = ["DMS", "LSQ", "CRM", "RUPESH"]
request_types = ["Add License", "Modify License"]
roles = ["Sales", "Marketing", "Support", "Admin", "User", "Manager"]

# Function to generate a random date within a range
def random_date(start_year, end_year):
    start_date = datetime(start_year, 1, 1)
    end_date = datetime(end_year, 12, 31)
    time_between_dates = end_date - start_date
    days_between_dates = time_between_dates.days
    random_number_of_days = random.randrange(days_between_dates)
    random_past_date = start_date + timedelta(days=random_number_of_days)
    return random_past_date.strftime('%Y-%m-%d')

# Function to generate a random mobile number
def generate_mobile():
    return f"9{random.randint(700000000, 999999999)}"

# Function to generate email based on name
def generate_email(name):
    first, last = name.split(" ", 1) if " " in name else (name, "")
    return f"{first.lower().replace(' ', '')}{last.lower().replace(' ', '')}{random.randint(1, 99)}@example.com"

# Function to extract city from hub name (simple heuristic)
def get_city_from_hub(hub_name):
    # This map prioritizes specific hub names to their common city associations
    city_map = {
        "Kolkata": "Kolkata", "Kochi": "Kochi", "Nellore": "Nellore", "Patna": "Patna",
        "Bhopal": "Bhopal", "Noida": "Noida", "Bhubaneswar": "Bhubaneswar", "DOMBIVLI": "Dombivli",
        "Raipur": "Raipur", "Andheri": "Mumbai", "Agra": "Agra", "Aurangabad": "Aurangabad",
        "Durg": "Durg", "Meerut": "Meerut", "Purnia": "Purnia", "Wazirabad": "Delhi", # Wazirabad is a place in Delhi
        "Gurgaon": "Gurgaon", "Nagpur": "Nagpur", "Sasaram": "Sasaram", "BILASPUR": "Bilaspur",
        "Naroda": "Ahmedabad", "Mahbubnagar": "Mahbubnagar", "Palwal": "Palwal",
        "Gwalior": "Gwalior", "Dhule": "Dhule", "Aligarh": "Aligarh", "Amroha": "Amroha",
        "Delhi": "Delhi"
    }
    # Check if a direct mapping exists for any part of the hub name
    for key, value in city_map.items():
        if key.lower() in hub_name.lower():
            return value
    return "Unknown City" # Default if no specific city can be determined

# --- Generate SQL Queries ---
sql_queries = []
for i in range(1, 151): # Generate 150 queries
    license_id = str(uuid.uuid4())
    ticket_id = f"TICKET-{random.randint(10000, 99999)}"
    system = random.choice(systems)
    name = random.choice(indian_names)
    mobile = generate_mobile()
    email = generate_email(name)
    request_type = random.choice(request_types)
    assignment_date = random_date(2022, 2024)
    
    expiry_date = None
    if request_type == "Modify License" or random.random() < 0.5: # 50% chance for new licenses to have expiry
        # Ensure expiry date is after assignment date
        assign_dt = datetime.strptime(assignment_date, '%Y-%m-%d')
        expiry_dt = assign_dt + timedelta(days=random.randint(365, 730)) # 1 to 2 years later
        expiry_date = expiry_dt.strftime('%Y-%m-%d')

    status = random.choice(['Active', 'Inactive']) # Random status for variety

    details_json = {}
    if system == "DMS":
        chosen_hub = random.choice(hubs)
        details_json['dms'] = {
            "dealerName": f"{name.split(' ')[0]} Motors",
            "dealerCode": random.choice(dealer_codes),
            "locationCode": f"LOC-{random.randint(100, 999)}",
            "city": get_city_from_hub(chosen_hub),
            "hubName": chosen_hub
        }
    elif system == "LSQ":
        chosen_hub = random.choice(hubs)
        details_json['lsq'] = {
            "salesExecutiveName": name,
            "mobileNumber": mobile,
            "hubName": chosen_hub,
            "city": get_city_from_hub(chosen_hub)
        }
    elif system == "CRM":
        chosen_hub = random.choice(hubs)
        details_json['crm'] = {
            "dealerName": f"{name.split(' ')[0]} CRM Solutions",
            "hubName": chosen_hub,
            "city": get_city_from_hub(chosen_hub)
        }
    elif system == "ZOHO":
        first_name, last_name = (name.split(" ", 1) if " " in name else (name, "User"))
        details_json['zoho'] = {
            "firstName": first_name,
            "lastName": last_name,
            "emailAddress": email,
            "role": random.choice(roles),
            "accountCreatedTime": random_date(2020, 2023) # Zoho account might be older
        }
    
    # Dump JSON to string, escaping single quotes for SQL insertion
    details_json_str = json.dumps(details_json).replace("'", "''")

    # For removal_details_json, add it only if status is 'Inactive'
    removal_details_json_sql_value = "NULL"
    if status == 'Inactive':
        removal_ticket_id = f"REM-TICKET-{random.randint(1000, 9999)}"
        removal_date = random_date(2024, 2025) # Recent removal dates
        removal_reason = random.choice(["User left company", "Project completed", "License downgraded", "Deactivated by request", "Duplicate entry"])
        remover_name = random.choice(indian_names)
        removal_details = {
            "ticketId": removal_ticket_id,
            "date": removal_date,
            "reason": removal_reason,
            "remover": remover_name
        }
        # Quote the JSON string and escape internal single quotes
        removal_details_json_sql_value = f"'{json.dumps(removal_details).replace("'", "''")}'" 

    # Construct the SQL INSERT statement
    sql_query = f"""
INSERT INTO `licenses` (`id`, `ticket_id`, `system`, `name`, `mobile`, `email`, `request_type`, `assignment_date`, `expiry_date`, `status`, `details_json`, `removal_details_json`)
VALUES (
    '{license_id}',
    '{ticket_id}',
    '{system}',
    '{name.replace("'", "''")}', -- Escape single quotes in names
    '{mobile}',
    '{email}',
    '{request_type}',
    '{assignment_date}',
    {f"'{expiry_date}'" if expiry_date else "NULL"},
    '{status}',
    '{details_json_str}',
    {removal_details_json_sql_value}
);
"""
    sql_queries.append(sql_query.strip()) # .strip() removes leading/trailing whitespace/newlines

# Join all queries with newlines
final_sql_output = "\n".join(sql_queries)

# Print to console (you can redirect this output to a file)
print(final_sql_output)