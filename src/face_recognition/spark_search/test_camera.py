#!/usr/bin/env python3
"""
Simple camera permission test
"""

import cv2
import sys

def test_camera():
    """Test camera access and permissions"""
    print("Testing camera access...")
    
    try:
        # Try to initialize camera
        cap = cv2.VideoCapture(0)
        
        if cap.isOpened():
            print("✅ Camera opened successfully!")
            print("Camera permissions are working.")
            
            # Try to read a frame
            ret, frame = cap.read()
            if ret:
                print("✅ Successfully captured frame from camera")
            else:
                print("❌ Could not capture frame")
            
            cap.release()
            return True
        else:
            print("❌ Could not open camera")
            print("This usually means camera permissions are denied.")
            return False
            
    except Exception as e:
        print(f"❌ Camera test failed: {e}")
        return False

if __name__ == "__main__":
    print("=== Camera Permission Test ===")
    print("This will test if Python can access your camera.")
    print("If permissions are denied, you'll need to grant them manually.")
    print()
    
    success = test_camera()
    
    if not success:
        print("\n🔧 To fix camera permissions:")
        print("1. Open System Preferences → Security & Privacy → Privacy → Camera")
        print("2. Check the box next to 'Python' or 'Terminal'")
        print("3. Run this test again")
    else:
        print("\n🎉 Camera permissions are working correctly!")

