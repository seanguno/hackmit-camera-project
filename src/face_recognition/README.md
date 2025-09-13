# Eden AI Face Recognition System

A comprehensive facial recognition system using Eden AI's API with local database management for storing and managing face records.

## Features

- **Face Registration**: Add faces to both Eden AI and local database
- **Face Recognition**: Recognize faces with confidence scoring
- **Database Management**: Local JSON-based database for face records
- **Search & Filter**: Search faces by name with partial matching
- **Statistics**: Database statistics and analytics
- **Command Line Interface**: Easy-to-use CLI for all operations
- **Error Handling**: Robust error handling and validation

## Installation

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Get your Eden AI API key from [Eden AI](https://www.edenai.co/)

## Quick Start

### Basic Usage

```python
from eden import EdenAIFaceRecognition

# Initialize the system
face_system = EdenAIFaceRecognition("your_api_key_here")

# Register a face
face_system.register_face(
    name="John Doe",
    image_url="https://example.com/john.jpg",
    metadata={"department": "Engineering"}
)

# Recognize a face
matches = face_system.recognize_face("https://example.com/test.jpg")
for face_record, confidence in matches:
    print(f"Found: {face_record.name} (confidence: {confidence:.2f})")
```

### Command Line Interface

```bash
# Register a face interactively
python face_manager.py --api-key YOUR_API_KEY register --interactive

# Register a face with parameters
python face_manager.py --api-key YOUR_API_KEY register --name "Jane Doe" --url "https://example.com/jane.jpg"

# Recognize a face
python face_manager.py --api-key YOUR_API_KEY recognize --url "https://example.com/test.jpg"

# List all faces
python face_manager.py --api-key YOUR_API_KEY list

# Search faces
python face_manager.py --api-key YOUR_API_KEY search "John"

# Show statistics
python face_manager.py --api-key YOUR_API_KEY stats

# Remove a face
python face_manager.py --api-key YOUR_API_KEY remove --interactive
```

## File Structure

- `eden.py` - Main face recognition system class
- `face_database.py` - Local database management
- `face_manager.py` - Command line interface
- `example_usage.py` - Example usage script
- `requirements.txt` - Python dependencies
- `face_database.json` - Local face database (created automatically)

## API Reference

### EdenAIFaceRecognition Class

#### Methods

- `register_face(name, image_url, metadata=None)` - Register a new face
- `recognize_face(image_url, confidence_threshold=0.5)` - Recognize faces in an image
- `list_registered_faces()` - List all registered faces
- `search_faces(query)` - Search faces by name
- `get_database_stats()` - Get database statistics

### FaceDatabase Class

#### Methods

- `add_face(face_id, name, image_url, provider, confidence, metadata)` - Add face to database
- `get_face(face_id)` - Get face by ID
- `get_face_by_name(name)` - Get faces by name
- `list_faces()` - Get all faces
- `remove_face(face_id)` - Remove face from database
- `search_faces(query)` - Search faces by name
- `get_stats()` - Get database statistics

## Example Workflow

1. **Setup**: Install dependencies and get API key
2. **Register Faces**: Add faces to your database using image URLs
3. **Recognize**: Upload new images to find matches
4. **Manage**: Use CLI to search, list, and manage your face database

## Configuration

- **Provider**: Currently supports Amazon (default)
- **Confidence Threshold**: Adjustable for recognition sensitivity
- **Database**: JSON file stored locally (`face_database.json`)

## Error Handling

The system includes comprehensive error handling for:
- Network timeouts and connection issues
- Invalid API responses
- Missing face IDs in database
- Invalid image URLs
- JSON parsing errors

## Security Notes

- Keep your API key secure and never commit it to version control
- Consider using environment variables for API keys in production
- The local database contains face metadata - ensure appropriate security measures

## Troubleshooting

### Common Issues

1. **"No face ID returned"**: Image may not contain a detectable face
2. **"Face ID not found in local database"**: Face was registered in Eden AI but not saved locally
3. **"Request failed"**: Check your API key and internet connection

### Debug Mode

Enable debug output by modifying the print statements in the code or adding logging.

## License

This project is for educational and personal use. Please check Eden AI's terms of service for commercial usage.