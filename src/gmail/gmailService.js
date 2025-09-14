const { google } = require('googleapis')
const fs = require('fs')
const path = require('path')

class GmailService {
    constructor() {
        this.oauth2Client = null
        this.gmail = null
        this.initializeGmail()
    }

    async initializeGmail() {
        try {
            // Initialize OAuth2 client
            this.oauth2Client = new google.auth.OAuth2(
                process.env.GMAIL_CLIENT_ID,
                process.env.GMAIL_CLIENT_SECRET,
                process.env.GMAIL_REDIRECT_URI || 'urn:ietf:wg:oauth:2.0:oob'
            )

            // Set credentials if we have a refresh token
            if (process.env.GMAIL_REFRESH_TOKEN) {
                this.oauth2Client.setCredentials({
                    refresh_token: process.env.GMAIL_REFRESH_TOKEN
                })
            }

            // Initialize Gmail API
            this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client })
            
            console.log('✅ Gmail service initialized')
        } catch (error) {
            console.error('❌ Error initializing Gmail service:', error.message)
        }
    }

    /**
     * Get authorization URL for OAuth2 flow
     */
    getAuthUrl() {
        const scopes = [
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/gmail.compose'
        ]

        return this.oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: scopes,
            prompt: 'consent'
        })
    }

    /**
     * Exchange authorization code for tokens
     */
    async getTokensFromCode(code) {
        try {
            const { tokens } = await this.oauth2Client.getToken(code)
            this.oauth2Client.setCredentials(tokens)
            
            console.log('✅ Tokens obtained successfully')
            console.log('🔑 Refresh token:', tokens.refresh_token)
            console.log('💡 Add this to your .env file: GMAIL_REFRESH_TOKEN=' + tokens.refresh_token)
            
            return tokens
        } catch (error) {
            console.error('❌ Error getting tokens:', error.message)
            throw error
        }
    }

    /**
     * Send email to a contact
     */
    async sendFollowUpEmail(contactData) {
        try {
            if (!this.gmail) {
                throw new Error('Gmail service not initialized')
            }

            // Create email content
            const emailContent = this.createEmailContent(contactData)
            
            // Create email message
            const message = this.createEmailMessage(contactData.email, emailContent)
            
            // Send email
            const result = await this.gmail.users.messages.send({
                userId: 'me',
                requestBody: {
                    raw: message
                }
            })

            console.log('✅ Email sent successfully!')
            console.log('📧 Message ID:', result.data.id)
            console.log('📤 Sent to:', contactData.email)
            
            return {
                success: true,
                messageId: result.data.id,
                recipient: contactData.email
            }

        } catch (error) {
            console.error('❌ Error sending email:', error.message)
            return {
                success: false,
                error: error.message
            }
        }
    }

    /**
     * Create email content with template
     */
    createEmailContent(contactData) {
        const { name, field, summary } = contactData
        
        // Extract the latest conversation summary
        let conversationSummary = 'Great conversation!'
        if (summary && summary.summaries && summary.summaries.length > 0) {
            conversationSummary = summary.summaries[summary.summaries.length - 1].summary
        }

        const displayName = name || 'there'
        const displayField = field || 'your field'

        return {
            subject: `Great meeting you at HackMIT!`,
            html: `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <style>
                        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; text-align: center; }
                        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                        .highlight { background: #e8f4fd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea; }
                        .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
                        .button { display: inline-block; background: #667eea; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; margin: 15px 0; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <h1>🚀 Great meeting you at HackMIT!</h1>
                    </div>
                    
                    <div class="content">
                        <p>Hi ${displayName}!</p>
                        
                        <p>It was fantastic meeting you at HackMIT! I really enjoyed our conversation about ${displayField}.</p>
                        
                        <div class="highlight">
                            <strong>📝 Conversation Summary:</strong><br>
                            ${conversationSummary}
                        </div>
                        
                        <p>I'm excited about the project we discussed and would love to stay in touch. Here are a few ways we can connect:</p>
                        
                        <ul>
                            <li>📧 Continue our conversation via email</li>
                            <li>💼 Connect on LinkedIn</li>
                            <li>🤝 Collaborate on future projects</li>
                            <li>☕ Grab coffee when we're back on campus</li>
                        </ul>
                        
                        <p>I'm particularly interested in ${displayField} and would love to learn more about your work and share some of the cool projects I'm working on.</p>
                        
                        <p>Thanks again for the great conversation, and I hope to see you around!</p>
                        
                        <p>Best regards,<br>
                        <strong>Sohum</strong><br>
                        <em>HackMIT 2025</em></p>
                        
                        <div class="footer">
                            <p>This email was automatically generated from our conversation at HackMIT 2025</p>
                            <p>📱 Smart Glasses Project | 🎯 Mentor Track</p>
                        </div>
                    </div>
                </body>
                </html>
            `,
            text: `
                Hi ${displayName}!

                It was fantastic meeting you at HackMIT! I really enjoyed our conversation about ${displayField}.

                Conversation Summary: ${conversationSummary}

                I'm excited about the project we discussed and would love to stay in touch. Here are a few ways we can connect:

                - Continue our conversation via email
                - Connect on LinkedIn  
                - Collaborate on future projects
                - Grab coffee when we're back on campus

                I'm particularly interested in ${displayField} and would love to learn more about your work and share some of the cool projects I'm working on.

                Thanks again for the great conversation, and I hope to see you around!

                Best regards,
                Sohum
                HackMIT 2025

                This email was automatically generated from our conversation at HackMIT 2025
                Smart Glasses Project | Mentor Track
            `
        }
    }

    /**
     * Create email message in Gmail format
     */
    createEmailMessage(recipient, content) {
        const message = [
            `To: ${recipient}`,
            `Subject: ${content.subject}`,
            'MIME-Version: 1.0',
            'Content-Type: multipart/alternative; boundary="boundary123"',
            '',
            '--boundary123',
            'Content-Type: text/plain; charset=utf-8',
            '',
            content.text,
            '',
            '--boundary123',
            'Content-Type: text/html; charset=utf-8',
            '',
            content.html,
            '',
            '--boundary123--'
        ].join('\n')

        return Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    }

    /**
     * Check if Gmail service is ready
     */
    isReady() {
        return this.gmail && this.oauth2Client && process.env.GMAIL_REFRESH_TOKEN
    }
}

module.exports = GmailService
