# BotZilla

BotZilla is an AI-powered email automation tool designed to streamline the process of scheduling meetings and managing tasks. It automatically reads emails, classifies them for scheduling meetings or task assignments, and then takes appropriate actions such as updating calendars and Notion databases. A user-friendly dashboard allows you to confirm scheduled meetings to prevent scams and view your daily agenda.

## Features

- **Email Classification & Extraction:**  
  Uses an Ollama LLM (70B parameters) via Python to read and extract key information from emails, categorizing them as meeting requests or task assignments.

- **Meeting Scheduling:**  
  Automatically schedules meetings by adding events to the calendar for all intended attendees.  
  *Upcoming Enhancement:* When a meeting conflicts with an existing event, BotZilla will prompt for a reschedule by suggesting alternative time slots.

- **Task Management:**  
  Extracts task details from emails and updates a Notion database with tasks, assigning them to the correct individuals with appropriate priority levels.

- **Dashboard Interface:**  
  A React-based frontend allows users to:
  - Confirm AI-detected meetings before final scheduling.
  - View today's meetings and Notion-based tasks.

## Technology Stack

- **Backend:** Express.js
- **Email Processing & AI:** Python (integrated with Ollama LLM 70B)
- **Frontend:** React.js
- **Task Management:** Notion API
- **Calendar Integration:** Google Calendar (via GoolgeCalanderService)

## Repository Structure

Below is an overview of the key modules/services in the repository:

- **ClassifierAndExtractorService**  
  Contains the logic for classifying emails and extracting relevant information.

- **FrontendDashboard**  
  The React-based dashboard for users to view and confirm meetings and tasks.

- **GoolgeCalanderService**  
  Service for integrating and updating the calendar with scheduled meetings.

- **MailReadingService**  
  Handles connecting to and reading emails automatically.

- **MeetingConfirmationBackend**  
  Manages the backend processes for confirming and finalizing meetings scheduled by the AI.

- **NotionService**  
  Integrates with the Notion API to add and manage tasks extracted from emails.

## Installation & Setup

### Prerequisites

- [Node.js](https://nodejs.org/) and npm
- [Python 3](https://www.python.org/)
- Notion API credentials
- Email service credentials (IMAP/SMTP details)
- Google Calendar API credentials (if using calendar integrations)
