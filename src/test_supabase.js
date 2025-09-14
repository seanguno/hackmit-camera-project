const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')
const EmailIntegration = require('./gmail/emailIntegration')
require('dotenv').config()

async function testClaudeAndSupabase() {
    try {
        console.log('🚀 Testing full pipeline: Voice Record → Transcribe → Claude → Supabase → Email')
        
        // Step 1: Record and transcribe voice
        console.log('\n🎤 Step 1: Recording and transcribing voice...')
        const voiceResult = await runVoiceCapture()
        
        if (!voiceResult || !voiceResult.transcription) {
            console.log('❌ Voice capture failed or no transcription found')
            return
        }
        
        console.log('✅ Voice capture completed!')
        console.log('📝 Transcription:', voiceResult.transcription)
        console.log(`📊 Processing time: ${voiceResult.processing_time?.toFixed(2)}s`)
        
        // Step 2: Process with Claude
        console.log('\n🤖 Step 2: Processing with Claude...')
        const claudeResult = await runClaude(voiceResult.transcription)
        console.log('✅ Claude result:', JSON.stringify(claudeResult, null, 2))
        
        // Step 3: Save directly to Supabase
        console.log('\n🗄️  Step 3: Saving directly to Supabase...')
        console.log('📤 Data being saved to Supabase:')
        console.log(JSON.stringify(claudeResult, null, 2))
        
        const supabaseResult = await saveToSupabase(claudeResult)
        
        if (supabaseResult.success) {
            console.log('✅ Supabase response:', supabaseResult.data)
            console.log('🎉 Successfully saved to database!')
            
            // Step 4: Send follow-up email
            console.log('\n📧 Step 4: Sending follow-up email...')
            const emailIntegration = new EmailIntegration()
            
            if (emailIntegration.isReady()) {
                const emailResult = await emailIntegration.sendFollowUpEmail(claudeResult)
                
                if (emailResult.success) {
                    console.log('✅ Email sent successfully!')
                    console.log('📧 Message ID:', emailResult.messageId)
                } else {
                    console.log('❌ Email failed:', emailResult.error)
                }
            } else {
                console.log('⚠️  Email integration not ready')
                console.log('💡 Run: node src/gmail/setupGmail.js setup')
            }
        } else {
            console.log('❌ Supabase error:', supabaseResult.error)
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message)
    }
}

function runClaude(transcript) {
    return new Promise((resolve, reject) => {
        // Create a simple test script
        const testScript = `
import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import dotenv from 'dotenv'

dotenv.config()

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

const systemPrompt = \`You are a conversation processor that extracts structured data from voice conversation transcripts and outputs JSON matching the Supabase database schema.

INPUT: A conversation transcript (string)
OUTPUT: JSON object with the following exact structure:

{
  "field": "string | null",
  "email": "string | null", 
  "name": "string | null",
  "history": "string | null",
  "summary": "string | null"
}

EXTRACTION RULES:
1. **field**: Extract the person's field of study, profession, or area of expertise mentioned in the conversation. Look for terms like "Computer Science", "Engineering", "Medicine", "Business", "Art", "Research", etc. If no field is mentioned, use null.

2. **email**: Extract any email address mentioned in the conversation. Look for patterns like "user@domain.com" or "my email is...". If no email is mentioned, use null.

3. **name**: Extract the person's full name as mentioned in the conversation. Look for introductions like "Hi, I'm John Smith" or "My name is...". If no name is mentioned, use null.

4. **history**: Use the entire conversation transcript as-is. This should be the raw transcript text.

5. **summary**: Create a concise 1-2 sentence summary of what the conversation was about, key topics discussed, or main points. If the conversation is too brief or unclear, use null.

IMPORTANT:
- All fields except "history" can be null if not found
- "history" should always contain the full transcript
- Be conservative - if you're unsure about a field, use null
- Extract only what is explicitly mentioned, don't infer or assume
- The JSON must be valid and parseable
- Do not include any additional fields beyond the 5 specified\`

async function processTranscript(transcript) {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-opus-4-20250514',
      max_tokens: 3000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: transcript
        }
      ]
    })

    const content = response.content[0]
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude')
    }

    const jsonMatch = content.text.match(/\\{[\\s\\S]*\\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in Claude response')
    }

    const parsedData = JSON.parse(jsonMatch[0])
    
    const result = {
      field: parsedData.field || null,
      email: parsedData.email || null,
      name: parsedData.name || null,
      history: parsedData.history || null,
      summary: parsedData.summary || null
    }

    console.log(JSON.stringify(result))
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

processTranscript('${transcript.replace(/'/g, "\\'")}')
`
        
        const tempFile = 'temp_claude_test.ts'
        fs.writeFileSync(tempFile, testScript)
        
        const child = spawn('npx', ['tsx', tempFile], {
            stdio: ['pipe', 'pipe', 'pipe'],
            cwd: process.cwd()
        })
        
        let output = ''
        let errorOutput = ''
        
        child.stdout.on('data', (data) => {
            output += data.toString()
        })
        
        child.stderr.on('data', (data) => {
            errorOutput += data.toString()
        })
        
        child.on('close', (code) => {
            // Clean up
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile)
            }
            
            if (code === 0) {
                try {
                    // Extract JSON from output (skip dotenv messages)
                    const lines = output.split('\n')
                    let jsonLine = ''
                    
                    for (const line of lines) {
                        if (line.trim().startsWith('{')) {
                            jsonLine = line.trim()
                            break
                        }
                    }
                    
                    if (jsonLine) {
                        const result = JSON.parse(jsonLine)
                        resolve(result)
                    } else {
                        reject(new Error('No JSON found in output: ' + output))
                    }
                } catch (e) {
                    reject(new Error('Failed to parse Claude output: ' + output))
                }
            } else {
                reject(new Error(`Claude process failed: ${errorOutput}`))
            }
        })
    })
}

