import requests
import json
import base64
from dotenv import load_dotenv
import os
import logging
from image_capture import capture_photo

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
            logger.info(f"Database saved with {len(self.face_database)} faces")
        except Exception as e:
            logger.error(f"Error saving database: {e}")

    def upload_to_imgur(self, image_path):
        """Upload image to Imgur and return URL"""
        with open(image_path, 'rb') as f:
            image_data = base64.b64encode(f.read()).decode('utf-8')
        
        headers = {'Authorization': 'Client-ID 546c25a59c58ad7'}
        data = {'image': image_data}
        
        response = requests.post('https://api.imgur.com/3/image', 
                                    headers=headers, 
                                    data=data)
        result = response.json()
        logger.info(f"Upload response: {result}")
        
        if result['success']:
            return result['data']['link']
        else:
            logger.error(f"Upload failed: {result}")
            return None

    def add_face(self, name, image_url):
        """Add face to Eden AI"""
        payload = {
            "providers": "amazon",
            "file_url": image_url
        }
        
        response = requests.post(
            "https://api.edenai.run/v2/image/face_recognition/add_face",
            json=payload,
            headers=self.headers
        )
        
        result = response.json()
        logger.info(f"Add face response: {json.dumps(result, indent=2)}")
        
        if "amazon" in result and result["amazon"]["status"] == "success":
            face_ids = result["amazon"].get("face_ids", [])
            if face_ids:
                face_id = face_ids[0]  # Take the first face ID
                self.face_database[face_id] = {"name": name, "image_url": image_url}
                self.save_database()  # Save to JSON
                logger.info(f"✅ Added {name} with face_id: {face_id}")
                return True
        
        logger.error(f"❌ Failed to add {name}")
        return False

    def delete_face(self, face_id):
        """Delete face from Eden AI"""
        payload = {
            "face_id": face_id,
            "providers": ["amazon"],
            "settings": {},
            "response_as_dict": True,
            "attributes_as_list": False,
            "show_base_64": True,
            "show_original_response": False
        }
        
        response = requests.post(
            "https://api.edenai.run/v2/image/face_recognition/delete_face",
            json=payload,
            headers=self.headers
        )
        
        result = response.json()
        logger.info(f"Delete face response: {json.dumps(result, indent=2)}")
        
        if "amazon" in result and result["amazon"]["status"] == "success":
            # Remove from local database too
            if face_id in self.face_database:
                del self.face_database[face_id]
                self.save_database()
                logger.info(f"✅ Deleted face {face_id} from both Eden AI and local database")
            else:
                logger.info(f"✅ Deleted face {face_id} from Eden AI (not in local database)")
            return True
        else:
            logger.error(f"❌ Failed to delete face {face_id}")
            return False

    def recognize_face(self, image_url):
        """Recognize face using Eden AI"""
        payload = {
            "providers": "amazon",
            "file_url": image_url
        }
        
        response = requests.post(
            "https://api.edenai.run/v2/image/face_recognition/recognize",
            json=payload,
            headers=self.headers
        )        
        result = response.json()
        logger.info(f"Recognize response: {json.dumps(result, indent=2)}")
        
        if "amazon" in result and result["amazon"]["status"] == "success":
            matches = result["amazon"].get("items", [])
            for match in matches:
                face_id = match.get("face_id")
                confidence = match.get("confidence", 0)
                
                if face_id in self.face_database:
                    logger.info(f"🎯 Found match: {self.face_database[face_id]['name']} (confidence: {confidence})")
                else:
                    logger.info(f"Face ID {face_id} not in our database (confidence: {confidence})")

        return result

    def choose_best_match(self, matches):
        """Choose the best match from the list of matches"""
        best_match = None
        best_confidence = 0
        for match in matches:
            confidence = match.get("confidence", 0)
            if confidence > best_confidence:
                best_confidence = confidence
                best_match = match
        
        return best_match

    def list_faces(self):
        """List all faces in database"""
        logger.info(f"\nDatabase has {len(self.face_database)} faces:")
        for face_id, data in self.face_database.items():
            logger.info(f"- {data['name']}: {face_id}")

    def delete_all_faces(self):
        """Delete all faces from both Eden AI and local database"""
        logger.info("🗑️ Deleting all faces...")
        deleted_count = 0
        
        # Get all face IDs from local database
        face_ids = list(self.face_database.keys())
        print("Face IDs in DB: ", face_ids)
        
        for face_id in face_ids:
            if self.delete_face(face_id):
                deleted_count += 1
        
        logger.info(f"✅ Deleted {deleted_count} faces from Eden AI and local database")

def main():
    logger.info("=== Simple Face Recognition ===")
    
    # Initialize the face recognition system
    face_system = EdenAIFaceRecognition()
    # face_system.delete_all_faces()
    
    # Upload and register sohum_1.jpeg
    db_images = ["./images/db_images/sohum_gautam.jpeg", "./images/db_images/sean_guno.jpeg",
              "./images/db_images/pari_latawa.jpeg", "./images/db_images/mudit_marhawa.jpeg"]

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
    filename = capture_photo()
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
        
if __name__ == "__main__":
    main()