import pyaudio
import wave
import threading
import time
import requests
import os
from datetime import datetime
import json
import numpy as np
from dotenv import load_dotenv
import logging

# Load environment variables
load_dotenv()

class VoiceCapture:
    def __init__(self):
        self.recording = False
        self.audio_frames = []
        self.audio = pyaudio.PyAudio()
        self.stream = None
        self.eden_api_key = os.getenv('EDEN_API_KEY')
        
        # Audio settings
        self.CHUNK = 1024
        self.FORMAT = pyaudio.paInt16
        self.CHANNELS = 1
        self.RATE = 44100
        
        # Recording settings
        self.max_recording_time = 30  # seconds
        self.silence_threshold = 500
        self.silence_duration = 1  # seconds of silence before stopping
        
        # Setup logging
        self.setup_logging()
    
    def setup_logging(self):
        """Setup logging for transcription results"""
        # Create logs directory
        logs_dir = os.path.join("storage", "voice", "logs")
        os.makedirs(logs_dir, exist_ok=True)
        
        # Create timestamp for this session
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Setup JSON logger
        json_log_file = os.path.join(logs_dir, f"transcription_{timestamp}.json")
        self.json_log_file = json_log_file
        
        # Setup text logger
        text_log_file = os.path.join(logs_dir, f"transcription_{timestamp}.log")
        
        # Configure logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(text_log_file),
                logging.StreamHandler()  # Also log to console
            ]
        )
        self.logger = logging.getLogger(__name__)
        
        print(f"📝 Logging setup complete:")
        print(f"   JSON log: {json_log_file}")
        print(f"   Text log: {text_log_file}")
    
    def log_transcription_result(self, audio_file, transcription_result, processing_time=None):
        """Log transcription result to JSON file"""
        try:
            log_entry = {
                "timestamp": datetime.now().isoformat(),
                "audio_file": audio_file,
                "processing_time_seconds": processing_time,
                "transcription": transcription_result,
                "extracted_text": self.extract_text_from_result(transcription_result) if transcription_result else None
            }
            
            # Append to JSON log file
            if os.path.exists(self.json_log_file):
                with open(self.json_log_file, 'r') as f:
                    logs = json.load(f)
            else:
                logs = []
            
            logs.append(log_entry)
            
            with open(self.json_log_file, 'w') as f:
                json.dump(logs, f, indent=2)
            
            self.logger.info(f"📝 Transcription logged to JSON: {self.json_log_file}")
            
        except Exception as e:
            self.logger.error(f"❌ Error logging transcription result: {e}")
        
    def start_recording(self):
        """Start recording audio from microphone"""
        if self.recording:
            return False
            
        self.recording = True
        self.audio_frames = []
        
        try:
            # Check available audio devices
            print("🔍 Checking audio devices...")
            device_count = self.audio.get_device_count()
            print(f"📱 Found {device_count} audio devices")
            
            # List all input devices
            input_devices = []
            for i in range(device_count):
                device_info = self.audio.get_device_info_by_index(i)
                if device_info['maxInputChannels'] > 0:
                    input_devices.append((i, device_info['name']))
                    print(f"🎤 Input device {i}: {device_info['name']}")
            
            # Try to find a proper microphone (not monitor)
            input_device_index = None
            for i, name in input_devices:
                if 'microphone' in name.lower() or 'mic' in name.lower() or 'built-in' in name.lower():
                    input_device_index = i
                    print(f"✅ Using microphone: {name}")
                    break
            
            if input_device_index is None and input_devices:
                input_device_index = input_devices[0][0]
                print(f"⚠️ Using first available input: {input_devices[0][1]}")
            
            if input_device_index is None:
                print("❌ No input devices found!")
                return False
            
            self.stream = self.audio.open(
                format=self.FORMAT,
                channels=self.CHANNELS,
                rate=self.RATE,
                input=True,
                input_device_index=input_device_index,
                frames_per_buffer=self.CHUNK
            )
            
            # Start recording thread
            self.recording_thread = threading.Thread(target=self._record_audio)
            self.recording_thread.start()
            
            print("🎤 Voice recording started...")
            return True
            
        except Exception as e:
            print(f"❌ Error starting recording: {e}")
            print("💡 Make sure you have microphone permissions enabled!")
            self.recording = False
            return False
    
    def stop_recording(self):
        """Stop recording and return audio data"""
        if not self.recording:
            return None
            
        self.recording = False
        
        if self.recording_thread:
            self.recording_thread.join()
            
        if self.stream:
            self.stream.stop_stream()
            self.stream.close()
            
        print("🎤 Voice recording stopped")
        
        # Return a copy of the audio frames before clearing
        audio_frames = self.audio_frames.copy()
        print(f"📊 Returning {len(audio_frames)} audio frames")
        return audio_frames
    
    def _record_audio(self):
        """Internal method to record audio in a separate thread"""
        silence_start = None
        frame_count = 0
        
        while self.recording:
            try:
                data = self.stream.read(self.CHUNK, exception_on_overflow=False)
                self.audio_frames.append(data)
                frame_count += 1
                
                # Debug: print every 10 frames
                if frame_count % 10 == 0:
                    print(f"📊 Recorded {frame_count} frames, total: {len(self.audio_frames)}")
                
                # Check for silence (simple volume detection)
                # Convert bytes to numpy array for better volume calculation
                audio_array = np.frombuffer(data, dtype=np.int16)
                volume = np.mean(np.abs(audio_array))
                
                if volume < self.silence_threshold:
                    if silence_start is None:
                        silence_start = time.time()
                    elif time.time() - silence_start > self.silence_duration:
                        print("🔇 Silence detected, stopping recording...")
                        self.recording = False
                        break
                else:
                    silence_start = None
                    print(f"🔊 Audio detected, volume: {volume}")
                    
                # Maximum recording time
                if len(self.audio_frames) * self.CHUNK / self.RATE > self.max_recording_time:
                    print("⏰ Maximum recording time reached")
                    self.recording = False
                    break
                    
            except Exception as e:
                print(f"❌ Error in recording thread: {e}")
                break
    
    def save_audio(self, audio_frames, filename=None):
        """Save recorded audio to WAV file"""
        if not audio_frames:
            return None
            
        if not filename:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"voice_capture_{timestamp}.wav"
            
        filepath = os.path.join("storage", "voice", filename)
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
        with wave.open(filepath, 'wb') as wf:
            wf.setnchannels(self.CHANNELS)
            wf.setsampwidth(self.audio.get_sample_size(self.FORMAT))
            wf.setframerate(self.RATE)
            wf.writeframes(b''.join(audio_frames))
            
        print(f"💾 Audio saved to: {filepath}")
        return filepath
    
    def transcribe_audio(self, audio_file_path):
        """Transcribe audio using Eden AI STT API"""
        if not self.eden_api_key:
            print("❌ Eden AI API key not found")
            return None
            
        try:
            print(f"🎤 Transcribing audio file: {audio_file_path}")
            headers = {"Authorization": f"Bearer {self.eden_api_key}"}
            
            # Use the correct Eden AI endpoint
            url = "https://api.edenai.run/v2/audio/speech_to_text_async"
            
            # Read the audio file
            with open(audio_file_path, 'rb') as audio_file:
                files = {'file': audio_file}
                data = {
                    "providers": "google,amazon",
                    "language": "en-US"
                }
                
                print("📡 Sending request to Eden AI...")
                response = requests.post(url, headers=headers, files=files, data=data)
                
            print(f"📡 Response status: {response.status_code}")
            print(f"📡 Response text: {response.text}")
                
            if response.status_code == 200:
                result = response.json()
                print("✅ Transcription request successful")
                print(f"📝 Raw result: {result}")
                
                # Check if it's async processing
                if result.get('status') == 'processing':
                    print("⏳ Transcription is processing asynchronously...")
                    public_id = result.get('public_id')
                    if public_id:
                        print(f"🔄 Polling for results with public_id: {public_id}")
                        final_result = self.poll_transcription_status(public_id)
                        if final_result:
                            transcript_text = self.extract_text_from_result(final_result)
                            if transcript_text:
                                print(f"📝 Final extracted text: {transcript_text}")
                                return transcript_text
                            else:
                                print("⚠️ No text found in final transcription result")
                                return final_result
                        else:
                            print("❌ Failed to get final transcription result")
                            return result
                    else:
                        print("⚠️ No public_id found for polling")
                        return result
                else:
                    # Extract text from result
                    transcript_text = self.extract_text_from_result(result)
                    if transcript_text:
                        print(f"📝 Extracted text: {transcript_text}")
                        return transcript_text
                    else:
                        print("⚠️ No text found in transcription result")
                        return result
            else:
                print(f"❌ Transcription failed: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            print(f"❌ Error transcribing audio: {e}")
            return None
    
    def poll_transcription_status(self, public_id, max_attempts=10, delay=1):
        """Poll Eden AI API to check transcription status"""
        if not self.eden_api_key:
            print("❌ Eden AI API key not found")
            return None
            
        headers = {"Authorization": f"Bearer {self.eden_api_key}"}
        url = f"https://api.edenai.run/v2/audio/speech_to_text_async/{public_id}"
        
        for attempt in range(max_attempts):
            try:
                print(f"🔄 Polling attempt {attempt + 1}/{max_attempts}...")
                response = requests.get(url, headers=headers)
                
                if response.status_code == 200:
                    result = response.json()
                    status = result.get('status')
                    
                    print(f"📊 Status: {status}")
                    
                    if status in ['completed', 'finished']:
                        print("✅ Transcription completed!")
                        return result
                    elif status == 'failed':
                        print("❌ Transcription failed")
                        return None
                    elif status == 'processing':
                        print("⏳ Still processing...")
                        if attempt < max_attempts - 1:  # Don't sleep on last attempt
                            time.sleep(delay)
                    else:
                        print(f"⚠️ Unknown status: {status}")
                        if attempt < max_attempts - 1:
                            time.sleep(delay)
                else:
                    print(f"❌ Polling request failed: {response.status_code} - {response.text}")
                    if attempt < max_attempts - 1:
                        time.sleep(delay)
                        
            except Exception as e:
                print(f"❌ Error during polling: {e}")
                if attempt < max_attempts - 1:
                    time.sleep(delay)
        
        print("⏰ Polling timeout reached")
        return None

    def extract_text_from_result(self, result):
        """Extract text from Eden AI result"""
        try:
            # Try different possible result formats
            if isinstance(result, dict):
                # Check if it's the final result with results object
                if 'results' in result:
                    results = result['results']
                    
                    # Check for google result
                    if 'google' in results and isinstance(results['google'], dict):
                        if 'text' in results['google']:
                            return results['google']['text']
                    
                    # Check for amazon result  
                    if 'amazon' in results and isinstance(results['amazon'], dict):
                        if 'text' in results['amazon']:
                            return results['amazon']['text']
                
                # Legacy format checks
                # Check for google result (direct)
                if 'google' in result and 'text' in result['google']:
                    return result['google']['text']
                # Check for amazon result (direct)
                if 'amazon' in result and 'text' in result['amazon']:
                    return result['amazon']['text']
                # Check for direct text field
                if 'text' in result:
                    return result['text']
                # Check for results array
                if 'results' in result and isinstance(result['results'], list) and len(result['results']) > 0:
                    return result['results'][0].get('text', '')
            
            return None
        except Exception as e:
            print(f"❌ Error extracting text: {e}")
            return None
    
    def record_and_transcribe(self):
        """Complete workflow: record -> save -> transcribe"""
        print("🎤 Starting voice capture and transcription...")
        start_time = time.time()
        
        # Start recording
        if not self.start_recording():
            print("❌ Failed to start recording")
            return None
            
        # Wait for recording to complete
        while self.recording:
            time.sleep(0.1)
            
        print("🛑 Recording stopped, processing audio...")
        
        # Get audio data without stopping again
        audio_frames = self.audio_frames.copy()
        if not audio_frames:
            print("❌ No audio frames captured")
            return None
            
        print(f"✅ Captured {len(audio_frames)} audio frames")
        
        # Save audio file
        audio_file = self.save_audio(audio_frames)
        if not audio_file:
            print("❌ Failed to save audio file")
            return None
            
        # Transcribe audio
        print("🎤 Starting transcription...")
        transcription_start = time.time()
        transcription_result = self.transcribe_audio(audio_file)
        transcription_time = time.time() - transcription_start
        
        # Calculate total processing time
        total_time = time.time() - start_time
        
        # Log the result
        self.log_transcription_result(audio_file, transcription_result, total_time)
        
        if transcription_result:
            print("✅ Transcription completed successfully!")
            self.logger.info(f"🎉 Complete transcription successful - Total time: {total_time:.2f}s, Transcription time: {transcription_time:.2f}s")
            return {
                'audio_file': audio_file,
                'transcription': transcription_result,
                'processing_time': total_time,
                'transcription_time': transcription_time
            }
        else:
            print("❌ Transcription failed")
            self.logger.error(f"❌ Transcription failed - Total time: {total_time:.2f}s")
            return {
                'audio_file': audio_file,
                'transcription': None,
                'processing_time': total_time,
                'transcription_time': transcription_time
            }
    
    def cleanup(self):
        """Clean up resources"""
        if self.stream:
            self.stream.close()
        self.audio.terminate()

# Example usage
if __name__ == "__main__":
    voice_capture = VoiceCapture()
    
    try:
        result = voice_capture.record_and_transcribe()
        if result:
            print("🎉 Voice capture and transcription completed!")
            print(f"Audio file: {result['audio_file']}")
            print(f"Transcription: {result['transcription']}")
            if 'processing_time' in result:
                print(f"Total processing time: {result['processing_time']:.2f} seconds")
            if 'transcription_time' in result:
                print(f"Transcription time: {result['transcription_time']:.2f} seconds")
            
            # Show extracted text
            extracted_text = voice_capture.extract_text_from_result(result['transcription'])
            if extracted_text:
                print(f"📝 Extracted text: {extracted_text}")
        else:
            print("❌ Voice capture failed")
    except KeyboardInterrupt:
        print("\n🛑 Recording interrupted by user")
    finally:
        voice_capture.cleanup()