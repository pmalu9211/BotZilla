import os
import time
import base64
import json
import requests  # For making HTTP requests
import mysql.connector  # For MySQL connection
from datetime import timezone, timedelta
from dateutil import parser

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# MySQL Connection Details
MYSQL_HOST = "localhost"
MYSQL_USER = "root"
MYSQL_PASSWORD = "rootpassword"
MYSQL_DATABASE = "meetings_db"
MYSQL_PORT = 3306

SCOPES = ['https://www.googleapis.com/auth/gmail.readonly']

def normalize_response(text):
    """
    Normalizes the classifier response by stripping extra whitespace and quotes.
    This function will remove both single and double quotes from the start and end
    of the response until no matching quotes remain.
    """
    text = text.strip()
    # Remove matching quotes repeatedly
    while (text.startswith('"') and text.endswith('"')) or (text.startswith("'") and text.endswith("'")):
        text = text[1:-1].strip()
    return text.lower()

def main():
    # --- Authentication ---
    creds = None
    # token.json stores your access and refresh tokens.
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file('credentials.json', SCOPES)
            creds = flow.run_local_server(port=0, access_type='offline', prompt='consent')
        with open('token.json', 'w') as token:
            token.write(creds.to_json())

    service = build('gmail', 'v1', credentials=creds)

    profile = service.users().getProfile(userId='me').execute()
    last_history_id = profile.get('historyId')
    print("Monitoring new messages starting from historyId:", last_history_id)

    while True:
        try:
            response = service.users().history().list(
                userId='me', 
                startHistoryId=last_history_id,
                historyTypes=['messageAdded']
            ).execute()
            
            history_records = response.get('history', [])
            if history_records:
                for record in history_records:
                    if 'messagesAdded' in record:
                        for added in record['messagesAdded']:
                            message = added.get('message')
                            try:
                                msg = service.users().messages().get(
                                    userId='me', id=message['id'], format='full'
                                ).execute()
                                print_message_details(msg)
                            except HttpError as error:
                                if error.resp.status == 404:
                                    print(f"Message with id {message['id']} not found, skipping.")
                                    continue
                                else:
                                    print("Error retrieving message:", error)
            last_history_id = response.get('historyId', last_history_id)
        except Exception as e:
            print("Error retrieving history:", e)
            if "historyId" in str(e):
                profile = service.users().getProfile(userId='me').execute()
                last_history_id = profile.get('historyId')
                print("Resetting historyId to:", last_history_id)
        time.sleep(5)

def print_message_details(msg):
    headers = msg['payload'].get('headers', [])
    subject = sender = receiver = ''
    for header in headers:
        header_name = header.get('name', '').lower()
        if header_name == 'subject':
            subject = header.get('value', '')
        elif header_name == 'from':
            sender = header.get('value', '')
        elif header_name == 'to':
            receiver = header.get('value', '')
    
    if "calendar-notification@google.com" in sender.lower():
        print(f"Skipping calendar notification email from {sender}")
        return

    body = get_message_body(msg.get('payload'))
    email_content = (
        f"Message ID: {msg.get('id')}\n"
        f"Subject: {subject}\n"
        f"From: {sender}\n"
        f"To: {receiver}\n"
        f"Body:\n{body}"
    )
    
    print("\n" + email_content)
    print("-" * 50)

    try:
        # Call the classifier to determine if the email is about a meeting or a task.
        classifier_payload = {"email": email_content}
        classifier_response = requests.post(
            "https://spitparserapi.onrender.com/response/meetingornot",
            json=classifier_payload,
        )
        classifier_response.raise_for_status()

        raw_response = classifier_response.text
        classification = normalize_response(raw_response)
        print("Classifier response (normalized):", classification)

        if classification == 'meeting':
            # Process as a meeting request
            meeting_time_payload = {"email_body": email_content}
            meeting_time_response = requests.post(
                "https://spitparserapi.onrender.com/response/meetingTime",
                json=meeting_time_payload,
            )
            meeting_time_response.raise_for_status()
            schedule_payload = meeting_time_response.json()
            print("Meeting time response (used for scheduling):", schedule_payload)
            insert_meeting_record(schedule_payload)
        elif classification == 'task':
            # Process as a task assignment
            task_payload = {"command": email_content}
            task_response = requests.post(
                "https://spitnotionagent.onrender.com/process-task",
                json=task_payload,
            )
            task_response.raise_for_status()
            print("Task processing response:", task_response.text)
        else:
            # For 'no', 'skip', or any other response, skip processing.
            print("No actionable command detected (or command is 'no'/'skip'). Skipping email.")
    except requests.exceptions.RequestException as req_err:
        print("HTTP error during meeting/task check request:", req_err)
    except Exception as e:
        print("Error processing meeting/task check:", e)

