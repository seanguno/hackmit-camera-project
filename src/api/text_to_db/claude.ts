import Anthropic from '@anthropic-ai/sdk'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Read the prompt from file
const promptPath = path.join(__dirname, 'claude.txt')
const systemPrompt = fs.readFileSync(promptPath, 'utf-8')

export interface ConvoData {
  field: string | null
  email: string | null
  name: string | null
  history: string | null
  summary: string | null
}

export async function processTranscript(transcript: string): Promise<ConvoData> {
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

    // Parse the JSON response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in Claude response')
    }

    const parsedData = JSON.parse(jsonMatch[0])
    
    // Validate the structure
    const result: ConvoData = {
      field: parsedData.field || null,
      email: parsedData.email || null,
      name: parsedData.name || null,
      history: parsedData.history || null,
      summary: parsedData.summary || null
    }

    return result
  } catch (error) {
    console.error('Error processing transcript:', error)
    throw error
  }
}

// Test function
export async function testClaude() {
  const testTranscript = "Hey, I'm Sarah Johnson, I work in software engineering. My email is sarah.j@tech.com. We were just talking about machine learning projects."
  
  try {
    console.log('Testing Claude with transcript:', testTranscript)
    const result = await processTranscript(testTranscript)
    console.log('Claude response:', JSON.stringify(result, null, 2))
    return result
  } catch (error) {
    console.error('Test failed:', error)
  }
}

// Export for CommonJS compatibility
module.exports = {
  processTranscript,
  testClaude
}

// Run test if this file is executed directly
if (require.main === module) {
  testClaude()
}
