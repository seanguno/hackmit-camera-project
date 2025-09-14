import requests
import json
import base64
from dotenv import load_dotenv
import os
import logging
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import uvicorn
import sys

# Add the project root to the Python path to enable absolute imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..'))

# Try to import ExtraordinaryAnalyzer, but make it optional
def get_extraordinary_analyzer():
    """Get ExtraordinaryAnalyzer if available, otherwise return None"""
    try:
        from agents.extraordinary.main import ExtraordinaryAnalyzer
        return ExtraordinaryAnalyzer()
    except ImportError as e:
        logger.warning(f"ExtraordinaryAnalyzer not available: {e}")
        logger.warning("Face recognition will work without extraordinary analysis features")
        return None
    except Exception as e:
        logger.warning(f"Error initializing ExtraordinaryAnalyzer: {e}")
        return None

# Configure logging for both file and console
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Create formatters
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')

# File handler
file_handler = logging.FileHandler('logs/face_recognition.log', mode='w')
file_handler.setLevel(logging.INFO)
file_handler.setFormatter(formatter)

# Console handler
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)
console_handler.setFormatter(formatter)

# Add handlers to logger
logger.addHandler(file_handler)
logger.addHandler(console_handler)

load_dotenv()

class EdenAIFaceRecognition:
    def __init__(self):
        self.api_key = os.getenv("EDEN_API_KEY")
        self.headers = {"Authorization": f"Bearer {self.api_key}"}
        self.face_database = {}
        self.db_file = "face_database.json"
        self.load_database()

    def load_database(self):
        """Load database from JSON file"""
        if os.path.exists(self.db_file):
            try:
                with open(self.db_file, 'r') as f:
                    self.face_database = json.load(f)
                logger.info(f"Loaded {len(self.face_database)} faces from database")
            except Exception as e:
                logger.error(f"Error loading database: {e}")
                self.face_database = {}
        else:
            logger.info("No existing database found, starting fresh")

    def save_database(self):
        """Save database to JSON file"""
        try:
            with open(self.db_file, 'w') as f:
                json.dump(self.face_database, f, indent=2)
            logger.info(f"Database saved to {self.db_file}")
        except Exception as e:
            logger.error(f"Error saving database: {e}")

    def upload_to_imgur(self, image_path):
        """Upload image to Imgur and return URL"""
        try:
            with open(image_path, 'rb') as f:
                image_data = base64.b64encode(f.read()).decode('utf-8')
        
            headers = {'Authorization': 'Client-ID 546c25a59c58ad7'}
            data = {'image': image_data}
            
            response = requests.post('https://api.imgur.com/3/image', 
                                        headers=headers, 
                                        data=data)
            print(f"Imgur response status: {response.status_code}")
            print(f"Imgur response text: {response.text[:200]}...")  # First 200 chars
            
            # Check if response is valid JSON
            if response.status_code != 200:
                logger.error(f"Imgur API error: {response.status_code} - {response.text[:100]}")
                return None
                
            try:
                result = response.json()
                logger.info(f"Upload response: {result}")
                
                if result['success']:
                    return result['data']['link']
                else:
                    logger.error(f"Upload failed: {result}")
                    return None
            except requests.exceptions.JSONDecodeError:
                logger.error(f"Imgur returned invalid JSON: {response.text[:200]}")
                return None
        except Exception as e:
            logger.error(f"Error uploading to Imgur: {e}")
            return None

    def add_face(self, name, image_url):
        """Add face to Eden AI"""
        payload = {
            "providers": "amazon",
            "file_url": image_url
        }
        
        try:
            response = requests.post(
                "https://api.edenai.run/v2/image/face_recognition/add_face",
                headers=self.headers,
                json=payload
            )
            result = response.json()
            logger.info(f"Add face response: {json.dumps(result, indent=2)}")
            
            if result["amazon"]["status"] == "success":
                face_ids = result["amazon"].get("face_ids", [])
                if face_ids:
                    face_id = face_ids[0]
                    self.face_database[face_id] = {
                        "name": name,
                        "image_url": image_url
                    }
                    self.save_database()
                    logger.info(f"✅ Added face: {name} (ID: {face_id})")
                    return face_id
            else:
                logger.error(f"Failed to add face: {result}")
                return None
        except Exception as e:
            logger.error(f"Error adding face: {e}")
            return None

    def recognize_face(self, image_url):
        """Recognize face using Eden AI"""
        payload = {
            "providers": "amazon",
            "file_url": image_url
        }
        
        try:
            response = requests.post(
                "https://api.edenai.run/v2/image/face_recognition/recognize",
                headers=self.headers,
                json=payload
            )
            result = response.json()
            logger.info(f"Recognize response: {json.dumps(result, indent=2)}")
            return result
        except Exception as e:
            logger.error(f"Error recognizing face: {e}")
            return None

    def choose_best_match(self, matches):
        """Choose the best match from recognition results"""
        if not matches:
            return None
        
        # Sort by confidence (highest first)
        best_match = max(matches, key=lambda x: x.get('confidence', 0))
        confidence = best_match.get('confidence', 0)
        face_id = best_match.get('face_id')
        
        # Find name in database
        name = "Unknown"
        for fid, data in self.face_database.items():
            if fid == face_id:
                name = data['name']
                break
        
        logger.info(f"🎯 Found match: {name} (confidence: {confidence})")
        return best_match

    def list_faces(self):
        """List all faces in database"""
        logger.info(f"\nDatabase has {len(self.face_database)} faces:")
        for face_id, data in self.face_database.items():
            logger.info(f"- {data['name']}: {face_id}")

    def delete_face(self, face_id):
        """Delete face from Eden AI"""
        payload = {
            "providers": "amazon",
            "face_ids": [face_id]
        }
        
        try:
            response = requests.post(
                "https://api.edenai.run/v2/image/face_recognition/delete_face",
                headers=self.headers,
                json=payload
            )
            result = response.json()
            
            if result["amazon"]["status"] == "success":
                # Remove from local database
                if face_id in self.face_database:
                    del self.face_database[face_id]
                    self.save_database()
                logger.info(f"✅ Deleted face: {face_id}")
                return True
            else:
                logger.error(f"Failed to delete face: {result}")
                return False
        except Exception as e:
            logger.error(f"Error deleting face: {e}")
            return False

    def delete_residual_faces(self):
        """Delete faces that are in Eden AI but not in local database"""
        logger.info("🧹 Cleaning up residual faces from Eden AI...")
        
        # Get all faces from Eden AI
        try:
            response = requests.post(
                "https://api.edenai.run/v2/image/face_recognition/recognize",
                headers=self.headers,
                json={
                    "providers": "amazon",
                    "file_url": "https://i.imgur.com/test.jpg"  # Dummy URL to get all faces
                }
            )
            result = response.json()
            
            if "amazon" in result and "items" in result["amazon"]:
                eden_faces = result["amazon"]["items"]
                local_face_ids = set(self.face_database.keys())
                
                deleted_count = 0
                for face in eden_faces:
                    face_id = face.get("face_id")
                    if face_id and face_id not in local_face_ids:
                        logger.info(f"🗑️ Deleting residual face: {face_id}")
                        if self.delete_face(face_id):
                            deleted_count += 1
                
                logger.info(f"✅ Cleaned up {deleted_count} residual faces")
            else:
                logger.info("No faces found in Eden AI to clean up")
                
        except Exception as e:
            logger.error(f"Error cleaning up faces: {e}")

