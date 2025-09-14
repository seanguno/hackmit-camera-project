const { spawn } = require('child_process')
const { processTranscript } = require('../api/text_to_db/claude')

interface VoiceResult {
  audioFile: string
  transcription: any
  structuredData?: any
}

class VoiceIntegration {
  private isRecording = false

  async startVoiceCapture(): Promise<VoiceResult | null> {
    try {
      console.log('🎤 Starting voice capture...')
      
      // Run the Python voice capture script
      const result = await this.runVoiceCapture()
      
      if (result && result.transcription) {
        console.log('✅ Voice captured and transcribed')
        console.log('📝 Transcription:', result.transcription)
        
        // Process with Claude to get structured data
        const transcript = this.extractTranscriptText(result.transcription)
        if (transcript) {
          console.log('🤖 Processing with Claude...')
          const structuredData = await processTranscript(transcript)
          console.log('✅ Structured data:', structuredData)
          
          return {
            ...result,
            structuredData
          }
        }
      }
      
      return result
    } catch (error) {
      console.error('❌ Voice capture error:', error)
      return null
    }
  }

  private async runVoiceCapture(): Promise<VoiceResult | null> {
    return new Promise((resolve, reject) => {
      const pythonScript = spawn('python3', ['src/voice/voice_capture.py'], {
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

            for (const line of lines) {
              if (line.includes('Audio saved to:')) {
                audioFile = line.split('Audio saved to: ')[1]?.trim()
              }
              if (line.includes('Transcription:')) {
                const transcriptionStr = line.split('Transcription: ')[1]?.trim()
                if (transcriptionStr) {
                  try {
                    transcription = JSON.parse(transcriptionStr)
                  } catch (e) {
                    transcription = { text: transcriptionStr }
                  }
                }
              }
            }

            resolve({
              audioFile,
              transcription
            })
          } catch (e) {
            reject(new Error('Failed to parse voice capture result'))
          }
        } else {
          reject(new Error(`Voice capture failed with code ${code}: ${errorOutput}`))
        }
      })
    })
  }

  private extractTranscriptText(transcription: any): string | null {
    if (!transcription) return null

    // Handle different transcription response formats
    if (typeof transcription === 'string') {
      return transcription
    }

    if (transcription.text) {
      return transcription.text
    }

    if (transcription.results && transcription.results.length > 0) {
      return transcription.results[0].transcript
    }

    if (transcription.google && transcription.google.text) {
      return transcription.google.text
    }

    if (transcription.amazon && transcription.amazon.text) {
      return transcription.amazon.text
    }

    // Fallback: try to extract any text from the response
    const jsonStr = JSON.stringify(transcription)
    const textMatch = jsonStr.match(/"text":\s*"([^"]+)"/)
    if (textMatch) {
      return textMatch[1]
    }

    return null
  }

  async saveToSupabase(voiceResult: VoiceResult): Promise<boolean> {
    try {
      if (!voiceResult.structuredData) {
        console.log('❌ No structured data to save')
        return false
      }

      const response = await fetch('http://localhost:7676/api/voice', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(voiceResult.structuredData),
      })

      if (response.ok) {
        const data = await response.json()
        console.log('✅ Saved to Supabase:', data)
        return true
      } else {
        console.log('❌ Supabase save failed:', response.status, response.statusText)
        return false
      }
    } catch (error) {
      console.error('❌ Error saving to Supabase:', error)
      return false
    }
  }
}

// Test function
async function testVoiceIntegration() {
  const voiceIntegration = new VoiceIntegration()
  
  try {
    console.log('🚀 Testing voice integration...')
    
    const result = await voiceIntegration.startVoiceCapture()
    
    if (result) {
      console.log('✅ Voice capture successful!')
      console.log('Audio file:', result.audioFile)
      console.log('Transcription:', result.transcription)
      
      if (result.structuredData) {
        console.log('Structured data:', result.structuredData)
        
        // Save to Supabase
        const saved = await voiceIntegration.saveToSupabase(result)
        if (saved) {
          console.log('🎉 Complete pipeline successful!')
        }
      }
    } else {
      console.log('❌ Voice capture failed')
    }
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

// Export for CommonJS
module.exports = {
  VoiceIntegration,
  testVoiceIntegration
}

// Run test if this file is executed directly
if (require.main === module) {
  testVoiceIntegration()
}