def get_message_body(payload):
    body = ""
    if 'parts' in payload:
        for part in payload['parts']:
            if part.get('mimeType', '').startswith('multipart'):
                body += get_message_body(part)
            elif part.get('mimeType') == 'text/plain':
                data = part.get('body', {}).get('data')
                if data:
                    try:
                        text = base64.urlsafe_b64decode(data).decode('utf-8')
                        body += text
                    except Exception as decode_error:
                        print("Error decoding part:", decode_error)
    else:
        data = payload.get('body', {}).get('data')
        if data:
            try:
                body = base64.urlsafe_b64decode(data).decode('utf-8')
            except Exception as decode_error:
                print("Error decoding message body:", decode_error)
    return body

def check_free_slot(schedule_payload):
    start = schedule_payload.get("start")
    end = schedule_payload.get("end")
    if not start or not end:
        return False, "Missing start or end time in payload"
    try:
        url = "http://localhost:3000/api/freebusy"
        params = {"start": start, "end": end}
        response = requests.get(url, params=params, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("busy"):
                return False, data.get("busyTimes", [])
            else:
                return True, None
        else:
            return False, f"Error from freebusy check: HTTP {response.status_code}"
    except Exception as e:
        return False, str(e)

def insert_meeting_record(schedule_payload):
    """
    Inserts a new meeting record into the meeting_confirmations table.
    Ensures the meeting time is stored in IST.
    """
    meeting_id = schedule_payload.get("meeting_id", "")
    raw_timing = schedule_payload.get("start", None)  # Use the 'start' field from payload.
    timing = None
    if raw_timing:
        try:
            dt = parser.isoparse(raw_timing)  # dt already has +05:30 if provided.
            # Force conversion to IST
            ist = timezone(timedelta(hours=5, minutes=30))
            timing = dt.astimezone(ist).strftime("%Y-%m-%d %H:%M:%S")
        except Exception as e:
            print("Error parsing timing:", e)
            timing = None

    attendees = schedule_payload.get("attendees", [])
    # Assume the organizer is the first and recipient is the second if available.
    recipient_name = attendees[1] if len(attendees) > 1 else (attendees[0] if attendees else "")
    title = schedule_payload.get("summary", "")
    status = "pending"  # New confirmations are pending.
    json_string = json.dumps(schedule_payload)
    
    try:
        conn = mysql.connector.connect(
            host=MYSQL_HOST,
            user=MYSQL_USER,
            password=MYSQL_PASSWORD,
            database=MYSQL_DATABASE,
            port=MYSQL_PORT
        )
        cursor = conn.cursor()
        insert_query = """
            INSERT INTO meeting_confirmations (meeting_id, recipient_name, title, timing, status, json_string)
            VALUES (%s, %s, %s, %s, %s, %s)
        """
        cursor.execute(insert_query, (meeting_id, recipient_name, title, timing, status, json_string))
        conn.commit()
        print("Meeting request added to the database successfully.")
    except mysql.connector.Error as err:
        print("Error inserting meeting record:", err)
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

if __name__ == '__main__':
    main()
