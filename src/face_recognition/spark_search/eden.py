import requests
import json
import base64
from dotenv import load_dotenv
import os
import logging

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
            "file_urls": [image_url]
        }
        
        try:
            response = requests.post(
                "https://api.edenai.co/v2/face/add_face",
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
            "file_urls": [image_url]
        }
        
        try:
            response = requests.post(
                "https://api.edenai.co/v2/face/recognize",
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
                "https://api.edenai.co/v2/face/delete_face",
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
                "https://api.edenai.co/v2/face/recognize",
                headers=self.headers,
                json={
                    "providers": "amazon",
                    "file_urls": ["https://i.imgur.com/test.jpg"]  # Dummy URL to get all faces
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

async def main():
    """Main function"""
    logger.info("=== Simple Face Recognition ===")
    
    # Initialize the face recognition system
    face_system = EdenAIFaceRecognition()
    
    # Upload and register sohum_1.jpeg
    db_images = os.listdir("../images/db_images")
    print(db_images)
    db_images = ["../images/db_images/" + image for image in db_images]

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
    filename = "../images/db_images/Thomas_Tee_Headshot.jpeg"
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
    main()