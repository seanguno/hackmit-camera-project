import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface ContactData {
  name?: string;
  email?: string;
  field?: string;
  summary?: string;
  transcription?: string;
}

export class GmailService {
  private oauth2Client: any;
  private gmail: any;

  constructor() {
    this.initializeGmail();
  }

  private async initializeGmail() {
    try {
      // Initialize OAuth2 client
      this.oauth2Client = new google.auth.OAuth2(
        process.env.GMAIL_CLIENT_ID,
        process.env.GMAIL_CLIENT_SECRET,
        process.env.GMAIL_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob'
      );

      // Set credentials if we have a refresh token
      if (process.env.GMAIL_REFRESH_TOKEN) {
        this.oauth2Client.setCredentials({
          refresh_token: process.env.GMAIL_REFRESH_TOKEN
        });
      }

      // Initialize Gmail API
      this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
      
      console.log('✅ Gmail service initialized');
    } catch (error) {
      console.error('❌ Error initializing Gmail service:', error);
    }
  }

  /**
   * Check if Gmail service is ready
   */
  isReady(): boolean {
    return !!(this.oauth2Client && this.gmail && process.env.GMAIL_REFRESH_TOKEN);
  }

  /**
   * Send follow-up email after voice conversation
   */
  async sendFollowUpEmail(contactData: ContactData): Promise<EmailResult> {
    try {
      if (!this.isReady()) {
        return {
          success: false,
          error: 'Gmail service not configured'
        };
      }

      if (!contactData.email) {
        return {
          success: false,
          error: 'No email address provided'
        };
      }

      console.log(`📤 Sending follow-up email to: ${contactData.email}`);

      // Create email content
      const subject = `Follow-up from our conversation - ${contactData.name || 'Contact'}`;
      const body = this.createEmailBody(contactData);

      // Create the email message
      const message = this.createEmailMessage(contactData.email, subject, body);

      // Send the email
      const response = await this.gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: message
        }
      });

      console.log('✅ Follow-up email sent successfully!');
      console.log(`📧 Message ID: ${response.data.id}`);

      return {
        success: true,
        messageId: response.data.id
      };

    } catch (error) {
      console.error('❌ Error sending follow-up email:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Create email body content
   */
  private createEmailBody(contactData: ContactData): string {
    const name = contactData.name || 'there';
    const field = contactData.field || 'your field';
    const summary = contactData.summary || 'our conversation';

    return `
Hi ${name},

Thank you for the great conversation we had! It was wonderful to learn about your work in ${field}.

Here's a summary of what we discussed:
${summary}

${contactData.transcription ? `
Full conversation transcript:
"${contactData.transcription}"
` : ''}

I'd love to stay in touch and continue our conversation. Feel free to reach out anytime!

Best regards,
Sean

---
This email was automatically generated after our voice conversation.
    `.trim();
  }

  /**
   * Create email message in Gmail API format
   */
  private createEmailMessage(to: string, subject: string, body: string): string {
    const message = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      body
    ].join('\n');

    return Buffer.from(message).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
}

export class EmailIntegration {
  private gmailService: GmailService;

  constructor() {
    this.gmailService = new GmailService();
  }

  /**
   * Send follow-up email after voice conversation
   */
  async sendFollowUpEmail(contactData: ContactData): Promise<EmailResult> {
    try {
      console.log('📧 Preparing to send follow-up email...');
      
      // Check if Gmail service is ready
      if (!this.gmailService.isReady()) {
        console.log('⚠️  Gmail service not ready. Skipping email send.');
        console.log('💡 Run: node src/gmail/setupGmail.js setup');
        return {
          success: false,
          error: 'Gmail service not configured'
        };
      }

      // Check if we have an email address
      if (!contactData.email) {
        console.log('⚠️  No email address found. Skipping email send.');
        return {
          success: false,
          error: 'No email address provided'
        };
      }

      console.log(`📤 Sending email to: ${contactData.email}`);
      
      // Send the email
      const result = await this.gmailService.sendFollowUpEmail(contactData);
      
      if (result.success) {
        console.log('✅ Follow-up email sent successfully!');
        console.log(`📧 Message ID: ${result.messageId}`);
      } else {
        console.log('❌ Failed to send follow-up email:', result.error);
      }
      
      return result;
      
    } catch (error) {
      console.error('❌ Error in email integration:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check if email integration is ready
   */
  isReady(): boolean {
    return this.gmailService.isReady();
  }

  /**
   * Get setup instructions
   */
  getSetupInstructions(): { ready: boolean; instructions: string } {
    return {
      ready: this.isReady(),
      instructions: this.isReady() ? 
        'Email integration is ready!' : 
        'Run: node src/gmail/setupGmail.js setup'
    };
  }
}