async function runVoiceCapture() {
    return new Promise((resolve, reject) => {
        console.log('🎤 Starting voice capture...')
        
        // Run the Python voice capture script
        const pythonScript = spawn('/Users/sohumgautam/Documents/miniconda3/miniconda3/envs/hackmit/bin/python', ['src/voice/voice_capture.py'], {
            cwd: process.cwd(),
            stdio: ['pipe', 'pipe', 'pipe']
        })

        let output = ''
        let errorOutput = ''

        pythonScript.stdout.on('data', (data) => {
            output += data.toString()
            console.log('Python output:', data.toString().trim())
        })

        pythonScript.stderr.on('data', (data) => {
            errorOutput += data.toString()
            console.log('Python error:', data.toString().trim())
        })

        pythonScript.on('close', (code) => {
            if (code === 0) {
                try {
                    // Parse the result from Python output
                    const lines = output.split('\n')
                    let audioFile = ''
                    let transcription = null
                    let processingTime = null

                    for (const line of lines) {
                        if (line.includes('Audio file:')) {
                            audioFile = line.split('Audio file: ')[1]?.trim()
                        }
                        if (line.includes('📝 Final extracted text:')) {
                            const transcriptionStr = line.split('📝 Final extracted text: ')[1]?.trim()
                            if (transcriptionStr) {
                                transcription = transcriptionStr
                            }
                        }
                        if (line.includes('Total processing time:')) {
                            const timeStr = line.split('Total processing time: ')[1]?.split(' seconds')[0]?.trim()
                            if (timeStr) {
                                processingTime = parseFloat(timeStr)
                            }
                        }
                    }

                    if (transcription) {
                        resolve({
                            audioFile,
                            transcription,
                            processingTime
                        })
                    } else {
                        reject(new Error('Failed to extract transcription from voice capture result'))
                    }
                } catch (e) {
                    reject(new Error('Failed to parse voice capture result: ' + e.message))
                }
            } else {
                reject(new Error(`Voice capture failed with code ${code}: ${errorOutput}`))
            }
        })
    })
}

async function saveToSupabase(data) {
    try {
        // Import Supabase client dynamically
        const { createClient } = await import('@supabase/supabase-js')
        
        // Get environment variables
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
        
        if (!supabaseUrl || !supabaseKey) {
            return {
                success: false,
                error: 'Missing Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY)'
            }
        }
        
        const supabase = createClient(supabaseUrl, supabaseKey)
        
        // Convert history and summary to JSONB format
        const historyJsonb = data.history ? {
            conversations: [{
                transcript: data.history,
                timestamp: new Date().toISOString(),
                source: "voice_capture"
            }]
        } : null

        const summaryJsonb = data.summary ? {
            summaries: [{
                summary: data.summary,
                timestamp: new Date().toISOString(),
                generated_by: "claude"
            }]
        } : null

        // Check if this person already exists in the database
        const { data: existingRecord } = await supabase
            .from('convo')
            .select('*')
            .eq('email', data.email || '')
            .eq('name', data.name || '')
            .single()

        let result, error

        if (existingRecord) {
            // Append to existing record
            console.log('📝 Found existing record, appending conversation...')
            
            const existingHistory = existingRecord.history || { conversations: [] }
            const existingSummary = existingRecord.summary || { summaries: [] }

            // Add new conversation
            existingHistory.conversations.push({
                transcript: data.history,
                timestamp: new Date().toISOString(),
                source: "voice_capture"
            })

            // Add new summary
            existingSummary.summaries.push({
                summary: data.summary,
                timestamp: new Date().toISOString(),
                generated_by: "claude"
            })

            // Update the existing record
            const updateResult = await supabase
                .from('convo')
                .update({
                    history: existingHistory,
                    summary: existingSummary
                })
                .eq('id', existingRecord.id)
                .select()
                .single()

            result = updateResult.data
            error = updateResult.error
        } else {
            // Create new record
            console.log('🆕 Creating new record...')
            
            const insertResult = await supabase
                .from('convo')
                .insert({
                    field: data.field,
                    email: data.email,
                    name: data.name,
                    history: historyJsonb,
                    summary: summaryJsonb
                })
                .select()
                .single()

            result = insertResult.data
            error = insertResult.error
        }
        
        if (error) {
            return {
                success: false,
                error: error.message
            }
        }
        
        return {
            success: true,
            data: result
        }
        
    } catch (error) {
        return {
            success: false,
            error: error.message
        }
    }
}

testClaudeAndSupabase()