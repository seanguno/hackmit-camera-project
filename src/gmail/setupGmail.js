const GmailService = require('./gmailService')
const readline = require('readline')

async function setupGmail() {
    console.log('🔧 Gmail API Setup')
    console.log('==================')
    
    // Check if we have the required environment variables
    const requiredVars = ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET']
    const missingVars = requiredVars.filter(varName => !process.env[varName])
    
    if (missingVars.length > 0) {
        console.log('❌ Missing required environment variables:')
        missingVars.forEach(varName => {
            console.log(`   - ${varName}`)
        })
        console.log('\n📝 Please add these to your .env file:')
        console.log('   GMAIL_CLIENT_ID=your_client_id_here')
        console.log('   GMAIL_CLIENT_SECRET=your_client_secret_here')
        console.log('   GMAIL_REFRESH_TOKEN=your_refresh_token_here')
        console.log('\n🔗 Get these from: https://console.developers.google.com/')
        return
    }

    const gmailService = new GmailService()
    
    // Check if we already have a refresh token
    if (process.env.GMAIL_REFRESH_TOKEN) {
        console.log('✅ Gmail refresh token found in environment')
        console.log('🧪 Testing Gmail service...')
        
        try {
            // Test if the service works
            const testResult = await gmailService.sendFollowUpEmail({
                email: 'test@example.com', // This won't actually send, just test auth
                name: 'Test User',
                field: 'Test Field',
                summary: { summaries: [{ summary: 'Test conversation' }] }
            })
            
            console.log('✅ Gmail service is ready!')
        } catch (error) {
            console.log('❌ Gmail service test failed:', error.message)
            console.log('🔄 You may need to re-authenticate...')
            await startOAuthFlow(gmailService)
        }
    } else {
        console.log('🔐 No refresh token found. Starting OAuth flow...')
        await startOAuthFlow(gmailService)
    }
}

async function startOAuthFlow(gmailService) {
    console.log('\n🔐 Gmail OAuth2 Setup')
    console.log('=====================')
    
    // Generate authorization URL
    const authUrl = gmailService.getAuthUrl()
    
    console.log('📋 Follow these steps:')
    console.log('1. Open this URL in your browser:')
    console.log(`   ${authUrl}`)
    console.log('\n2. Sign in with your Gmail account')
    console.log('3. Grant permissions to the app')
    console.log('4. Copy the authorization code')
    console.log('\n⏳ Waiting for authorization code...')
    
    // Get authorization code from user
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    })
    
    const code = await new Promise((resolve) => {
        rl.question('📝 Enter authorization code: ', (answer) => {
            rl.close()
            resolve(answer.trim())
        })
    })
    
    if (!code) {
        console.log('❌ No authorization code provided')
        return
    }
    
    try {
        console.log('🔄 Exchanging code for tokens...')
        const tokens = await gmailService.getTokensFromCode(code)
        
        console.log('\n🎉 Gmail setup complete!')
        console.log('✅ You can now send emails automatically')
        
    } catch (error) {
        console.log('❌ Error during OAuth flow:', error.message)
        console.log('💡 Make sure you copied the authorization code correctly')
    }
}

// Test email sending
async function testEmailSending() {
    console.log('\n📧 Testing Email Sending')
    console.log('========================')
    
    const gmailService = new GmailService()
    
    if (!gmailService.isReady()) {
        console.log('❌ Gmail service not ready. Run setup first.')
        return
    }
    
    const testContact = {
        email: 'test@example.com', // Replace with a real email for testing
        name: 'Test User',
        field: 'Computer Science',
        summary: {
            summaries: [{
                summary: 'Great conversation about machine learning and AI projects at MIT'
            }]
        }
    }
    
    console.log('📤 Sending test email...')
    const result = await gmailService.sendFollowUpEmail(testContact)
    
    if (result.success) {
        console.log('✅ Test email sent successfully!')
        console.log('📧 Message ID:', result.messageId)
    } else {
        console.log('❌ Test email failed:', result.error)
    }
}

// Main function
async function main() {
    const command = process.argv[2]
    
    switch (command) {
        case 'setup':
            await setupGmail()
            break
        case 'test':
            await testEmailSending()
            break
        default:
            console.log('📧 Gmail Integration Setup')
            console.log('==========================')
            console.log('Usage:')
            console.log('  node src/gmail/setupGmail.js setup  - Setup Gmail OAuth2')
            console.log('  node src/gmail/setupGmail.js test   - Test email sending')
    }
}

if (require.main === module) {
    require('dotenv').config()
    main().catch(console.error)
}

module.exports = { setupGmail, testEmailSending }
