# Camera Timeout Troubleshooting Guide

## 🚨 **Issue: Camera Request Timeout**

Based on your terminal output, the camera request is timing out. This is a common issue with MentraOS camera integration.

## 🔍 **Root Causes & Solutions**

### **1. Camera Permissions Not Granted**
**Symptoms:** `Photo request timed out`
**Solution:**
- Check MentraOS app permissions on your device
- Ensure camera permission is enabled in device settings
- Try restarting the MentraOS app

### **2. Camera Hardware Not Available**
**Symptoms:** Timeout with no camera response
**Solution:**
- Verify your smart glasses have a working camera
- Check if camera is physically blocked or damaged
- Try with a different pair of glasses if available

### **3. Another App Using Camera**
**Symptoms:** Intermittent timeouts
**Solution:**
- Close other camera apps on your device
- Restart the MentraOS app
- Check for background camera processes

### **4. Network/Connection Issues**
**Symptoms:** Timeout during camera communication
**Solution:**
- Check your internet connection
- Verify MentraOS app is connected to glasses
- Try reconnecting the glasses

## 🛠 **Debugging Steps**

### **Step 1: Check Camera Status**
Visit: `http://localhost:3000/test`
Click: "🔍 Check Camera Status"

This will show:
- Current user session
- Photo storage status
- Streaming mode status
- Storage directory info

### **Step 2: Test Photo Capture**
Click: "🧪 Test Photo Capture"
This simulates a photo without using the actual camera.

### **Step 3: Check Terminal Logs**
Look for these specific log messages:
```
🔍 Checking camera permissions for user [userId]...
📷 Requesting photo from camera...
⏰ Camera request timed out - this usually means:
   1. Camera permissions not granted
   2. Camera hardware not available
   3. Another app is using the camera
```

### **Step 4: Verify Storage**
Check if photos are being saved:
```bash
ls -la storage/photos/
```

## 🔧 **Advanced Troubleshooting**

### **Check MentraOS Console**
1. Go to: https://console.mentra.glass/
2. Check your app's status
3. Look for camera-related errors

### **Test with Different Button Presses**
- **Short Press**: Single photo (currently timing out)
- **Long Press**: Toggle streaming mode (might work differently)

### **Check Device Logs**
If using Android:
```bash
adb logcat | grep -i camera
```

## 📱 **Device-Specific Solutions**

### **Android**
- Settings → Apps → MentraOS → Permissions → Camera (ON)
- Settings → Apps → MentraOS → Storage (ON)

### **iOS**
- Settings → Privacy → Camera → MentraOS (ON)
- Settings → Privacy → Photos → MentraOS (ON)

## 🎯 **Quick Fixes to Try**

1. **Restart Everything**
   ```bash
   # Stop the app
   Ctrl+C
   
   # Restart
   bun run dev
   ```

2. **Clear App Data**
   - Uninstall and reinstall MentraOS app
   - Reconnect smart glasses

3. **Check Glasses Connection**
   - Ensure glasses are properly paired
   - Try reconnecting via MentraOS app

4. **Test with Web Interface**
   - Use the test page instead of glasses
   - Verify the app logic works

## 📊 **Expected Behavior**

### **Working Camera:**
```
[INFO] 📸 Taking single photo for user gunosean@gmail.com...
[INFO] 🔍 Checking camera permissions for user gunosean@gmail.com...
[INFO] 📷 Requesting photo from camera...
[INFO] ✅ Photo taken for user gunosean@gmail.com, timestamp: [timestamp]
[INFO] 📊 Photo size: [size] bytes, MIME: image/jpeg
[INFO] Photo cached and saved for user gunosean@gmail.com
```

### **Timeout Error:**
```
[WARN] 📸 Photo request timed out
[ERROR] Error taking photo: Photo request timed out
[ERROR] ⏰ Camera request timed out - this usually means:
   1. Camera permissions not granted
   2. Camera hardware not available
   3. Another app is using the camera
```

## 🆘 **If Nothing Works**

1. **Contact MentraOS Support**
   - Discord: https://discord.gg/mentraos
   - Check their documentation for camera troubleshooting

2. **Use Test Mode**
   - Continue development using the test photo endpoint
   - Implement face detection with mock photos
   - Test the full pipeline without real camera

3. **Check Hardware**
   - Verify glasses model compatibility
   - Test with different glasses if available

The timeout issue is likely a permissions or hardware problem, not a code issue. Your app is working correctly - it's just waiting for camera access!
