import { AppServer, AppSession, ViewType, AuthenticatedRequest, PhotoData } from '@mentra/sdk';
import { Request, Response } from 'express';
import * as ejs from 'ejs';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

/**
 * Interface representing a stored photo with metadata
 */
interface StoredPhoto {
  requestId: string;
  buffer: Buffer;
  timestamp: Date;
  userId: string;
  mimeType: string;
  filename: string;
  size: number;
}

const PACKAGE_NAME = process.env.PACKAGE_NAME ?? (() => { throw new Error('PACKAGE_NAME is not set in .env file'); })();
const MENTRAOS_API_KEY = process.env.MENTRAOS_API_KEY ?? (() => { throw new Error('MENTRAOS_API_KEY is not set in .env file'); })();
const PORT = parseInt(process.env.PORT || '3000');

// Storage configuration
const STORAGE_DIR = path.join(process.cwd(), 'storage', 'photos');
const METADATA_FILE = path.join(STORAGE_DIR, 'metadata.json');

/**
 * Photo Taker App with webview functionality for displaying photos
 * Extends AppServer to provide photo taking and webview display capabilities
 */
class ExampleMentraOSApp extends AppServer {
  private photos: Map<string, StoredPhoto> = new Map(); // Store photos by userId
  private latestPhotoTimestamp: Map<string, number> = new Map(); // Track latest photo timestamp per user
  private isStreamingPhotos: Map<string, boolean> = new Map(); // Track if we are streaming photos for a user
  private nextPhotoTime: Map<string, number> = new Map(); // Track next photo time for a user
  private photoRequestToUser: Map<string, string> = new Map(); // Track which user made each photo request

  constructor() {
    super({
      packageName: PACKAGE_NAME,
      apiKey: MENTRAOS_API_KEY,
      port: PORT,
    });
    this.setupWebviewRoutes();
    this.ensureStorageDirectories();
    this.setupPhotoUploadHandler();
  }

  /**
   * Ensure storage directories exist
   */
  private ensureStorageDirectories(): void {
    try {
      if (!fs.existsSync(STORAGE_DIR)) {
        fs.mkdirSync(STORAGE_DIR, { recursive: true });
        this.logger.info(`Created storage directory: ${STORAGE_DIR}`);
      }
      
      // Initialize metadata file if it doesn't exist
      if (!fs.existsSync(METADATA_FILE)) {
        fs.writeFileSync(METADATA_FILE, JSON.stringify({}, null, 2));
        this.logger.info(`Created metadata file: ${METADATA_FILE}`);
      }
    } catch (error) {
      this.logger.error(`Error setting up storage directories: ${error}`);
    }
  }

