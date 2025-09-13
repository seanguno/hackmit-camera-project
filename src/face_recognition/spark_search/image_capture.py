#!/usr/bin/env python3
"""
Simple Camera Capture Script
Takes photos using your camera and saves them to the images folder
"""

import cv2
import os
from datetime import datetime

def create_images_folder():
    """Create images folder if it doesn't exist"""
    if not os.path.exists("images"):
        os.makedirs("images")
        print("Created 'images' folder")

def capture_photo():
    """Capture photo from camera and save to images folder"""
    # Create images folder
    create_images_folder()
    
    # Initialize camera
    cap = cv2.VideoCapture(0)  # 0 for default camera
    
    if not cap.isOpened():
        print("❌ Error: Could not open camera")
        return None
    
    print("📷 Camera opened successfully!")
    print("Press SPACE to take photo, ESC to quit")
    
    while True:
        # Capture frame
        ret, frame = cap.read()
        
        if not ret:
            print("❌ Error: Could not read frame")
            break
        
        # Display frame
        cv2.imshow('Camera - Press SPACE to capture, ESC to quit', frame)
        
        # Check for key presses
        key = cv2.waitKey(1) & 0xFF
        
        if key == ord(' '):  # Space bar
            # Generate filename with timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"images/test_capture/capture_{timestamp}.jpg"
            
            # Create test_capture folder if it doesn't exist
            os.makedirs("images/test_capture", exist_ok=True)
            
            # Save image
            cv2.imwrite(filename, frame)
            print(f"✅ Photo saved: {filename}")
            
            # Close camera window after taking photo
            cap.release()
            cv2.destroyAllWindows()
            print("📷 Camera window closed")
            break
            
        elif key == 27:  # ESC key
            print("👋 Exiting...")
            break
    
    # Release camera and close windows
    cap.release()
    cv2.destroyAllWindows()
    return filename

def main():
    print("=== Simple Camera Capture ===")
    print("This script will open your camera and let you take photos")
    print("Photos will be saved to the 'images' folder")
    print()
    
    try:
        capture_photo()
    except KeyboardInterrupt:
        print("\n👋 Exiting...")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()
