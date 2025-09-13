#!/usr/bin/env python3
"""
Utility functions for face recognition cleanup
"""

import requests
import json
from dotenv import load_dotenv
import os

load_dotenv()

def delete_residual_faces():
    """Delete residual face IDs that are in Eden AI but not in local database"""
    print("🧹 Cleaning up residual faces...")
    
    # Your Eden AI API key
    api_key = os.getenv("EDEN_API_KEY")
    headers = {"Authorization": f"Bearer {api_key}"}
    
    # These are the residual face IDs from your recognition results
    residual_face_ids = [
        "525b98e5-06a6-4866-9876-60ad278fac5a",
        "d20fd9c2-c811-44fa-bc5d-15e672b2c2c7", 
        "4eb17545-81c9-44da-9811-cf34385659e4"
    ]
    
    deleted_count = 0
    for face_id in residual_face_ids:
        print(f"Deleting residual face: {face_id}")
        
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
            headers=headers
        )
        
        result = response.json()
        print(f"Delete response: {json.dumps(result, indent=2)}")
        
        if "amazon" in result and result["amazon"]["status"] == "success":
            deleted_count += 1
            print(f"✅ Deleted {face_id}")
        else:
            print(f"❌ Failed to delete {face_id}")
    
    print(f"✅ Deleted {deleted_count} residual faces from Eden AI")

if __name__ == "__main__":
    delete_residual_faces()
