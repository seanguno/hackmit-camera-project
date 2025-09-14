#!/usr/bin/env python3
"""
Simple voice test without recording - just test the transcription with a sample audio file
"""

import os
import requests
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def test_eden_transcription():
    """Test Eden AI transcription with a sample text"""
    eden_api_key = os.getenv('EDEN_API_KEY')
    
    if not eden_api_key:
        print("❌ EDEN_API_KEY not found in .env file")
        return
    
    print("🎤 Testing Eden AI transcription...")
    print(f"🔑 API Key: {eden_api_key[:10]}...")
    
    # Test with a simple text (simulating what would come from voice)
    test_transcript = "Hey Sean! It was so nice meeting you today. Let's grab lunch sometime next week. I'm working in computer science and my email is gunosean@gmail.com."
    
    print(f"📝 Test transcript: {test_transcript}")
    
    # Test Claude processing
    try:
        import sys
        sys.path.append('.')
        from src.api.text_to_db.claude import processTranscript
        result = processTranscript(test_transcript)
        print("✅ Claude processing successful!")
        print(f"📊 Structured data: {result}")
    except Exception as e:
        print(f"❌ Claude processing failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_eden_transcription()
