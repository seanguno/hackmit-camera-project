const GmailService = require('./gmailService')

class EmailIntegration {
    constructor() {
        this.gmailService = new GmailService()
    }

    /**
     * Send follow-up email after voice conversation
     */
    async sendFollowUpEmail(contactData) {
        try {
            console.log('📧 Preparing to send follow-up email...')
            
            // Check if Gmail service is ready
            if (!this.gmailService.isReady()) {
                console.log('⚠️  Gmail service not ready. Skipping email send.')
                console.log('💡 Run: node src/gmail/setupGmail.js setup')
                return {
                    success: false,
                    error: 'Gmail service not configured'
                }
            }

            // Check if we have an email address
            if (!contactData.email) {
                console.log('⚠️  No email address found. Skipping email send.')
                return {
                    success: false,
                    error: 'No email address provided'
                }
            }

            console.log(`📤 Sending email to: ${contactData.email}`)
            
            // Send the email
            const result = await this.gmailService.sendFollowUpEmail(contactData)
            
            if (result.success) {
                console.log('✅ Follow-up email sent successfully!')
                console.log(`📧 Message ID: ${result.messageId}`)
            } else {
                console.log('❌ Failed to send follow-up email:', result.error)
            }
            
            return result
            
        } catch (error) {
            console.error('❌ Error in email integration:', error.message)
            return {
                success: false,
                error: error.message
            }
        }
    }

    /**
     * Check if email integration is ready
     */
    isReady() {
        return this.gmailService.isReady()
    }

    /**
     * Get setup instructions
     */
    getSetupInstructions() {
        return {
            ready: this.isReady(),
            instructions: this.isReady() ? 
                'Email integration is ready!' : 
                'Run: node src/gmail/setupGmail.js setup'
        }
    }
}

module.exports = EmailIntegration
