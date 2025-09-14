import { AppServer, AppSession, ViewType } from '@mentra/sdk';
import * as fs from 'fs';
import * as path from 'path';


const PACKAGE_NAME = process.env.PACKAGE_NAME ?? (() => { throw new Error('PACKAGE_NAME is not set in .env file'); })();
const MENTRAOS_API_KEY = process.env.MENTRAOS_API_KEY ?? (() => { throw new Error('MENTRAOS_API_KEY is not set in .env file'); })();
const PORT = parseInt(process.env.PORT || '3000');

// Function to save conversation data to file
function saveConversationData(text: string, userId: string, sessionId: string) {
  const timestamp = new Date().toISOString();
  const conversationEntry = {
    timestamp,
    userId,
    sessionId,
    text,
    type: 'transcription'
  };
  
  // Create conversations directory if it doesn't exist
  const conversationsDir = path.join(__dirname, '..', 'storage', 'conversations');
  if (!fs.existsSync(conversationsDir)) {
    fs.mkdirSync(conversationsDir, { recursive: true });
  }
  
  // Append to conversation file
  const conversationFile = path.join(conversationsDir, `conversation_${sessionId}.json`);
  const entry = JSON.stringify(conversationEntry) + '\n';
  
  fs.appendFileSync(conversationFile, entry);
  console.log(`Saved conversation entry: ${text}`);
}

class ExampleMentraOSApp extends AppServer {

  constructor() {
    super({
      packageName: PACKAGE_NAME,
      apiKey: MENTRAOS_API_KEY,
      port: PORT,
    });
  }

  protected async onSession(session: AppSession, sessionId: string, userId: string): Promise<void> {
    // Show welcome message
    // session.layouts.showTextWall("Example App is ready!");

    // Handle real-time transcription
    // requires microphone permission to be set in the developer console
    session.events.onTranscription((data) => {
      if (data.isFinal) {
        // Save conversation data instead of showing text wall
        saveConversationData("You said: " + data.text, userId, sessionId);
      }
    })

    session.events.onGlassesBattery((data) => {
      console.log('Glasses battery:', data);
    })
  }
}

// Start the server
// DEV CONSOLE URL: https://console.mentra.glass/
// Get your webhook URL from ngrok (or whatever public URL you have)
const app = new ExampleMentraOSApp();

app.start().catch(console.error);