# FastAPI app instance
app = FastAPI(title="Face Recognition API", version="1.0.0")

# Initialize analyzer only if available
analyzer = get_extraordinary_analyzer()

# Global face recognition system instance
face_system = None

def initialize_face_system():
    """Initialize the face recognition system with database images"""
    global face_system
    if face_system is None:
        logger.info("=== Initializing Face Recognition System ===")
        face_system = EdenAIFaceRecognition()
        
        # Upload and register database images
        db_images = os.listdir("./images/db_images")
        db_images = ["./images/db_images/" + image for image in db_images]

        logger.info("\n1. Adding Images to DB")
        for image in db_images:
            image_name = image.split("/")[-1]
            # Check if image name already exists in database
            if not any(data["name"] == image_name for data in face_system.face_database.values()):
                url = face_system.upload_to_imgur(image)
                if url:
                    face_system.add_face(image_name, url)
            else:
                logger.info(f"Image {image_name} already exists, skipping...")
                
        face_system.list_faces()
        logger.info(f"\nDatabase saved to: {face_system.db_file}")

class RecognitionRequest(BaseModel):
    filename: str

class RecognitionResponse(BaseModel):
    success: bool
    name: str = None
    confidence: float = None
    face_id: str = None
    error: str = None

class SearchResponse(BaseModel):
    success: bool
    name: str = None
    search_result: dict
    analysis_result: dict

