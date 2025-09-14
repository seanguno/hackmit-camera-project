// Simple voice capture test
const { spawn } = require('child_process')

console.log('🎤 Testing Voice Capture...')
console.log('Make sure you have:')
console.log('1. Python 3 installed')
console.log('2. pyaudio installed: pip install pyaudio')
console.log('3. EDEN_API_KEY in your .env file')
console.log('')

async function testVoiceCapture() {
  try {
    console.log('🎤 Starting voice capture...')
    
    const pythonScript = spawn('conda', ['run', '-n', 'hackmit', 'python', 'src/voice/voice_capture.py'], {
      cwd: process.cwd(),
      stdio: 'inherit'
    })

    pythonScript.on('close', (code) => {
      if (code === 0) {
        console.log('✅ Voice capture completed successfully!')
      } else {
        console.log(`❌ Voice capture failed with code ${code}`)
      }
    })

    pythonScript.on('error', (error) => {
      console.error('❌ Error running voice capture:', error)
    })

  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

testVoiceCapture()
