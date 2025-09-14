import { AppServer, AppSession, ViewType, AuthenticatedRequest, PhotoData } from '@mentra/sdk';
import { Request, Response } from 'express';
import * as ejs from 'ejs';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import axios from 'axios';
import { VoiceRecordingService, VoiceRecordingResult } from './voice/VoiceRecordingService';

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
const FACE_RECOGNITION_API_URL = process.env.FACE_RECOGNITION_API_URL || 'http://localhost:8001';

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
  
  // Voice recording state management
  private voiceRecordingService: VoiceRecordingService;
  private isRecordingVoice: Map<string, boolean> = new Map(); // Track if user is recording voice
  private voiceRecordingResults: Map<string, VoiceRecordingResult> = new Map(); // Store voice results per user

  constructor() {
    super({
      packageName: PACKAGE_NAME,
      apiKey: MENTRAOS_API_KEY,
      port: PORT,
    });
    this.voiceRecordingService = new VoiceRecordingService();
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
      
      this.logger.info(`About to store metadata for ${userId}: ${JSON.stringify(photoInfo, null, 2)}`);
      this.logger.info(`Metadata file path: ${METADATA_FILE}`);
      
      // Write updated metadata
      fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));
      
      // Verify the data was written correctly
      const writtenData = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'));
      const userData = writtenData[userId];
      this.logger.info(`Verification - search_result exists: ${!!userData?.search_result}`);
      this.logger.info(`Verification - analysis_result exists: ${!!userData?.analysis_result}`);
      
      this.logger.info(`Metadata updated for user ${userId}`);
    } catch (error) {
      this.logger.error(`Error updating metadata: ${error}`);
      throw error;
    }
  }

  /**
   * Start voice recording for a user after face recognition
   */
  private async startVoiceRecording(userId: string, recognitionResult: any): Promise<void> {
    try {
      if (this.isRecordingVoice.get(userId)) {
        this.logger.info(`Voice recording already in progress for user ${userId}`);
        return;
      }

      this.logger.info(`🎤 Starting voice recording for user ${userId} after face recognition`);
      this.isRecordingVoice.set(userId, true);

      // Show user feedback
      // Note: We'll add UI feedback in Phase 5

      // Start voice recording asynchronously
      this.voiceRecordingService.startRecording(userId)
        .then((result) => {
          this.voiceRecordingResults.set(userId, result);
          this.isRecordingVoice.set(userId, false);
          
          if (result.success) {
            this.logger.info(`✅ Voice recording completed for user ${userId}`);
            this.logger.info(`📝 Transcription: ${result.transcription}`);
            this.logger.info(`🤖 Claude result: ${JSON.stringify(result.claudeResult, null, 2)}`);
            this.logger.info(`🗄️ Supabase result: ${JSON.stringify(result.supabaseResult, null, 2)}`);
          } else {
            this.logger.error(`❌ Voice recording failed for user ${userId}: ${result.error}`);
          }
        })
        .catch((error) => {
          this.logger.error(`❌ Voice recording error for user ${userId}: ${error}`);
          this.isRecordingVoice.set(userId, false);
          this.voiceRecordingResults.set(userId, {
            success: false,
            error: error.message
          });
        });

    } catch (error) {
      this.logger.error(`Error starting voice recording for user ${userId}: ${error}`);
      this.isRecordingVoice.set(userId, false);
    }
  }

  /**
   * Get voice recording status for a user
   */
  private getVoiceRecordingStatus(userId: string): {
    isRecording: boolean;
    result?: VoiceRecordingResult;
  } {
    return {
      isRecording: this.isRecordingVoice.get(userId) || false,
      result: this.voiceRecordingResults.get(userId)
    };
  }

  /**
   * Extract title/role from analysis data
   */
  private extractTitleFromAnalysis(analysisJson: any): string {
    // First, search through all analysis sections for title information
    const analysisText = JSON.stringify(analysisJson).toLowerCase();
    
    // Look for specific title patterns in the analysis
    if (analysisText.includes('professor') || analysisText.includes('dr.') || analysisText.includes('doctor')) {
      return "Professor";
    }
    if (analysisText.includes('ceo') || analysisText.includes('chief executive')) {
      return "CEO";
    }
    if (analysisText.includes('founder') || analysisText.includes('co-founder')) {
      return "Founder";
    }
    if (analysisText.includes('engineer') || analysisText.includes('software engineer')) {
      return "Engineer";
    }
    if (analysisText.includes('researcher') || analysisText.includes('research scientist')) {
      return "Researcher";
    }
    if (analysisText.includes('director')) {
      return "Director";
    }
    if (analysisText.includes('manager')) {
      return "Manager";
    }
    if (analysisText.includes('phd') || analysisText.includes('ph.d')) {
      return "PhD Student/Researcher";
    }
    if (analysisText.includes('graduate student') || analysisText.includes('grad student')) {
      return "Graduate Student";
    }
    if (analysisText.includes('undergraduate') || analysisText.includes('undergrad')) {
      return "Undergraduate Student";
    }
    
    // Look for specific role information in the analysis structure
    if (analysisJson["Extraordinary Qualities and Achievements"]) {
      const qualities = analysisJson["Extraordinary Qualities and Achievements"];
      if (qualities["Technical Excellence/Frontier"]?.Description) {
        const desc = qualities["Technical Excellence/Frontier"].Description;
        if (desc.includes("Computer Science + Chemistry and Bioengineering")) {
          return "Computer Science + Chemistry & Bioengineering Student";
        }
      }
    }
    
    // Try to extract title from name field as fallback
    if (analysisJson.Name) {
      const name = analysisJson.Name.toLowerCase();
      if (name.includes('professor') || name.includes('dr.') || name.includes('doctor')) {
        return "Professor";
      }
      if (name.includes('ceo') || name.includes('founder')) {
        return "CEO/Founder";
      }
      if (name.includes('engineer')) {
        return "Engineer";
      }
    }
    
    return "Student";
  }

  /**
   * Extract company affiliation from analysis data
   */
  private extractCompanyFromAnalysis(analysisJson: any, searchResult?: any): string {
    // First try to extract from analysis data - this is the primary source
    if (analysisJson["Extraordinary Qualities and Achievements"]) {
      const qualities = analysisJson["Extraordinary Qualities and Achievements"];
      if (qualities["Technical Excellence/Frontier"]?.Description) {
        const desc = qualities["Technical Excellence/Frontier"].Description;
        if (desc.includes("University of Illinois")) {
          return "University of Illinois Urbana-Champaign";
        }
        if (desc.includes("MIT")) {
          return "Massachusetts Institute of Technology";
        }
        if (desc.includes("Stanford")) {
          return "Stanford University";
        }
        if (desc.includes("Google")) {
          return "Google";
        }
        if (desc.includes("Microsoft")) {
          return "Microsoft";
        }
        if (desc.includes("Apple")) {
          return "Apple";
        }
        if (desc.includes("Meta") || desc.includes("Facebook")) {
          return "Meta";
        }
      }
    }
    
    // Look for company mentions in other analysis sections
    const analysisText = JSON.stringify(analysisJson).toLowerCase();
    
    // Universities and Educational Institutions
    if (analysisText.includes("university of illinois") || analysisText.includes("uiuc")) {
      return "University of Illinois Urbana-Champaign";
    }
    if (analysisText.includes("mit") || analysisText.includes("massachusetts institute")) {
      return "Massachusetts Institute of Technology";
    }
    if (analysisText.includes("stanford")) {
      return "Stanford University";
    }
    if (analysisText.includes("harvard")) {
      return "Harvard University";
    }
    if (analysisText.includes("berkeley") || analysisText.includes("uc berkeley")) {
      return "UC Berkeley";
    }
    if (analysisText.includes("carnegie mellon") || analysisText.includes("cmu")) {
      return "Carnegie Mellon University";
    }
    if (analysisText.includes("caltech")) {
      return "California Institute of Technology";
    }
    if (analysisText.includes("princeton")) {
      return "Princeton University";
    }
    if (analysisText.includes("yale")) {
      return "Yale University";
    }
    if (analysisText.includes("columbia")) {
      return "Columbia University";
    }
    
    // Tech Companies
    if (analysisText.includes("google") || analysisText.includes("alphabet")) {
      return "Google";
    }
    if (analysisText.includes("microsoft")) {
      return "Microsoft";
    }
    if (analysisText.includes("apple")) {
      return "Apple";
    }
    if (analysisText.includes("meta") || analysisText.includes("facebook")) {
      return "Meta";
    }
    if (analysisText.includes("amazon")) {
      return "Amazon";
    }
    if (analysisText.includes("netflix")) {
      return "Netflix";
    }
    if (analysisText.includes("tesla")) {
      return "Tesla";
    }
    if (analysisText.includes("openai")) {
      return "OpenAI";
    }
    if (analysisText.includes("anthropic")) {
      return "Anthropic";
    }
    if (analysisText.includes("nvidia")) {
      return "NVIDIA";
    }
    if (analysisText.includes("intel")) {
      return "Intel";
    }
    if (analysisText.includes("amd")) {
      return "AMD";
    }
    if (analysisText.includes("oracle")) {
      return "Oracle";
    }
    if (analysisText.includes("salesforce")) {
      return "Salesforce";
    }
    if (analysisText.includes("uber")) {
      return "Uber";
    }
    if (analysisText.includes("airbnb")) {
      return "Airbnb";
    }
    if (analysisText.includes("twitter") || analysisText.includes("x.com")) {
      return "X (Twitter)";
    }
    if (analysisText.includes("linkedin")) {
      return "LinkedIn";
    }
    if (analysisText.includes("github")) {
      return "GitHub";
    }
    if (analysisText.includes("docker")) {
      return "Docker";
    }
    if (analysisText.includes("kubernetes")) {
      return "Kubernetes";
    }
    if (analysisText.includes("mongodb")) {
      return "MongoDB";
    }
    if (analysisText.includes("redis")) {
      return "Redis";
    }
    if (analysisText.includes("elastic")) {
      return "Elastic";
    }
    if (analysisText.includes("databricks")) {
      return "Databricks";
    }
    if (analysisText.includes("snowflake")) {
      return "Snowflake";
    }
    if (analysisText.includes("palantir")) {
      return "Palantir";
    }
    if (analysisText.includes("stripe")) {
      return "Stripe";
    }
    if (analysisText.includes("square")) {
      return "Square";
    }
    if (analysisText.includes("paypal")) {
      return "PayPal";
    }
    if (analysisText.includes("coinbase")) {
      return "Coinbase";
    }
    if (analysisText.includes("binance")) {
      return "Binance";
    }
    if (analysisText.includes("ethereum")) {
      return "Ethereum Foundation";
    }
    if (analysisText.includes("bitcoin")) {
      return "Bitcoin";
    }
    
    // Research Institutions
    if (analysisText.includes("national science foundation") || analysisText.includes("nsf")) {
      return "National Science Foundation";
    }
    if (analysisText.includes("national institutes of health") || analysisText.includes("nih")) {
      return "National Institutes of Health";
    }
    if (analysisText.includes("department of energy") || analysisText.includes("doe")) {
      return "Department of Energy";
    }
    if (analysisText.includes("darpa")) {
      return "DARPA";
    }
    if (analysisText.includes("nasa")) {
      return "NASA";
    }
    if (analysisText.includes("cern")) {
      return "CERN";
    }
    if (analysisText.includes("max planck")) {
      return "Max Planck Institute";
    }
    
    // Only fall back to search results if analysis doesn't contain company info
    if (searchResult?.github?.company) {
      return searchResult.github.company;
    }
    
    if (searchResult?.linkedin?.company) {
      return searchResult.linkedin.company;
    }
    
    return "University of Illinois Urbana-Champaign"; // Default fallback
  }

  /**
   * Extract location/country from analysis data
   */
  private extractLocationFromAnalysis(analysisJson: any, searchResult?: any): string {
    // First try to extract from analysis data - this is the primary source
    const analysisText = JSON.stringify(analysisJson).toLowerCase();
    
    // Look for country/region mentions in the analysis
    if (analysisText.includes("united states") || analysisText.includes("usa") || analysisText.includes("us")) {
      return "United States";
    }
    if (analysisText.includes("canada")) {
      return "Canada";
    }
    if (analysisText.includes("united kingdom") || analysisText.includes("uk") || analysisText.includes("britain")) {
      return "United Kingdom";
    }
    if (analysisText.includes("germany")) {
      return "Germany";
    }
    if (analysisText.includes("france")) {
      return "France";
    }
    if (analysisText.includes("italy")) {
      return "Italy";
    }
    if (analysisText.includes("spain")) {
      return "Spain";
    }
    if (analysisText.includes("netherlands") || analysisText.includes("holland")) {
      return "Netherlands";
    }
    if (analysisText.includes("sweden")) {
      return "Sweden";
    }
    if (analysisText.includes("norway")) {
      return "Norway";
    }
    if (analysisText.includes("denmark")) {
      return "Denmark";
    }
    if (analysisText.includes("finland")) {
      return "Finland";
    }
    if (analysisText.includes("switzerland")) {
      return "Switzerland";
    }
    if (analysisText.includes("austria")) {
      return "Austria";
    }
    if (analysisText.includes("belgium")) {
      return "Belgium";
    }
    if (analysisText.includes("ireland")) {
      return "Ireland";
    }
    if (analysisText.includes("portugal")) {
      return "Portugal";
    }
    if (analysisText.includes("poland")) {
      return "Poland";
    }
    if (analysisText.includes("czech republic") || analysisText.includes("czechia")) {
      return "Czech Republic";
    }
    if (analysisText.includes("hungary")) {
      return "Hungary";
    }
    if (analysisText.includes("romania")) {
      return "Romania";
    }
    if (analysisText.includes("bulgaria")) {
      return "Bulgaria";
    }
    if (analysisText.includes("croatia")) {
      return "Croatia";
    }
    if (analysisText.includes("slovenia")) {
      return "Slovenia";
    }
    if (analysisText.includes("slovakia")) {
      return "Slovakia";
    }
    if (analysisText.includes("estonia")) {
      return "Estonia";
    }
    if (analysisText.includes("latvia")) {
      return "Latvia";
    }
    if (analysisText.includes("lithuania")) {
      return "Lithuania";
    }
    
    // Asia-Pacific
    if (analysisText.includes("china")) {
      return "China";
    }
    if (analysisText.includes("japan")) {
      return "Japan";
    }
    if (analysisText.includes("south korea") || analysisText.includes("korea")) {
      return "South Korea";
    }
    if (analysisText.includes("india")) {
      return "India";
    }
    if (analysisText.includes("singapore")) {
      return "Singapore";
    }
    if (analysisText.includes("hong kong")) {
      return "Hong Kong";
    }
    if (analysisText.includes("taiwan")) {
      return "Taiwan";
    }
    if (analysisText.includes("thailand")) {
      return "Thailand";
    }
    if (analysisText.includes("malaysia")) {
      return "Malaysia";
    }
    if (analysisText.includes("indonesia")) {
      return "Indonesia";
    }
    if (analysisText.includes("philippines")) {
      return "Philippines";
    }
    if (analysisText.includes("vietnam")) {
      return "Vietnam";
    }
    if (analysisText.includes("australia")) {
      return "Australia";
    }
    if (analysisText.includes("new zealand")) {
      return "New Zealand";
    }
    
    // Middle East & Africa
    if (analysisText.includes("israel")) {
      return "Israel";
    }
    if (analysisText.includes("uae") || analysisText.includes("united arab emirates")) {
      return "United Arab Emirates";
    }
    if (analysisText.includes("saudi arabia")) {
      return "Saudi Arabia";
    }
    if (analysisText.includes("turkey")) {
      return "Turkey";
    }
    if (analysisText.includes("iran")) {
      return "Iran";
    }
    if (analysisText.includes("egypt")) {
      return "Egypt";
    }
    if (analysisText.includes("south africa")) {
      return "South Africa";
    }
    if (analysisText.includes("nigeria")) {
      return "Nigeria";
    }
    if (analysisText.includes("kenya")) {
      return "Kenya";
    }
    if (analysisText.includes("morocco")) {
      return "Morocco";
    }
    if (analysisText.includes("tunisia")) {
      return "Tunisia";
    }
    if (analysisText.includes("algeria")) {
      return "Algeria";
    }
    if (analysisText.includes("ethiopia")) {
      return "Ethiopia";
    }
    if (analysisText.includes("ghana")) {
      return "Ghana";
    }
    
    // Latin America
    if (analysisText.includes("brazil")) {
      return "Brazil";
    }
    if (analysisText.includes("mexico")) {
      return "Mexico";
    }
    if (analysisText.includes("argentina")) {
      return "Argentina";
    }
    if (analysisText.includes("chile")) {
      return "Chile";
    }
    if (analysisText.includes("colombia")) {
      return "Colombia";
    }
    if (analysisText.includes("peru")) {
      return "Peru";
    }
    if (analysisText.includes("venezuela")) {
      return "Venezuela";
    }
    if (analysisText.includes("ecuador")) {
      return "Ecuador";
    }
    if (analysisText.includes("bolivia")) {
      return "Bolivia";
    }
    if (analysisText.includes("paraguay")) {
      return "Paraguay";
    }
    if (analysisText.includes("uruguay")) {
      return "Uruguay";
    }
    if (analysisText.includes("cuba")) {
      return "Cuba";
    }
    if (analysisText.includes("jamaica")) {
      return "Jamaica";
    }
    if (analysisText.includes("costa rica")) {
      return "Costa Rica";
    }
    if (analysisText.includes("panama")) {
      return "Panama";
    }
    if (analysisText.includes("guatemala")) {
      return "Guatemala";
    }
    if (analysisText.includes("honduras")) {
      return "Honduras";
    }
    if (analysisText.includes("nicaragua")) {
      return "Nicaragua";
    }
    if (analysisText.includes("el salvador")) {
      return "El Salvador";
    }
    if (analysisText.includes("belize")) {
      return "Belize";
    }
    
    // Look for specific city/state mentions that can help identify country
    if (analysisText.includes("california") || analysisText.includes("san francisco") || analysisText.includes("los angeles") || analysisText.includes("san diego") || analysisText.includes("silicon valley")) {
      return "United States";
    }
    if (analysisText.includes("new york") || analysisText.includes("manhattan") || analysisText.includes("brooklyn")) {
      return "United States";
    }
    if (analysisText.includes("texas") || analysisText.includes("houston") || analysisText.includes("dallas") || analysisText.includes("austin")) {
      return "United States";
    }
    if (analysisText.includes("illinois") || analysisText.includes("chicago")) {
      return "United States";
    }
    if (analysisText.includes("massachusetts") || analysisText.includes("boston") || analysisText.includes("cambridge")) {
      return "United States";
    }
    if (analysisText.includes("washington") || analysisText.includes("seattle")) {
      return "United States";
    }
    if (analysisText.includes("florida") || analysisText.includes("miami") || analysisText.includes("orlando")) {
      return "United States";
    }
    if (analysisText.includes("toronto") || analysisText.includes("vancouver") || analysisText.includes("montreal")) {
      return "Canada";
    }
    if (analysisText.includes("london") || analysisText.includes("manchester") || analysisText.includes("birmingham")) {
      return "United Kingdom";
    }
    if (analysisText.includes("berlin") || analysisText.includes("munich") || analysisText.includes("hamburg")) {
      return "Germany";
    }
    if (analysisText.includes("paris") || analysisText.includes("lyon") || analysisText.includes("marseille")) {
      return "France";
    }
    if (analysisText.includes("rome") || analysisText.includes("milan") || analysisText.includes("naples")) {
      return "Italy";
    }
    if (analysisText.includes("madrid") || analysisText.includes("barcelona") || analysisText.includes("valencia")) {
      return "Spain";
    }
    if (analysisText.includes("amsterdam") || analysisText.includes("rotterdam") || analysisText.includes("the hague")) {
      return "Netherlands";
    }
    if (analysisText.includes("stockholm") || analysisText.includes("gothenburg")) {
      return "Sweden";
    }
    if (analysisText.includes("oslo") || analysisText.includes("bergen")) {
      return "Norway";
    }
    if (analysisText.includes("copenhagen") || analysisText.includes("aarhus")) {
      return "Denmark";
    }
    if (analysisText.includes("helsinki") || analysisText.includes("tampere")) {
      return "Finland";
    }
    if (analysisText.includes("zurich") || analysisText.includes("geneva") || analysisText.includes("basel")) {
      return "Switzerland";
    }
    if (analysisText.includes("vienna") || analysisText.includes("salzburg")) {
      return "Austria";
    }
    if (analysisText.includes("brussels") || analysisText.includes("antwerp")) {
      return "Belgium";
    }
    if (analysisText.includes("dublin") || analysisText.includes("cork")) {
      return "Ireland";
    }
    if (analysisText.includes("lisbon") || analysisText.includes("porto")) {
      return "Portugal";
    }
    if (analysisText.includes("warsaw") || analysisText.includes("krakow")) {
      return "Poland";
    }
    if (analysisText.includes("prague") || analysisText.includes("brno")) {
      return "Czech Republic";
    }
    if (analysisText.includes("budapest") || analysisText.includes("debrecen")) {
      return "Hungary";
    }
    if (analysisText.includes("bucharest") || analysisText.includes("cluj")) {
      return "Romania";
    }
    if (analysisText.includes("sofia") || analysisText.includes("plovdiv")) {
      return "Bulgaria";
    }
    if (analysisText.includes("zagreb") || analysisText.includes("split")) {
      return "Croatia";
    }
    if (analysisText.includes("ljubljana") || analysisText.includes("maribor")) {
      return "Slovenia";
    }
    if (analysisText.includes("bratislava") || analysisText.includes("kosice")) {
      return "Slovakia";
    }
    if (analysisText.includes("tallinn") || analysisText.includes("tartu")) {
      return "Estonia";
    }
    if (analysisText.includes("riga") || analysisText.includes("daugavpils")) {
      return "Latvia";
    }
    if (analysisText.includes("vilnius") || analysisText.includes("kaunas")) {
      return "Lithuania";
    }
    
    // Asia-Pacific cities
    if (analysisText.includes("beijing") || analysisText.includes("shanghai") || analysisText.includes("shenzhen") || analysisText.includes("guangzhou")) {
      return "China";
    }
    if (analysisText.includes("tokyo") || analysisText.includes("osaka") || analysisText.includes("kyoto") || analysisText.includes("yokohama")) {
      return "Japan";
    }
    if (analysisText.includes("seoul") || analysisText.includes("busan") || analysisText.includes("incheon")) {
      return "South Korea";
    }
    if (analysisText.includes("mumbai") || analysisText.includes("delhi") || analysisText.includes("bangalore") || analysisText.includes("chennai")) {
      return "India";
    }
    if (analysisText.includes("singapore")) {
      return "Singapore";
    }
    if (analysisText.includes("hong kong")) {
      return "Hong Kong";
    }
    if (analysisText.includes("taipei") || analysisText.includes("kaohsiung")) {
      return "Taiwan";
    }
    if (analysisText.includes("bangkok") || analysisText.includes("chiang mai")) {
      return "Thailand";
    }
    if (analysisText.includes("kuala lumpur") || analysisText.includes("penang")) {
      return "Malaysia";
    }
    if (analysisText.includes("jakarta") || analysisText.includes("surabaya")) {
      return "Indonesia";
    }
    if (analysisText.includes("manila") || analysisText.includes("cebu")) {
      return "Philippines";
    }
    if (analysisText.includes("ho chi minh city") || analysisText.includes("hanoi")) {
      return "Vietnam";
    }
    if (analysisText.includes("sydney") || analysisText.includes("melbourne") || analysisText.includes("brisbane")) {
      return "Australia";
    }
    if (analysisText.includes("auckland") || analysisText.includes("wellington")) {
      return "New Zealand";
    }
    
    // Only fall back to search results if analysis doesn't contain location info
    if (searchResult?.github?.location) {
      return searchResult.github.location;
    }
    
    if (searchResult?.linkedin?.location) {
      return searchResult.linkedin.location;
    }
    
    return "Unknown"; // Default fallback
  }

  /**
   * Extract recognition from analysis data
   */
  private extractRecognitionFromAnalysis(analysisJson: any): string[] {
    const recognition: string[] = [];
    
    if (analysisJson["Extraordinary Qualities and Achievements"]) {
      const qualities = analysisJson["Extraordinary Qualities and Achievements"];
      
      if (qualities["Prestige/Validation"]?.Evidence) {
        recognition.push(...qualities["Prestige/Validation"].Evidence);
      }
      
      if (qualities["Recognition by Experts/Institutions"]?.Evidence) {
        recognition.push(...qualities["Recognition by Experts/Institutions"].Evidence);
      }
    }
    
    return recognition;
  }

  /**
   * Extract built/achieved from analysis data
   */
  private extractBuiltFromAnalysis(analysisJson: any): string[] {
    const built: string[] = [];
    
    if (analysisJson["Extraordinary Qualities and Achievements"]) {
      const qualities = analysisJson["Extraordinary Qualities and Achievements"];
      
      if (qualities["Impact"]?.Evidence) {
        built.push(...qualities["Impact"].Evidence);
      }
      
      if (qualities["Builder/Startup Cred"]?.Evidence) {
        built.push(...qualities["Builder/Startup Cred"].Evidence);
      }
    }
    
    return built;
  }

  /**
   * Transform criteria hits from analysis data
   */
  private transformCriteriaHits(analysisJson: any): any {
    const criteriaHits: any = {};
    
    if (analysisJson["Extraordinary Qualities and Achievements"]) {
      const qualities = analysisJson["Extraordinary Qualities and Achievements"];
      
      // Map the old format to new format
      if (qualities["Impact"]) {
        criteriaHits.impact = qualities["Impact"].Evidence || [];
      }
      if (qualities["Prestige/Validation"]) {
        criteriaHits.prestige_validation = qualities["Prestige/Validation"].Evidence || [];
      }
      if (qualities["Pioneering Work"]) {
        criteriaHits.pioneering_work = qualities["Pioneering Work"].Evidence || [];
      }
      if (qualities["Recognition by Experts/Institutions"]) {
        criteriaHits.recognition_by_institutions = qualities["Recognition by Experts/Institutions"].Evidence || [];
      }
      if (qualities["Exceptional Talent Young"]) {
        criteriaHits.exceptional_young = qualities["Exceptional Talent Young"].Evidence || [];
      }
      if (qualities["Technical Excellence/Frontier"]) {
        criteriaHits.technical_frontier = qualities["Technical Excellence/Frontier"].Evidence || [];
      }
      if (qualities["Builder/Startup Cred"]) {
        criteriaHits.builder_startup_cred = qualities["Builder/Startup Cred"].Evidence || [];
      }
    }
    
    return criteriaHits;
  }

  /**
   * Extract social media links from analysis and search data
   */
  private extractSocialLinks(analysisJson: any, searchResult?: any): { github?: string; linkedin?: string } {
    const socialLinks: { github?: string; linkedin?: string } = {};
    
    this.logger.info(`Extracting social links from analysis: ${JSON.stringify(analysisJson, null, 2)}`);
    this.logger.info(`Extracting social links from search result: ${JSON.stringify(searchResult, null, 2)}`);
    
    // First try to extract from analysis data
    const analysisText = JSON.stringify(analysisJson).toLowerCase();
    
    // Look for GitHub URLs in analysis
    const githubMatch = analysisText.match(/github\.com\/[a-zA-Z0-9_-]+/);
    if (githubMatch) {
      socialLinks.github = 'https://' + githubMatch[0];
      this.logger.info(`Found GitHub URL in analysis: ${socialLinks.github}`);
    }
    
    // Look for LinkedIn URLs in analysis
    const linkedinMatch = analysisText.match(/linkedin\.com\/in\/[a-zA-Z0-9_-]+/);
    if (linkedinMatch) {
      socialLinks.linkedin = 'https://' + linkedinMatch[0];
      this.logger.info(`Found LinkedIn URL in analysis: ${socialLinks.linkedin}`);
    }
    
    // Fall back to search results if not found in analysis
    if (!socialLinks.github && searchResult?.github?.html_url) {
      socialLinks.github = searchResult.github.html_url;
      this.logger.info(`Found GitHub URL in search result (html_url): ${socialLinks.github}`);
    }
    if (!socialLinks.github && searchResult?.github?.url) {
      socialLinks.github = searchResult.github.url;
      this.logger.info(`Found GitHub URL in search result (url): ${socialLinks.github}`);
    }
    
    if (!socialLinks.linkedin && searchResult?.linkedin?.url) {
      socialLinks.linkedin = searchResult.linkedin.url;
      this.logger.info(`Found LinkedIn URL in search result: ${socialLinks.linkedin}`);
    }
    
    this.logger.info(`Final social links extracted: ${JSON.stringify(socialLinks, null, 2)}`);
    return socialLinks;
  }

  /**
   * Extract sources from search result data
   */
  private extractSourcesFromSearch(searchResult: any): any[] {
    const sources: any[] = [];
    
    this.logger.info(`Full search result structure: ${JSON.stringify(searchResult, null, 2)}`);
    
    if (searchResult?.github) {
      // Handle different GitHub data structures
      const github = searchResult.github;
      this.logger.info(`GitHub data structure: ${JSON.stringify(github, null, 2)}`);
      let evidence = '';
      let sourceHint = '';
      
      // Try different possible structures
      if (github.name && github.bio) {
        evidence = `${github.name} - ${github.bio}`;
      } else if (github.username && github.bio) {
        evidence = `${github.username} - ${github.bio}`;
      } else if (github.name) {
        evidence = github.name;
      } else if (github.username) {
        evidence = github.username;
      } else if (github.bio) {
        evidence = github.bio;
      } else {
        evidence = 'GitHub Profile Found';
      }
      
      // Try different URL properties
      sourceHint = github.url || github.html_url || github.profile_url || 'GitHub Profile';
      
      sources.push({
        fact: "GitHub Profile",
        evidence: evidence,
        source_hint: sourceHint
      });
    }
    
    if (searchResult?.web_info?.search_results) {
      const linkedinSearch = searchResult.web_info.search_results["\"sean guno\" linkedin profile"];
      if (linkedinSearch?.organic?.[0]) {
        const firstResult = linkedinSearch.organic[0];
        sources.push({
          fact: "LinkedIn Profile",
          evidence: firstResult.snippet,
          source_hint: firstResult.link
        });
      }
    }
    
    return sources;
  }

  /**
   * Fix common JSON malformation issues
   */
  private fixMalformedJson(jsonString: string): string {
    try {
      // Count braces to see if we're missing closing braces
      const openBraces = (jsonString.match(/\{/g) || []).length;
      const closeBraces = (jsonString.match(/\}/g) || []).length;
      
      // Count quotes to see if we have unterminated strings
      const quotes = (jsonString.match(/"/g) || []).length;
      
      let fixedJson = jsonString;
      
      // If we have an odd number of quotes, we likely have an unterminated string
      if (quotes % 2 !== 0) {
        // Find the last quote and see if it's properly terminated
        const lastQuoteIndex = jsonString.lastIndexOf('"');
        const afterLastQuote = jsonString.substring(lastQuoteIndex + 1);
        
        // If there's no closing quote after the last quote, add it
        if (!afterLastQuote.trim().startsWith('"') && !afterLastQuote.trim().startsWith(',')) {
          fixedJson = jsonString + '"';
        }
      }
      
      // If we're missing closing braces, add them
      if (openBraces > closeBraces) {
        const missingBraces = openBraces - closeBraces;
        fixedJson += '}'.repeat(missingBraces);
      }
      
      return fixedJson;
    } catch (error) {
      this.logger.error(`Error fixing malformed JSON: ${error}`);
      return jsonString; // Return original if fixing fails
    }
  }

  /**
   * Extract data manually from malformed JSON string using regex
   */
  private extractDataFromMalformedJson(jsonString: string, userPhoto: any): any {
    try {
      const analysisData: any = {
        name: userPhoto.recognition?.name || 'Unknown Person',
        country: this.extractLocationFromAnalysis(userPhoto.analysis_result || {}, userPhoto.search_result),
        title_role: this.extractTitleFromAnalysis(userPhoto.analysis_result || {}),
        company_affiliation: this.extractCompanyFromAnalysis(userPhoto.analysis_result || {}, userPhoto.search_result),
        extraordinary_punchline: null,
        claim_to_fame: 'Analysis data parsing failed, but person was recognized',
        recognition: [],
        built_or_achieved: [],
        criteria_hits: {},
        sources: this.extractSourcesFromSearch(userPhoto.search_result),
        social_links: this.extractSocialLinks(userPhoto.analysis_result || {}, userPhoto.search_result)
      };

      // Extract Name using regex
      const nameMatch = jsonString.match(/"Name":\s*"([^"]+)"/);
      if (nameMatch) {
        analysisData.name = nameMatch[1];
      }

      // Extract Celebration text using regex (handle multiline)
      const celebrationMatch = jsonString.match(/"Celebration":\s*"([^"]*(?:\\.[^"]*)*)"/);
      if (celebrationMatch) {
        analysisData.claim_to_fame = celebrationMatch[1].replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
      }

      // Extract extraordinary_punchline using regex (handle multiline)
      const punchlineMatch = jsonString.match(/"extraordinary_punchline":\s*"([^"]*(?:\\.[^"]*)*)"/);
      if (punchlineMatch) {
        analysisData.extraordinary_punchline = punchlineMatch[1].replace(/\\n/g, ' ').replace(/\s+/g, ' ').trim();
      }

      // Extract Evidence arrays from each criteria
      const criteriaSections = [
        'Impact', 'Prestige/Validation', 'Pioneering Work', 
        'Recognition by Experts/Institutions', 'Exceptional Talent Young',
        'Technical Excellence/Frontier', 'Builder/Startup Cred'
      ];

      const criteriaHits: any = {};
      const allEvidence: string[] = [];
      
      criteriaSections.forEach(criteria => {
        const escapedCriteria = criteria.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const evidenceRegex = new RegExp(`"${escapedCriteria}":\\s*{[^}]*"Evidence":\\s*\\[([^\\]]+)\\]`, 's');
        const match = jsonString.match(evidenceRegex);
        
        if (match) {
          const evidenceText = match[1];
          // Better parsing of evidence items - handle the raw string format
          let evidenceItems: string[] = [];
          
          // Try to parse as JSON array first
          try {
            const jsonArray = JSON.parse('[' + evidenceText + ']');
            evidenceItems = jsonArray.filter((item: any) => typeof item === 'string' && item.trim().length > 0);
          } catch {
            // Fallback to string splitting
            evidenceItems = evidenceText
              .split('","')
              .map(item => item.replace(/^"/, '').replace(/"$/, '').trim())
              .filter(item => item.length > 0);
          }
          
          const criteriaKey = criteria.toLowerCase().replace(/[^a-z0-9]/g, '_');
          criteriaHits[criteriaKey] = evidenceItems;
          
          // Add to all evidence for recognition/built sections
          allEvidence.push(...evidenceItems);
        }
      });

      analysisData.criteria_hits = criteriaHits;

      // Create unique recognition and built items (avoid duplicates)
      const uniqueEvidence = [...new Set(allEvidence)]; // Remove duplicates
      
      // Split recognition and built items more intelligently
      const recognitionItems = uniqueEvidence.filter(item => 
        item.includes('University') || 
        item.includes('academic') || 
        item.includes('exceptional') ||
        item.includes('prestigious')
      );
      
      const builtItems = uniqueEvidence.filter(item => 
        item.includes('GitHub') || 
        item.includes('internship') || 
        item.includes('technical') ||
        item.includes('projects')
      );

      analysisData.recognition = recognitionItems.slice(0, 4); // Take up to 4 recognition items
      analysisData.built_or_achieved = builtItems.slice(0, 4); // Take up to 4 built items

      this.logger.info(`Successfully extracted data from malformed JSON: ${JSON.stringify(analysisData, null, 2)}`);
      
      return analysisData;
    } catch (error) {
      this.logger.error(`Error extracting data from malformed JSON: ${error}`);
      
      // Return basic fallback data
      return {
        name: userPhoto.recognition?.name || 'Unknown Person',
        country: this.extractLocationFromAnalysis(userPhoto.analysis_result || {}, userPhoto.search_result),
        title_role: this.extractTitleFromAnalysis(userPhoto.analysis_result || {}),
        company_affiliation: this.extractCompanyFromAnalysis(userPhoto.analysis_result || {}, userPhoto.search_result),
        extraordinary_punchline: null,
        claim_to_fame: 'Analysis data parsing failed, but person was recognized',
        recognition: [],
        built_or_achieved: [],
        criteria_hits: {},
        sources: this.extractSourcesFromSearch(userPhoto.search_result),
        social_links: this.extractSocialLinks(userPhoto.analysis_result || {}, userPhoto.search_result)
      };
    }
  }

  /**
   * Call face recognition API to identify person in the photo
   */
  private async recognizeFace(filePath: string): Promise<any> {
    try {
      this.logger.info(`Calling face recognition API for: ${filePath}`);
      
      const response = await axios.post(`${FACE_RECOGNITION_API_URL}/recognize`, {
        filename: filePath
      }, {
        timeout: 50000, // 30 second timeout
        headers: {
          'Content-Type': 'application/json'
        }
      });
      

      this.logger.info(`Full face recognition response: ${JSON.stringify(response.data, null, 2)}`);
      
      if (response.data.success) {
        this.logger.info(`Face recognition successful`);
        this.logger.info(`Search result: ${JSON.stringify(response.data.search_result, null, 2)}`);
        this.logger.info(`Analysis result: ${JSON.stringify(response.data.analysis_result, null, 2)}`);
        return response.data;
      } else {
        this.logger.warn(`Face recognition failed: ${response.data.error}`);
        return { success: false, error: response.data.error };
      }
    } catch (error) {
      this.logger.error(`Error calling face recognition API: ${error}`);
      return { success: false, error: error.message };
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
          this.nextPhotoTime.set(userId, Date.now() + 50000);

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
    for (const [requestId, trackedUserId] of Array.from(this.photoRequestToUser.entries())) {
      if (trackedUserId === userId) {
        this.photoRequestToUser.delete(requestId);
      }
    }
    
    // Clean up voice recording state
    this.isRecordingVoice.set(userId, false);
    this.voiceRecordingResults.delete(userId);
    
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
    let savedFilePath: string | null = null;
    try {
      savedFilePath = await this.savePhotoToStorage(photo, userId);
      this.logger.info(`Photo saved locally for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to save photo locally for user ${userId}: ${error}`);
      // Continue with caching even if local save fails
    }

    // Call face recognition API if photo was saved successfully
    if (savedFilePath) {
      try {
        const recognitionResult = await this.recognizeFace(savedFilePath);

        this.logger.info(`Analysis result in cachePhoto: ${JSON.stringify(recognitionResult.analysis_result, null, 2)}`);
        this.logger.info(`Type of analysis_result: ${typeof recognitionResult.analysis_result}`);
        this.logger.info(`Constructor name: ${recognitionResult.analysis_result?.constructor?.name}`);
        this.logger.info(`Analysis result keys: ${Object.keys(recognitionResult.analysis_result || {})}`);
        this.logger.info(`Search result: ${JSON.stringify(recognitionResult.search_result, null, 2)}`);
        
        // Update metadata with recognition results
        if (recognitionResult.success) {
          // Validate that we have the required data before storing
          if (!recognitionResult.search_result || !recognitionResult.analysis_result) {
            this.logger.error(`Missing required data - search_result: ${!!recognitionResult.search_result}, analysis_result: ${!!recognitionResult.analysis_result}`);
            return;
          }
          
          const metadataToStore = {
            requestId: photo.requestId,
            timestamp: photo.timestamp.toISOString(),
            userId: userId,
            mimeType: photo.mimeType,
            filename: photo.filename,
            size: photo.size,
            filePath: savedFilePath,
            recognition: {
              name: recognitionResult.name,
              confidence: recognitionResult.confidence,
              face_id: recognitionResult.face_id,
              recognized_at: new Date().toISOString()
            },
            // Store the analysis data directly
            search_result: recognitionResult.search_result,
            analysis_result: recognitionResult.analysis_result
          };
          
          this.logger.info(`About to store metadata with analysis_result: ${JSON.stringify(metadataToStore.analysis_result, null, 2)}`);
          this.logger.info(`About to store metadata with search_result: ${JSON.stringify(metadataToStore.search_result, null, 2)}`);
          
          // Add a small delay to ensure everything is ready
          await new Promise(resolve => setTimeout(resolve, 100));
          
          await this.updateMetadata(userId, metadataToStore);
          
          this.logger.info(`Face recognition completed for user ${userId}: ${recognitionResult.name}`);
          
          // 🎤 Voice recording is now manual - user can start it via API endpoint
          // await this.startVoiceRecording(userId, recognitionResult);
        } else {
          this.logger.warn(`Face recognition failed for user ${userId}: ${recognitionResult.error}`);
        }
      } catch (error) {
        this.logger.error(`Error during face recognition for user ${userId}: ${error}`);
      }
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

    // Supabase voice conversation endpoint
    app.post('/api/voice', async (req: any, res: any) => {
      try {
        const { field, email, name, history, summary } = req.body;
        
        // Import Supabase client
        const { createClient } = await import('@supabase/supabase-js');
        
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        
        if (!supabaseUrl || !supabaseKey) {
          return res.status(500).json({ error: 'Supabase configuration missing' });
        }
        
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        const { data, error } = await supabase
          .from('convo')
          .insert({
            field,
            email,
            name,
            history,
            summary
          })
          .select()
          .single();

        if (error) {
          return res.status(500).json({ error: error.message });
        }

        res.json({ success: true, data });
      } catch (error) {
        console.error('Voice API error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
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

    // API endpoint to get latest photo recognition results
    app.get('/api/latest-recognition', (req: any, res: any) => {
      const userId = (req as AuthenticatedRequest).authUserId;

      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      try {
        // Read metadata to get latest photo recognition
        if (!fs.existsSync(METADATA_FILE)) {
          res.json({ recognition: null });
          return;
        }

        const metadataContent = fs.readFileSync(METADATA_FILE, 'utf8');
        const metadata = JSON.parse(metadataContent);
        
        const userPhoto = metadata[userId];
        if (userPhoto && userPhoto.recognition) {
          res.json({ 
            recognition: userPhoto.recognition,
            photo: {
              requestId: userPhoto.requestId,
              timestamp: userPhoto.timestamp,
              filename: userPhoto.filename
            }
          });
        } else {
          res.json({ recognition: null });
        }
      } catch (error) {
        this.logger.error(`Error reading recognition results: ${error}`);
        res.status(500).json({ error: 'Failed to read recognition results' });
      }
    });

    // Main webview route - displays the photo viewer interface
    // app.get('/webview', async (req: any, res: any) => {
    //   const userId = (req as AuthenticatedRequest).authUserId;

    //   if (!userId) {
    //     res.status(401).send(`
    //       <html>
    //         <head><title>Photo Viewer - Not Authenticated</title></head>
    //         <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
    //           <h1>Please open this page from the MentraOS app</h1>
    //         </body>
    //       </html>
    //     `);
    //     return;
    //   }

    //   const templatePath = path.join(process.cwd(), 'views', 'photo-viewer.ejs');
    //   const html = await ejs.renderFile(templatePath, {});
    //   res.send(html);
    // });

    // // Face recognition results webview route
    // app.get('/webview', async (req: any, res: any) => {
    //   const userId = (req as AuthenticatedRequest).authUserId;

    //   if (!userId) {
    //     res.status(401).send(`
    //       <html>
    //         <head><title>Face Recognition - Not Authenticated</title></head>
    //         <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
    //           <h1>Please open this page from the MentraOS app</h1>
    //         </body>
    //       </html>
    //     `);
    //     return;
    //   }

    //   const templatePath = path.join(process.cwd(), 'views', 'face-recognition-viewer.ejs');
    //   const html = await ejs.renderFile(templatePath, {});
    //   res.send(html);
    // });

    // Analysis viewer webview route
    app.get('/webview', async (req: any, res: any) => {
      const userId = (req as AuthenticatedRequest).authUserId;

      if (!userId) {
        res.status(401).send(`
          <html>
            <head><title>Analysis Viewer - Not Authenticated</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h1>Please open this page from the MentraOS app</h1>
            </body>
          </html>
        `);
        return;
      }

      // Try to get the latest analysis data for this user
      let analysisData = null;
      try {
        if (fs.existsSync(METADATA_FILE)) {
          const metadataContent = fs.readFileSync(METADATA_FILE, 'utf8');
          const metadata = JSON.parse(metadataContent);
          const userPhoto = metadata[userId];
          
          if (userPhoto && userPhoto.analysis_result) {
            this.logger.info(`Raw analysis_result for user ${userId}: ${JSON.stringify(userPhoto.analysis_result, null, 2)}`);
            
            try {
              // Parse the analysis_result.data which contains the JSON string
              let analysisJson;
              if (typeof userPhoto.analysis_result.data === 'string') {
                // Try to fix common JSON issues before parsing
                let jsonString = userPhoto.analysis_result.data;
                
                // Fix unterminated strings by adding missing quotes and braces
                jsonString = this.fixMalformedJson(jsonString);
                
                analysisJson = JSON.parse(jsonString);
              } else {
                // If it's already an object, use it directly
                analysisJson = userPhoto.analysis_result.data;
              }
              
              this.logger.info(`Parsed analysis JSON for user ${userId}: ${JSON.stringify(analysisJson, null, 2)}`);
              
              // Transform the data to match the flexible format
              analysisData = {
                name: analysisJson.Name || userPhoto.recognition?.name || 'Unknown Person',
                country: this.extractLocationFromAnalysis(userPhoto.analysis_result || {}, userPhoto.search_result),
                title_role: this.extractTitleFromAnalysis(analysisJson),
                company_affiliation: this.extractCompanyFromAnalysis(analysisJson, userPhoto.search_result),
                extraordinary_punchline: analysisJson.extraordinary_punchline || null,
                claim_to_fame: analysisJson.Celebration || 'No claim to fame available',
                recognition: this.extractRecognitionFromAnalysis(analysisJson),
                built_or_achieved: this.extractBuiltFromAnalysis(analysisJson),
                criteria_hits: this.transformCriteriaHits(analysisJson),
                sources: this.extractSourcesFromSearch(userPhoto.search_result),
                social_links: this.extractSocialLinks(analysisJson, userPhoto.search_result)
              };
              
              this.logger.info(`Transformed analysis data for user ${userId}: ${JSON.stringify(analysisData, null, 2)}`);
            } catch (parseError) {
              this.logger.error(`Error parsing analysis JSON for user ${userId}: ${parseError}`);
              this.logger.error(`Raw data that failed to parse: ${userPhoto.analysis_result.data}`);
              
              // Try to extract data manually from the malformed JSON string
              analysisData = this.extractDataFromMalformedJson(userPhoto.analysis_result.data, userPhoto);
            }
          } else {
            this.logger.info(`No analysis data found for user ${userId}`);
          }
        }
      } catch (error) {
        this.logger.error(`Error reading analysis data for user ${userId}: ${error}`);
      }

      const templatePath = path.join(process.cwd(), 'views', 'flexible-analysis-viewer.ejs');
      const html = await ejs.renderFile(templatePath, { data: analysisData });
      res.send(html);
    });

    // // Demo route for testing the flexible analysis viewer
    // app.get('/demo-flexible', async (req: any, res: any) => {
    //   // Demo data matching the new JSON format
    //   const demoData = {
    //     "name": "Sean Guno",
    //     "photo": "",
    //     "country": "United States",
    //     "title_role": "Computer Science + Chemistry & Bioengineering Student",
    //     "company_affiliation": "University of Illinois Urbana-Champaign",
    //     "claim_to_fame": "Pursuing an ambitious dual degree program combining computer science with chemistry and bioengineering, demonstrating exceptional intellectual curiosity and interdisciplinary potential.",
    //     "recognition": [
    //       "Accepted to University of Illinois Urbana-Champaign",
    //       "Pursuing challenging dual degree program"
    //     ],
    //     "built_or_achieved": [
    //       "Dual degree program in Computer Science + Chemistry and Bioengineering",
    //       "Active involvement in University of Illinois community"
    //     ],
    //     "quote": "The intersection of computer science and bioengineering represents the future of scientific innovation.",
    //     "criteria_hits": {
    //       "impact": [
    //         "Pursuing dual degrees in Computer Science + Chemistry and Bioengineering, showcasing breadth of interests and talents",
    //         "Actively involved in the University of Illinois community, indicating drive and engagement"
    //       ],
    //       "prestige_validation": [
    //         "Attending the highly ranked University of Illinois Urbana-Champaign, a renowned institution for engineering and science",
    //         "Pursuing a dual degree, which is a challenging and prestigious academic path"
    //       ],
    //       "pioneering_work": [
    //         "Pursuing dual degrees in Computer Science + Chemistry and Bioengineering, indicating a desire to integrate multiple fields",
    //         "Exploring the frontiers of science and technology through his academic program"
    //       ],
    //       "recognition_by_institutions": [
    //         "Attending the University of Illinois Urbana-Champaign, a top-tier institution that is highly selective and recognized for its strengths in science and technology"
    //       ],
    //       "exceptional_young": [
    //         "Pursuing a dual degree program as an undergraduate student, which is a challenging and uncommon academic path",
    //         "Demonstrating a strong foundation in both computer science and the natural sciences at a young age"
    //       ],
    //       "technical_frontier": [
    //         "Pursuing a dual degree in Computer Science + Chemistry and Bioengineering, which combines multiple technical disciplines at the forefront of innovation",
    //         "Demonstrating a strong foundation in both computer science and the natural sciences, which are critical for advancements in emerging technologies and scientific breakthroughs"
    //       ],
    //       "builder_startup_cred": [
    //         "Pursuing a dual degree in Computer Science + Chemistry and Bioengineering, which requires a diverse skillset and problem-solving abilities that are valuable in entrepreneurial and innovative settings",
    //         "Demonstrating intellectual curiosity and a willingness to tackle complex, multifaceted challenges, which are hallmarks of successful builders and entrepreneurs"
    //       ]
    //     },
    //     "sources": [
    //       {
    //         "fact": "Dual degree program",
    //         "evidence": "Pursuing dual degrees in Computer Science + Chemistry and Bioengineering",
    //         "source_hint": "University records"
    //       },
    //       {
    //         "fact": "University affiliation",
    //         "evidence": "Student at University of Illinois Urbana-Champaign",
    //         "source_hint": "Academic records"
    //       }
    //     ]
    //   };

    //   const templatePath = path.join(process.cwd(), 'views', 'flexible-analysis-viewer.ejs');
    //   const html = await ejs.renderFile(templatePath, { data: demoData });
    //   res.send(html);
    // });

    // API endpoint to get latest analysis data for a user
    app.get('/api/latest-analysis', (req: any, res: any) => {
      const userId = (req as AuthenticatedRequest).authUserId;

      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      try {
        // Read metadata to get latest analysis
        if (!fs.existsSync(METADATA_FILE)) {
          res.json({ analysis: null });
          return;
        }

        const metadataContent = fs.readFileSync(METADATA_FILE, 'utf8');
        const metadata = JSON.parse(metadataContent);
        
        const userPhoto = metadata[userId];
        if (userPhoto && userPhoto.analysis_result) {
          this.logger.info(`Found analysis data for user ${userId}: ${JSON.stringify(userPhoto.analysis_result, null, 2)}`);
          this.logger.info(`Found search data for user ${userId}: ${JSON.stringify(userPhoto.search_result, null, 2)}`);
          
          res.json({ 
            analysis: userPhoto.analysis_result,
            search_result: userPhoto.search_result,
            photo: {
              requestId: userPhoto.requestId,
              timestamp: userPhoto.timestamp,
              filename: userPhoto.filename
            }
          });
        } else {
          this.logger.info(`No analysis data found for user ${userId}. Available keys: ${Object.keys(userPhoto || {}).join(', ')}`);
          res.json({ analysis: null });
        }
      } catch (error) {
        this.logger.error(`Error reading analysis results: ${error}`);
        res.status(500).json({ error: 'Failed to read analysis results' });
      }
    });

    // Person image endpoint
    app.get('/api/person-image/:imageName', (req: any, res: any) => {
      try {
        const imageName = req.params.imageName;
        const imagePath = path.join(process.cwd(), 'src', 'face_recognition', 'images', 'db_images', imageName);
        
        if (!fs.existsSync(imagePath)) {
          return res.status(404).json({ error: 'Image not found' });
        }
        
        res.set({
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'no-cache'
        });
        res.sendFile(imagePath);
      } catch (error) {
        this.logger.error(`Error serving person image: ${error}`);
        res.status(500).json({ error: 'Failed to serve person image' });
      }
    });

    // Serve icons as static files
    app.use('/icons', require('express').static(path.join(process.cwd(), 'icons')));
    
    // Icons endpoint (fallback)
    app.get('/icons/:iconName', (req: any, res: any) => {
      try {
        const iconName = req.params.iconName;
        const iconPath = path.join(process.cwd(), 'icons', iconName);
        
        this.logger.info(`Icons endpoint called for: ${iconName}, path: ${iconPath}`);
        
        if (!fs.existsSync(iconPath)) {
          this.logger.error(`Icon not found: ${iconPath}`);
          return res.status(404).json({ error: 'Icon not found' });
        }
        
        // Determine content type based on file extension
        const ext = path.extname(iconName).toLowerCase();
        let contentType = 'image/png';
        if (ext === '.jpg' || ext === '.jpeg') {
          contentType = 'image/jpeg';
        } else if (ext === '.gif') {
          contentType = 'image/gif';
        } else if (ext === '.svg') {
          contentType = 'image/svg+xml';
        }
        
        this.logger.info(`Serving icon: ${iconName} with content type: ${contentType}`);
        
        res.set({
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400' // Cache for 24 hours
        });
        res.sendFile(iconPath);
      } catch (error) {
        this.logger.error(`Error serving icon: ${error}`);
        res.status(500).json({ error: 'Failed to serve icon' });
      }
    });

    // Test endpoint for social links
    app.get('/api/test-social-links', (req: any, res: any) => {
      const userId = (req as AuthenticatedRequest).authUserId;

      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      try {
        // Read metadata to get latest analysis
        if (!fs.existsSync(METADATA_FILE)) {
          res.json({ social_links: null });
          return;
        }

        const metadataContent = fs.readFileSync(METADATA_FILE, 'utf8');
        const metadata = JSON.parse(metadataContent);
        
        const userPhoto = metadata[userId];
        if (userPhoto && userPhoto.analysis_result) {
          let analysisJson;
          if (typeof userPhoto.analysis_result.data === 'string') {
            analysisJson = JSON.parse(userPhoto.analysis_result.data);
          } else {
            analysisJson = userPhoto.analysis_result.data;
          }
          
          const socialLinks = this.extractSocialLinks(analysisJson, userPhoto.search_result);
          
          res.json({ 
            social_links: socialLinks,
            analysis_data: analysisJson,
            search_result: userPhoto.search_result
          });
        } else {
          res.json({ social_links: null });
        }
      } catch (error) {
        this.logger.error(`Error testing social links: ${error}`);
        res.status(500).json({ error: 'Failed to test social links' });
      }
    });

    // Test endpoint for icons
    app.get('/api/test-icons', (req: any, res: any) => {
      try {
        const iconsDir = path.join(process.cwd(), 'icons');
        const files = fs.readdirSync(iconsDir);
        
        res.json({
          icons_directory: iconsDir,
          available_icons: files,
          github_exists: fs.existsSync(path.join(iconsDir, 'github.png')),
          linkedin_exists: fs.existsSync(path.join(iconsDir, 'linkedin.png'))
        });
      } catch (error) {
        this.logger.error(`Error testing icons: ${error}`);
        res.status(500).json({ error: 'Failed to test icons' });
      }
    });

    // Voice recording API endpoints
    app.get('/api/voice-status', (req: any, res: any) => {
      const userId = (req as AuthenticatedRequest).authUserId;

      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      try {
        const status = this.getVoiceRecordingStatus(userId);
        res.json(status);
      } catch (error) {
        this.logger.error(`Error getting voice status: ${error}`);
        res.status(500).json({ error: 'Failed to get voice status' });
      }
    });

    app.post('/api/start-voice-recording', async (req: any, res: any) => {
      const userId = (req as AuthenticatedRequest).authUserId;

      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      try {
        if (this.isRecordingVoice.get(userId)) {
          return res.json({ 
            success: false, 
            error: 'Voice recording already in progress' 
          });
        }

        // Start voice recording
        await this.startVoiceRecording(userId, {});
        
        res.json({ 
          success: true, 
          message: 'Voice recording started - speak now! Recording will stop after 5 seconds of silence.' 
        });
      } catch (error) {
        this.logger.error(`Error starting voice recording: ${error}`);
        res.status(500).json({ error: 'Failed to start voice recording' });
      }
    });

    app.get('/api/voice-results', (req: any, res: any) => {
      const userId = (req as AuthenticatedRequest).authUserId;

      if (!userId) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      try {
        const result = this.voiceRecordingResults.get(userId);
        if (result) {
          res.json({ 
            success: true, 
            result: result 
          });
        } else {
          res.json({ 
            success: false, 
            message: 'No voice recording results available' 
          });
        }
      } catch (error) {
        this.logger.error(`Error getting voice results: ${error}`);
        res.status(500).json({ error: 'Failed to get voice results' });
      }
    });
  }
}



// Start the server
// DEV CONSOLE URL: https://console.mentra.glass/
// Get your webhook URL from ngrok (or whatever public URL you have)
const app = new ExampleMentraOSApp();

app.start().catch(console.error);