@app.post("/recognize", response_model=SearchResponse)
async def recognize_face(request: RecognitionRequest):
    """Recognize a face from the provided image filename"""
    global face_system
    global analyzer
    
    # Initialize system if not already done
    if face_system is None:
        initialize_face_system()
    
    try:
        logger.info(f"=== Processing image: {request.filename} ===")
        
        # Check if file exists
        if not os.path.exists(request.filename):
            raise HTTPException(status_code=404, detail=f"Image file not found: {request.filename}")
        
        # Upload image to Imgur
        logger.info(f"Attempting to upload image to Imgur: {request.filename}")
        test_url = face_system.upload_to_imgur(request.filename)
        logger.info(f"Imgur upload result: {test_url}")
        
        if not test_url:
            return SearchResponse(
                success=False,
                search_result={"error": "Failed to upload image to Imgur"},
                analysis_result={"error": "Image upload failed"}
            )
        
        # Recognize face
        result = face_system.recognize_face(test_url)
        
        if "amazon" in result and result["amazon"]["status"] == "success":
            matches = result["amazon"].get("items", [])
            if matches:
                best_match = face_system.choose_best_match(matches)
                matching_id = best_match.get("face_id")
                confidence = best_match.get("confidence", 0)
                
                # Find person name in database
                for face_id, data in face_system.face_database.items():
                    if matching_id == face_id:
                        name = data['name'].split(".")[0]
                        logger.info(f"✅ Recognized: {name} (confidence: {confidence})")
                        name = name.replace('_', ' ')
                        
                        if analyzer is not None:
                            result = await analyzer.analyze_person(name)
                            # Extract data from CrewOutput object
                            analysis_data = result['analysis_result'].raw if hasattr(result['analysis_result'], 'raw') else str(result['analysis_result'])
                            return SearchResponse(success=True, name=name, search_result=result['search_result'], analysis_result={"data": analysis_data})
                        else:
                            # Return basic response when analyzer is not available
                            return SearchResponse(
                                success=True,
                                name=name,
                                search_result={"name": name, "message": "Extraordinary analysis not available"},
                                analysis_result={"message": "Extraordinary analysis requires Python 3.10+ and CrewAI"}
                            )
                        # return RecognitionResponse(
                        #     success=True,
                        #     name=name,
                        #     confidence=confidence,
                        #     face_id=face_id
                        # )
                
                # Face detected but not in database
                logger.info(f"Face detected but not in database (confidence: {confidence})")
                return SearchResponse(
                    success=True,
                    name="Unknown",
                    search_result={"name": "Unknown", "confidence": confidence, "face_id": matching_id},
                    analysis_result={"message": "Face detected but not in database"}
                )
            else:
                return SearchResponse(
                    success=False,
                    name="Unknown",
                    search_result={"error": "No faces detected in image"},
                    analysis_result={"error": "No faces detected"}
                )
        else:
            return SearchResponse(
                success=False,
                name="Unknown",
                search_result={"error": "Face recognition failed"},
                analysis_result={"error": "Recognition service failed"}
            )
            
    except Exception as e:
        logger.error(f"Exception occurred: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return SearchResponse(
            success=False,
            name="Unknown",
            search_result={"error": str(e)},
            analysis_result={"error": "Internal server error"}
        )

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "face-recognition-api"}

@app.get("/faces")
async def list_faces():
    """List all faces in the database"""
    global face_system
    if face_system is None:
        initialize_face_system()
    
    return {
        "total_faces": len(face_system.face_database),
        "faces": [
            {
                "face_id": face_id,
                "name": data["name"],
                "image_url": data["image_url"]
            }
            for face_id, data in face_system.face_database.items()
        ]
    }

def main():
    """Main function"""
    logger.info("=== Simple Face Recognition ===")
    
    # Initialize the face recognition system
    face_system = EdenAIFaceRecognition()
    
    # Upload and register database images
    db_images = os.listdir("./images/db_images")
    print(db_images)
    db_images = ["./images/db_images/" + image for image in db_images]

    logger.info("\n1. Adding Images to DB")
    for image in db_images:
        image_name = image.split("/")[-1]
        # Check if image name already exists in database
        if not any(data["name"] == image_name for data in face_system.face_database.values()):
            url = face_system.upload_to_imgur(image)
            if url:
                face_system.add_face(image_name, url)
        else:
            logger.info(f"Image {image_name} already exists, skipping...")
            
    face_system.list_faces()
    logger.info(f"\nDatabase saved to: {face_system.db_file}")

    logger.info("\n3. Testing recognition")
    # filename = capture_photo()
    filename = "./images/db_images/Thomas_Tee_Headshot.jpeg"
    test_url = face_system.upload_to_imgur(filename)
    
    if test_url:
        result = face_system.recognize_face(test_url)
        best_match = face_system.choose_best_match(result["amazon"]["items"])
        logger.info(f"Best match: {best_match}")
        matching_id = best_match.get("face_id")
        for id, data in face_system.face_database.items():
            if matching_id == id:
                print("--------------------------------")
                name = data['name'].split(".")[0]
                logger.info(f"This person in this image is: {name}")
                print("--------------------------------")
    else:
        logger.warning("Could not upload test image to Imgur (API error). Using existing image from database instead.")
        # Use an existing image URL from the database for testing
        for face_id, data in face_system.face_database.items():
            if "Thomas_Tee" in data['name']:
                test_url = data['image_url']
                logger.info(f"Using existing Thomas_Tee image: {test_url}")
                result = face_system.recognize_face(test_url)
                best_match = face_system.choose_best_match(result["amazon"]["items"])
                logger.info(f"Best match: {best_match}")
                matching_id = best_match.get("face_id")
                for id, data in face_system.face_database.items():
                    if matching_id == id:
                        print("--------------------------------")
                        name = data['name'].split(".")[0]
                        logger.info(f"This person in this image is: {name}")
                        print("--------------------------------")
                break
        
if __name__ == "__main__":
    import sys
    
    # Check if we should run the FastAPI server or the test main function
    if len(sys.argv) > 1 and sys.argv[1] == "--server":
        # Run FastAPI server
        logger.info("=== Starting Face Recognition API Server ===")
        uvicorn.run(app, host="0.0.0.0", port=8000)
    else:
        # Run test main function
        main()