  /**
   * Ensure user directory exists
   */
  private ensureUserDirectory(userId: string): string {
    const userDir = path.join(STORAGE_DIR, userId);
    try {
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
        this.logger.info(`Created user directory: ${userDir}`);
      }
      return userDir;
    } catch (error) {
      this.logger.error(`Error creating user directory for ${userId}: ${error}`);
      throw error;
    }
  }

  /**
   * Save photo to local storage
   */
  private async savePhotoToStorage(photo: PhotoData, userId: string): Promise<string> {
    try {
      // Ensure user directory exists
      const userDir = this.ensureUserDirectory(userId);
      
      // Generate filename with timestamp
      const timestamp = photo.timestamp.toISOString().replace(/[:.]/g, '-');
      const extension = photo.mimeType.split('/')[1] || 'jpg';
      const filename = `photo_${timestamp}.${extension}`;
      const filePath = path.join(userDir, filename);
      
      // Write photo buffer to file
      fs.writeFileSync(filePath, photo.buffer);
      
      // Update metadata
      await this.updateMetadata(userId, {
        requestId: photo.requestId,
        timestamp: photo.timestamp.toISOString(),
        userId: userId,
        mimeType: photo.mimeType,
        filename: filename,
        size: photo.size,
        filePath: filePath
      });
      
      this.logger.info(`Photo saved to: ${filePath}`);
      return filePath;
    } catch (error) {
      this.logger.error(`Error saving photo to storage: ${error}`);
      throw error;
    }
  }

  /**
   * Update metadata.json with photo information
   */
  private async updateMetadata(userId: string, photoInfo: any): Promise<void> {
    try {
      let metadata: any = {};
      
      // Read existing metadata
      if (fs.existsSync(METADATA_FILE)) {
        const metadataContent = fs.readFileSync(METADATA_FILE, 'utf8');
        metadata = JSON.parse(metadataContent);
      }
      
      // Update metadata for user
      metadata[userId] = photoInfo;
      
      // Write updated metadata
      fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
      
      this.logger.info(`Metadata updated for user ${userId}`);
    } catch (error) {
      this.logger.error(`Error updating metadata: ${error}`);
      throw error;
    }
  }

  /**
   * Set up custom photo upload handler to ensure photos are processed even if session is not active
   */
  private setupPhotoUploadHandler(): void {
    const app = this.getExpressApp();
    
    // Override the default photo upload handler
    app.post('/photo-upload', async (req: any, res: any) => {
      try {
        const { requestId, type } = req.body;
        const photoFile = req.file;
        
        this.logger.info({ requestId, type }, `📸 Received photo upload: ${requestId}`);
        
        if (!photoFile) {
          this.logger.error({ requestId }, "No photo file in upload");
          return res.status(400).json({
            success: false,
            error: "No photo file provided",
          });
        }
        
        if (!requestId) {
          this.logger.error("No requestId in photo upload");
          return res.status(400).json({
            success: false,
            error: "No requestId provided",
          });
        }

        // Try to find the session first
        let session = (this as any).findSessionByPhotoRequestId(requestId);
        
        if (session) {
          // If session exists, handle normally
          const photoData = {
            buffer: photoFile.buffer,
            mimeType: photoFile.mimetype,
            filename: photoFile.originalname || "photo.jpg",
            requestId,
            size: photoFile.size,
            timestamp: new Date(),
          };
          
          session.camera.handlePhotoReceived(photoData);
          this.logger.info(`Photo delivered to session for request ${requestId}`);
        } else {
          // If no session found, try to get userId from our tracking map
          this.logger.warn({ requestId }, "No active session found, attempting to process photo directly");
          
          const userId = this.photoRequestToUser.get(requestId);
          if (userId) {
            const photoData = {
              buffer: photoFile.buffer,
              mimeType: photoFile.mimetype,
              filename: photoFile.originalname || "photo.jpg",
              requestId,
              size: photoFile.size,
              timestamp: new Date(),
            };
            
            // Process the photo directly
            await this.cachePhoto(photoData, userId);
            this.logger.info(`Photo processed directly for user ${userId} with request ${requestId}`);
            
            // Clean up the tracking map
            this.photoRequestToUser.delete(requestId);
          } else {
            this.logger.error({ requestId }, "No userId found for photo request");
            return res.status(404).json({
              success: false,
              error: "No active session found for this photo request",
            });
          }
        }

        // Respond to ASG client
        res.json({
          success: true,
          requestId,
          message: "Photo received successfully",
        });
      } catch (error) {
        this.logger.error(`Error handling photo upload: ${error}`);
        res.status(500).json({
          success: false,
          error: "Internal server error",
        });
      }
    });
  }


  /**
   * Handle new session creation and button press events
   */
  protected async onSession(session: AppSession, sessionId: string, userId: string): Promise<void> {
    // this gets called whenever a user launches the app
    this.logger.info(`Session started for user ${userId}`);

    // set the initial state of the user
    this.isStreamingPhotos.set(userId, false);
    this.nextPhotoTime.set(userId, Date.now());

    // this gets called whenever a user presses a button
    session.events.onButtonPress(async (button) => {
      this.logger.info(`Button pressed: ${button.buttonId}, type: ${button.pressType}`);

      if (button.pressType === 'long') {
        // the user held the button, so we toggle the streaming mode
        this.isStreamingPhotos.set(userId, !this.isStreamingPhotos.get(userId));
        this.logger.info(`Streaming photos for user ${userId} is now ${this.isStreamingPhotos.get(userId)}`);
        return;
      } else {
        session.layouts.showTextWall("Button pressed, about to take photo", {durationMs: 4000});
        // the user pressed the button, so we take a single photo
        try {
          // first, get the photo
          const photo = await session.camera.requestPhoto();
          // Track the photo request with the user
          this.photoRequestToUser.set(photo.requestId, userId);
          // if there was an error, log it
          this.logger.info(`Photo taken for user ${userId}, timestamp: ${photo.timestamp}, requestId: ${photo.requestId}`);
          this.cachePhoto(photo, userId);
        } catch (error) {
          this.logger.error(`Error taking photo: ${error}`);
        }
      }
    });

    // repeatedly check if we are in streaming mode and if we are ready to take another photo
    setInterval(async () => {
      if (this.isStreamingPhotos.get(userId) && Date.now() > (this.nextPhotoTime.get(userId) ?? 0)) {
        try {
          // set the next photos for 30 seconds from now, as a fallback if this fails
          this.nextPhotoTime.set(userId, Date.now() + 30000);

          // actually take the photo
          const photo = await session.camera.requestPhoto();
          
          // Track the photo request with the user
          this.photoRequestToUser.set(photo.requestId, userId);

          // set the next photo time to now, since we are ready to take another photo
          this.nextPhotoTime.set(userId, Date.now());

          // cache the photo for display
          this.cachePhoto(photo, userId);
        } catch (error) {
          this.logger.error(`Error auto-taking photo: ${error}`);
        }
      }
    }, 1000);
  }

  protected async onStop(sessionId: string, userId: string, reason: string): Promise<void> {
    // clean up the user's state
    this.isStreamingPhotos.set(userId, false);
    this.nextPhotoTime.delete(userId);
    
    // Clean up any pending photo requests for this user
    for (const [requestId, trackedUserId] of this.photoRequestToUser.entries()) {
      if (trackedUserId === userId) {
        this.photoRequestToUser.delete(requestId);
      }
    }
    
    this.logger.info(`Session stopped for user ${userId}, reason: ${reason}`);
  }

  /**
   * Cache a photo for display and save it locally
   */
  private async cachePhoto(photo: PhotoData, userId: string) {
    // create a new stored photo object which includes the photo data and the user id
    const cachedPhoto: StoredPhoto = {
      requestId: photo.requestId,
      buffer: photo.buffer,
      timestamp: photo.timestamp,
      userId: userId,
      mimeType: photo.mimeType,
      filename: photo.filename,
      size: photo.size
    };

    // Save photo to local storage
    try {
      await this.savePhotoToStorage(photo, userId);
      this.logger.info(`Photo saved locally for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to save photo locally for user ${userId}: ${error}`);
      // Continue with caching even if local save fails
    }

    // this example app stores the photo in memory for display in the webview AND saves it locally,
    // but you could also send the photo to an AI api, or store it in a database or cloud storage, 
    // send it to roboflow, or do other processing here

    // cache the photo for display
    this.photos.set(userId, cachedPhoto);
    // update the latest photo timestamp
    this.latestPhotoTimestamp.set(userId, cachedPhoto.timestamp.getTime());
    this.logger.info(`Photo cached for user ${userId}, timestamp: ${cachedPhoto.timestamp}`);
  }


  /**
 * Set up webview routes for photo display functionality
 */
  private setupWebviewRoutes(): void {
    const app = this.getExpressApp();

    // API endpoint to get the latest photo for the authenticated user
    app.get('/api/latest-photo', (req: any, res: any) => {
      const userId = (req as AuthenticatedRequest).authUserId;

      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const photo = this.photos.get(userId);
      if (!photo) {
        res.status(404).json({ error: 'No photo available' });
        return;
      }

      res.json({
        requestId: photo.requestId,
        timestamp: photo.timestamp.getTime(),
        hasPhoto: true
      });
    });

    // API endpoint to get photo data
    app.get('/api/photo/:requestId', (req: any, res: any) => {
      const userId = (req as AuthenticatedRequest).authUserId;
      const requestId = req.params.requestId;

      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const photo = this.photos.get(userId);
      if (!photo || photo.requestId !== requestId) {
        res.status(404).json({ error: 'Photo not found' });
        return;
      }

      res.set({
        'Content-Type': photo.mimeType,
        'Cache-Control': 'no-cache'
      });
      res.send(photo.buffer);
    });

    // API endpoint to get all saved photos for a user
    app.get('/api/saved-photos', (req: any, res: any) => {
      const userId = (req as AuthenticatedRequest).authUserId;

      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      try {
        // Read metadata to get all saved photos
        if (!fs.existsSync(METADATA_FILE)) {
          res.json({ photos: [] });
          return;
        }

        const metadataContent = fs.readFileSync(METADATA_FILE, 'utf8');
        const metadata = JSON.parse(metadataContent);
        
        const userPhotos = metadata[userId] ? [metadata[userId]] : [];
        
        res.json({ 
          photos: userPhotos,
          count: userPhotos.length 
        });
      } catch (error) {
        this.logger.error(`Error reading saved photos: ${error}`);
        res.status(500).json({ error: 'Failed to read saved photos' });
      }
    });

    // Main webview route - displays the photo viewer interface
    app.get('/webview', async (req: any, res: any) => {
      const userId = (req as AuthenticatedRequest).authUserId;

      if (!userId) {
        res.status(401).send(`
          <html>
            <head><title>Photo Viewer - Not Authenticated</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1>Please open this page from the MentraOS app</h1>
            </body>
          </html>
        `);
        return;
      }

      const templatePath = path.join(process.cwd(), 'views', 'photo-viewer.ejs');
      const html = await ejs.renderFile(templatePath, {});
      res.send(html);
    });
  }
}



// Start the server
// DEV CONSOLE URL: https://console.mentra.glass/
// Get your webhook URL from ngrok (or whatever public URL you have)
const app = new ExampleMentraOSApp();

app.start().catch(console.error);