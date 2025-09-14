// Test voice integration
const { testVoiceIntegration } = require('./src/voice/voice_integration.js')

console.log('🎤 Testing Voice Integration...')
console.log('Make sure you have:')
console.log('1. Python 3 installed')
console.log('2. pyaudio installed: pip install pyaudio')
console.log('3. EDEN_API_KEY in your .env file')
console.log('4. Your server running on localhost:7676')
console.log('')

testVoiceIntegration()