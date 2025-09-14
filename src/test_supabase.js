const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

async function testClaudeAndSupabase() {
    try {
        const transcript = "Hey Sean! It was so nice meeting you today. Let's grab lunch sometime next week. I'm working in computer science and my email is gunosean@gmail.com."
        
        console.log('🚀 Testing full pipeline: Claude → Supabase')
        console.log('📝 Transcript:', transcript)
        
        // First, run Claude to get the structured data
        console.log('\n🤖 Processing with Claude...')
        const claudeResult = await runClaude(transcript)
        console.log('✅ Claude result:', JSON.stringify(claudeResult, null, 2))
        
        // Test Supabase insert
        console.log('\n🗄️  Testing Supabase insert...')
        const response = await fetch('http://localhost:7676/api/voice', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(claudeResult),
        })
        
        if (response.ok) {
            const data = await response.json()
            console.log('✅ Supabase response:', data)
        } else {
            console.log('❌ Supabase error:', response.status, response.statusText)
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

testClaudeAndSupabase()