#!/usr/bin/env python3
"""
Convert all .webp files to .jpeg format
"""
import os
from PIL import Image

def convert_webp_to_jpeg(input_dir):
    """Convert all .webp files in directory to .jpeg"""
    converted_count = 0
    
    for filename in os.listdir(input_dir):
        if filename.endswith('.webp'):
            # Get full paths
            webp_path = os.path.join(input_dir, filename)
            jpeg_filename = filename.replace('.webp', '.jpeg')
            jpeg_path = os.path.join(input_dir, jpeg_filename)
            
            try:
                # Open and convert
                print(f"Converting {filename} to {jpeg_filename}...")
                with Image.open(webp_path) as img:
                    # Convert to RGB if necessary (webp can have transparency)
                    if img.mode in ('RGBA', 'LA', 'P'):
                        img = img.convert('RGB')
                    
                    # Save as JPEG
                    img.save(jpeg_path, 'JPEG', quality=95)
                
                # Remove original webp file
                os.remove(webp_path)
                print(f"✅ Converted and removed {filename}")
                converted_count += 1
                
            except Exception as e:
                print(f"❌ Failed to convert {filename}: {e}")
    
    print(f"\n🎉 Conversion complete! Converted {converted_count} files.")

if __name__ == "__main__":
    images_dir = "../images/db_images"
    print(f"Converting .webp files in {images_dir}...")
    convert_webp_to_jpeg(images_dir)
