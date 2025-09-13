#!/bin/bash

# Photo Viewer Script for MentraOS Camera App
# This script helps you easily view and manage your saved photos

echo "📸 MentraOS Photo Viewer"
echo "========================"

STORAGE_DIR="/Users/seanguno/Documents/senior year/hackmit-camera-project/storage/photos"

# Check if storage directory exists
if [ ! -d "$STORAGE_DIR" ]; then
    echo "❌ Storage directory not found: $STORAGE_DIR"
    exit 1
fi

echo "📁 Storage Directory: $STORAGE_DIR"
echo ""

# List all users
echo "👥 Users with photos:"
for user_dir in "$STORAGE_DIR"/*/; do
    if [ -d "$user_dir" ]; then
        user_name=$(basename "$user_dir")
        photo_count=$(find "$user_dir" -name "photo_*.jpeg" -o -name "photo_*.jpg" -o -name "photo_*.png" | wc -l)
        echo "   $user_name: $photo_count photos"
    fi
done

echo ""

# Show latest photos
echo "📷 Latest Photos:"
for user_dir in "$STORAGE_DIR"/*/; do
    if [ -d "$user_dir" ]; then
        user_name=$(basename "$user_dir")
        latest_photo=$(find "$user_dir" -name "photo_*.jpeg" -o -name "photo_*.jpg" -o -name "photo_*.png" | sort | tail -1)
        
        if [ -n "$latest_photo" ]; then
            photo_name=$(basename "$latest_photo")
            photo_size=$(ls -lh "$latest_photo" | awk '{print $5}')
            photo_date=$(ls -l "$latest_photo" | awk '{print $6, $7, $8}')
            echo "   $user_name: $photo_name ($photo_size, $photo_date)"
        fi
    fi
done

echo ""

# Interactive menu
while true; do
    echo "🔧 Options:"
    echo "1. View all photos for a user"
    echo "2. Open latest photo"
    echo "3. Open storage folder in Finder"
    echo "4. Copy photos to Desktop"
    echo "5. Exit"
    echo ""
    read -p "Choose an option (1-5): " choice

    case $choice in
        1)
            echo ""
            echo "Available users:"
            for user_dir in "$STORAGE_DIR"/*/; do
                if [ -d "$user_dir" ]; then
                    echo "   $(basename "$user_dir")"
                fi
            done
            echo ""
            read -p "Enter user name: " user_name
            
            if [ -d "$STORAGE_DIR/$user_name" ]; then
                echo ""
                echo "📸 Photos for $user_name:"
                ls -la "$STORAGE_DIR/$user_name"/*.jpeg "$STORAGE_DIR/$user_name"/*.jpg 2>/dev/null | while read line; do
                    echo "   $line"
                done
            else
                echo "❌ User not found: $user_name"
            fi
            ;;
        2)
            latest_photo=$(find "$STORAGE_DIR" -name "photo_*.jpeg" -o -name "photo_*.jpg" -o -name "photo_*.png" | sort | tail -1)
            if [ -n "$latest_photo" ]; then
                echo "🖼️ Opening latest photo: $(basename "$latest_photo")"
                open "$latest_photo"
            else
                echo "❌ No photos found"
            fi
            ;;
        3)
            echo "📁 Opening storage folder in Finder..."
            open "$STORAGE_DIR"
            ;;
        4)
            echo "📋 Copying photos to Desktop..."
            cp -r "$STORAGE_DIR" ~/Desktop/mentraos-photos-$(date +%Y%m%d-%H%M%S)
            echo "✅ Photos copied to Desktop"
            ;;
        5)
            echo "👋 Goodbye!"
            exit 0
            ;;
        *)
            echo "❌ Invalid option. Please choose 1-5."
            ;;
    esac
    echo ""
done

