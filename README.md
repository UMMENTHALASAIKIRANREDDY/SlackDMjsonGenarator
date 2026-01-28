# Slack DM Export Generator

A React application with a wizard-style UI that generates Slack-compatible DM exports. The application guides users through a step-by-step process to configure and generate Slack DM export files.

## Features

- **Step-by-step Wizard Flow**: Guided UI that shows fields dynamically based on user input
- **One-on-One DMs**: Configure individual direct messages between two users
- **Group DMs**: Configure group direct messages with multiple members
- **Message Generation Rules**: Customize message generation with various options
- **Slack-Compatible Export**: Generates valid Slack export format
- **ZIP Download**: Automatically downloads the generated export as a ZIP file

## Project Structure

```
.
├── client/                 # React frontend application
│   ├── public/
│   ├── src/
│   │   ├── components/     # Wizard step components
│   │   ├── App.js          # Main app component with wizard logic
│   │   └── index.js        # React entry point
│   └── package.json
├── server/                 # Node.js backend
│   ├── index.js            # Express server
│   ├── slackExportGenerator.js  # Export generation logic
│   └── package.json
├── package.json            # Root package.json with scripts
└── README.md
```

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Installation

1. **Clone or navigate to the project directory**

2. **Install all dependencies** (root, client, and server):
   ```bash
   npm run install-all
   ```

   Or install manually:
   ```bash
   npm install
   cd client && npm install && cd ..
   cd server && npm install && cd ..
   ```

## Running the Application

### Development Mode (Recommended)

Run both frontend and backend concurrently:

```bash
npm run dev
```

This will start:
- **Backend server** on `http://localhost:5000`
- **React frontend** on `http://localhost:3000`

### Manual Start

**Start the backend server:**
```bash
npm run server
# or
cd server && npm start
```

**Start the React frontend** (in a new terminal):
```bash
npm run client
# or
cd client && npm start
```

## Usage

1. **Open your browser** and navigate to `http://localhost:3000`

2. **Step 1 - DM Count Selection**:
   - Enter the number of one-on-one DMs
   - Enter the number of group DMs
   - Click "Next"

3. **Step 2 - One-on-One DM Details**:
   - For each one-on-one DM, enter:
     - DM Channel ID (must start with "D")
     - User ID #1
     - User ID #2 (must be different from User ID #1)
   - Click "Next"

4. **Step 3 - Group DM Details**:
   - For each group DM, enter:
     - Group Name (used as folder name)
     - Channel ID (must start with "C")
     - Creator User ID
     - Member User IDs (comma-separated, minimum 3)
   - Click "Next"

5. **Step 4 - Message Generation Rules**:
   - Set Start Date
   - Set Number of Dates (days)
   - Set Messages per Date
   - Toggle various message features:
     - Include mentions
     - Include double mentions
     - Include reactions
     - Include file uploads
     - Include threads
     - Include forwarded messages
     - Include edited messages
   - Click "Next"

6. **Step 5 - Review & Generate**:
   - Review the summary of your configuration
   - Click "Generate & Download Slack Export"
   - The ZIP file will be automatically downloaded

## API Endpoint

### POST `/api/generate-export`

Generates a Slack-compatible DM export and returns it as a ZIP file.

**Request Body:**
```json
{
  "oneOnOneDMs": [
    {
      "channelId": "D01PKDLKR39",
      "userId1": "U01234567",
      "userId2": "U09876543"
    }
  ],
  "groupDMs": [
    {
      "groupName": "Project Team",
      "channelId": "C0A1Y0LLTDX",
      "creatorUserId": "U01234567",
      "memberUserIds": "U01234567, U09876543, U05555555"
    }
  ],
  "messageRules": {
    "startDate": "2024-01-01",
    "numberOfDates": 7,
    "messagesPerDate": 10,
    "includeMentions": true,
    "includeDoubleMentions": false,
    "includeReactions": true,
    "includeFileUploads": false,
    "includeThreads": true,
    "includeForwardedMessages": false,
    "includeEditedMessages": true
  }
}
```

**Response:**
- ZIP file download (`slack-dm-export.zip`)

## Export Format

The generated export follows Slack's export structure:

```
dm-export/
├── channels/
│   ├── D01PKDLKR39/
│   │   └── messages.json
│   └── ...
└── GroupName/
    └── channels/
        └── C0A1Y0LLTDX/
            └── messages.json
```

Each `messages.json` file contains an array of message objects following Slack's message schema.

## Validation Rules

- **One-on-One DMs**:
  - Channel ID must start with "D"
  - Exactly 2 unique user IDs required

- **Group DMs**:
  - Channel ID must start with "C"
  - Minimum 3 member user IDs required (comma-separated)
  - Group name is required

- **Message Rules**:
  - Start date is required
  - Number of dates must be at least 1
  - Messages per date must be at least 1

## Technologies Used

- **Frontend**: React 18, React Hooks (useState, useReducer)
- **Backend**: Node.js, Express
- **File Generation**: fs-extra, archiver
- **HTTP Client**: Axios

## Development Notes

- The wizard state is managed using React's `useReducer` hook
- Forms are dynamically generated based on user input counts
- All validations are performed client-side before proceeding
- The backend generates temporary files and cleans them up after sending the ZIP

## Troubleshooting

- **Port conflicts**: If port 3000 or 5000 is in use, modify the ports in:
  - `client/package.json` (React scripts)
  - `server/index.js` (PORT variable)

- **CORS issues**: The backend includes CORS middleware. If issues persist, check the CORS configuration in `server/index.js`

- **Download not working**: Ensure the backend is running and accessible at `http://localhost:5000`

## License

MIT
