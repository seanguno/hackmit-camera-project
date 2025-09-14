# Gmail Integration

Automatically send follow-up emails to people you meet at HackMIT using your smart glasses conversation data.

## 🚀 Features

- **Automatic Email Sending**: Sends personalized follow-up emails after voice conversations
- **Beautiful HTML Templates**: Professional-looking emails with conversation summaries
- **OAuth2 Security**: Secure Gmail API integration
- **Conversation Context**: Includes conversation summaries and personal details
- **Pipeline Integration**: Seamlessly integrated with voice-to-database pipeline

## 📋 Setup Instructions

### 1. Gmail API Credentials

You need to set up Gmail API credentials in Google Cloud Console:

1. Go to [Google Cloud Console](https://console.developers.google.com/)
2. Create a new project or select existing one
3. Enable the Gmail API
4. Create OAuth2 credentials
5. Add your credentials to `.env`:

```env
GMAIL_CLIENT_ID=your_client_id_here
GMAIL_CLIENT_SECRET=your_client_secret_here
GMAIL_REFRESH_TOKEN=your_refresh_token_here
```

### 2. OAuth2 Setup

Run the setup script to authenticate:

```bash
node src/gmail/setupGmail.js setup
```

Follow the instructions to complete OAuth2 flow.

### 3. Test Email Sending

Test the email functionality:

```bash
node src/gmail/setupGmail.js test
```

## 📧 Email Template

The system sends professional follow-up emails with:

- **Personalized greeting** with the person's name
- **Conversation summary** from your voice transcription
- **Field of interest** mention
- **Call-to-action** for staying in touch
- **Professional branding** with HackMIT theme

## 🔄 Pipeline Integration

The Gmail integration is automatically part of the voice pipeline:

1. **Voice Record** → Record conversation
2. **Transcribe** → Convert speech to text
3. **Claude Process** → Extract structured data
4. **Save to Supabase** → Store in database
5. **Send Email** → Automatically send follow-up ✨

## 📁 File Structure

```
src/gmail/
├── gmailService.js      # Core Gmail API service
├── setupGmail.js        # OAuth2 setup and testing
├── emailIntegration.js  # Pipeline integration
├── requirements.txt     # Dependencies
└── README.md           # This file
```

## 🛠️ Usage

### Manual Email Sending

```javascript
const EmailIntegration = require('./gmail/emailIntegration')

const emailIntegration = new EmailIntegration()

const contactData = {
    email: 'person@example.com',
    name: 'John Doe',
    field: 'Computer Science',
    summary: {
        summaries: [{
            summary: 'Great conversation about AI and machine learning'
        }]
    }
}

await emailIntegration.sendFollowUpEmail(contactData)
```

### Automatic Pipeline

The email sending is automatically integrated into the voice pipeline. Just run:

```bash
node src/test_supabase.js
```

And emails will be sent automatically if:
- Gmail service is configured
- Contact has an email address
- Conversation was successfully processed

## 🔒 Security

- Uses OAuth2 for secure Gmail API access
- No passwords stored
- Refresh tokens for long-term access
- Scoped permissions (only email sending)

## 🎯 HackMIT Features

- **Smart Glasses Integration**: Captures conversation context
- **Mentor Track**: Perfect for networking at hackathons
- **Professional Follow-ups**: Maintain connections after the event
- **Conversation Memory**: Never forget what you discussed

## 🚨 Troubleshooting

### Common Issues

1. **"Gmail service not ready"**
   - Run: `node src/gmail/setupGmail.js setup`

2. **"Missing environment variables"**
   - Check your `.env` file has Gmail credentials

3. **"No email address found"**
   - Make sure Claude extracted an email from the conversation

4. **OAuth2 errors**
   - Make sure you copied the authorization code correctly
   - Check that redirect URI matches your OAuth2 settings

### Getting Help

Check the console output for detailed error messages and setup instructions.
