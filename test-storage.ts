// Test script for persistent photo storage
import * as fs from 'fs';
import * as path from 'path';

const STORAGE_DIR = path.join(process.cwd(), 'storage', 'photos');
const METADATA_FILE = path.join(STORAGE_DIR, 'metadata.json');

console.log('🧪 Testing Persistent Photo Storage Implementation...\n');

// Test 1: Check if storage directory exists
console.log('Test 1: Checking storage directory...');
if (fs.existsSync(STORAGE_DIR)) {
  console.log('✅ Storage directory exists:', STORAGE_DIR);
} else {
  console.log('❌ Storage directory does not exist');
}

// Test 2: Check if metadata file exists
console.log('\nTest 2: Checking metadata file...');
if (fs.existsSync(METADATA_FILE)) {
  console.log('✅ Metadata file exists:', METADATA_FILE);
  
  try {
    const metadataContent = fs.readFileSync(METADATA_FILE, 'utf8');
    const metadata = JSON.parse(metadataContent);
    console.log('✅ Metadata file is valid JSON');
    console.log('📊 Metadata contains', Object.keys(metadata).length, 'photo entries');
  } catch (error) {
    console.log('❌ Metadata file is not valid JSON:', error.message);
  }
} else {
  console.log('ℹ️  Metadata file does not exist (normal for first run)');
}

// Test 3: List user directories
console.log('\nTest 3: Checking user directories...');
try {
  const userDirs = fs.readdirSync(STORAGE_DIR).filter(item => {
    const itemPath = path.join(STORAGE_DIR, item);
    return fs.statSync(itemPath).isDirectory();
  });
  
  if (userDirs.length > 0) {
    console.log('✅ Found', userDirs.length, 'user directories:', userDirs);
    
    // Count photos in each user directory
    for (const userDir of userDirs) {
      const userPath = path.join(STORAGE_DIR, userDir);
      const photos = fs.readdirSync(userPath).filter(file => 
        file.startsWith('photo_') && (file.endsWith('.jpg') || file.endsWith('.jpeg') || file.endsWith('.png'))
      );
      console.log(`   📸 User ${userDir}: ${photos.length} photos`);
    }
  } else {
    console.log('ℹ️  No user directories found (normal for first run)');
  }
} catch (error) {
  console.log('❌ Error reading storage directory:', error.message);
}

// Test 4: Check file permissions
console.log('\nTest 4: Checking file permissions...');
try {
  const testFile = path.join(STORAGE_DIR, 'test-permissions.txt');
  fs.writeFileSync(testFile, 'test');
  fs.unlinkSync(testFile);
  console.log('✅ Storage directory is writable');
} catch (error) {
  console.log('❌ Storage directory is not writable:', error.message);
}

console.log('\n🎉 Storage test completed!');
console.log('\n📋 Summary:');
console.log('- Photos are stored in:', STORAGE_DIR);
console.log('- Metadata is stored in:', METADATA_FILE);
console.log('- Each user gets their own subdirectory');
console.log('- Photos are named with timestamps for easy identification');
console.log('- The app will automatically create directories as needed');
