import * as fs from 'fs';
import * as path from 'path';
import { ConversationTranscriptProcessor, ConversationSegment, ConversationSession } from './ConversationTranscriptProcessor';

/**
 * Manages conversation recording and storage for face recognition sessions
 */
export class ConversationManager {
  private transcriptProcessor: ConversationTranscriptProcessor;
  private currentSession: ConversationSession | null = null;
  private isRecording: boolean = false;
  private sessionStartTime: number = 0;
  private storageDir: string;
  private sessionsFile: string;
  private logger: any;

  constructor(storageDir: string, logger: any) {
    this.storageDir = storageDir;
    this.sessionsFile = path.join(storageDir, 'conversations.json');
    this.logger = logger;
    this.transcriptProcessor = new ConversationTranscriptProcessor(30, 3, 50); // Store more segments for conversations
    
    // Ensure storage directory exists
    this.ensureStorageDirectory();
  }

  /**
   * Start recording a conversation session
   */
  public startConversation(sessionId: string, userId: string, recognizedPerson?: any): void {
    if (this.isRecording) {
      this.logger.warn('Conversation already in progress, stopping previous session');
      this.stopConversation();
    }

    this.sessionStartTime = Date.now();
    this.isRecording = true;
    
    this.currentSession = {
      sessionId,
      userId,
      recognizedPerson,
      startTime: new Date(),
      segments: []
    };

    this.transcriptProcessor.clear();
    this.logger.info(`Started conversation recording for session ${sessionId}, user ${userId}`);
  }

  /**
   * Stop recording the current conversation session
   */
  public stopConversation(): ConversationSession | null {
    if (!this.isRecording || !this.currentSession) {
      return null;
    }

    this.isRecording = false;
    this.currentSession.endTime = new Date();
    
    // Get all segments from the transcript processor
    this.currentSession.segments = this.transcriptProcessor.getConversationSegments();
    
    // Save the conversation
    this.saveConversation(this.currentSession);
    
    const completedSession = this.currentSession;
    this.currentSession = null;
    
    this.logger.info(`Stopped conversation recording. Duration: ${this.getSessionDuration()}ms, Segments: ${completedSession.segments.length}`);
    
    return completedSession;
  }

  /**
   * Process incoming transcription data
   */
  public handleTranscription(transcriptionData: any): void {
    if (!this.isRecording || !this.currentSession) {
      return;
    }

    const text = transcriptionData.text?.trim();
    if (!text) {
      return;
    }

    // Check for wake word to end conversation (only on final transcripts)
    if (transcriptionData.isFinal && this.checkForEndWakeWord(text)) {
      this.logger.info(`Wake word detected: "${text}" - ending conversation`);
      this.stopConversation();
      return;
    }

    // Process the text through the transcript processor
    this.transcriptProcessor.processString(text, transcriptionData.isFinal);

    // Create conversation segment
    const segment: ConversationSegment = {
      text,
      timestamp: new Date(),
      isFinal: transcriptionData.isFinal,
      confidence: transcriptionData.confidence,
      speaker: 'user' // For now, assume all speech is from the user
    };

    // Add to current session
    this.currentSession.segments.push(segment);
    
    // Also add to transcript processor for display purposes
    this.transcriptProcessor.addConversationSegment(segment);

    this.logger.debug(`Added conversation segment: "${text}" (final: ${transcriptionData.isFinal})`);
  }

  /**
   * Check if the transcribed text contains a wake word to end the conversation
   */
  private checkForEndWakeWord(text: string): boolean {
    const endPhrases = [
      'hey spark end conversation',
      'hey spark stop recording',
      'hey spark stop',
      'end conversation',
      'stop recording',
      'stop conversation',
      'spark end conversation',
      'spark stop recording',
      'spark stop',
      'conversation over',
      'recording over',
      'that\'s all',
      'we\'re done',
      'goodbye spark',
      'bye spark'
    ];
    
    const normalizedText = text.toLowerCase().trim();
    
    // Check for exact phrase matches
    for (const phrase of endPhrases) {
      if (normalizedText.includes(phrase)) {
        return true;
      }
    }
    
    // Check for partial matches with "spark" + end words
    const sparkEndWords = ['end', 'stop', 'done', 'over', 'bye', 'goodbye'];
    if (normalizedText.includes('spark')) {
      for (const endWord of sparkEndWords) {
        if (normalizedText.includes(endWord)) {
          return true;
        }
      }
    }
    
    return false;
  }

  /**
   * Get the current conversation display text
   */
  public getCurrentConversationDisplay(): string {
    return this.transcriptProcessor.getCombinedTranscriptHistory();
  }

  /**
   * Get conversation history for a specific person
   */
  public getConversationHistory(faceId: string, limit: number = 10): ConversationSession[] {
    try {
      if (!fs.existsSync(this.sessionsFile)) {
        return [];
      }

      const data = fs.readFileSync(this.sessionsFile, 'utf8');
      const allSessions: ConversationSession[] = JSON.parse(data);
      
      // Filter sessions by face_id and sort by start time (newest first)
      const personSessions = allSessions
        .filter(session => session.recognizedPerson?.face_id === faceId)
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
        .slice(0, limit);

      return personSessions;
    } catch (error) {
      this.logger.error(`Error reading conversation history: ${error}`);
      return [];
    }
  }

  /**
   * Get conversation history for a user
   */
  public getUserConversationHistory(userId: string, limit: number = 20): ConversationSession[] {
    try {
      if (!fs.existsSync(this.sessionsFile)) {
        return [];
      }

      const data = fs.readFileSync(this.sessionsFile, 'utf8');
      const allSessions: ConversationSession[] = JSON.parse(data);
      
      // Filter sessions by userId and sort by start time (newest first)
      const userSessions = allSessions
        .filter(session => session.userId === userId)
        .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
        .slice(0, limit);

      return userSessions;
    } catch (error) {
      this.logger.error(`Error reading user conversation history: ${error}`);
      return [];
    }
  }

  /**
   * Save conversation session to storage
   */
  private saveConversation(session: ConversationSession): void {
    try {
      let allSessions: ConversationSession[] = [];
      
      if (fs.existsSync(this.sessionsFile)) {
        const data = fs.readFileSync(this.sessionsFile, 'utf8');
        allSessions = JSON.parse(data);
      }

      allSessions.push(session);
      
      // Keep only the last 100 sessions to prevent file from growing too large
      if (allSessions.length > 100) {
        allSessions = allSessions.slice(-100);
      }

      fs.writeFileSync(this.sessionsFile, JSON.stringify(allSessions, null, 2));
      this.logger.info(`Saved conversation session ${session.sessionId} to storage`);
    } catch (error) {
      this.logger.error(`Error saving conversation: ${error}`);
    }
  }

  /**
   * Ensure storage directory exists
   */
  private ensureStorageDirectory(): void {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true });
        this.logger.info(`Created conversation storage directory: ${this.storageDir}`);
      }
    } catch (error) {
      this.logger.error(`Error creating storage directory: ${error}`);
    }
  }

  /**
   * Get the duration of the current session in milliseconds
   */
  private getSessionDuration(): number {
    return Date.now() - this.sessionStartTime;
  }

  /**
   * Check if currently recording
   */
  public isCurrentlyRecording(): boolean {
    return this.isRecording;
  }

  /**
   * Get current session info
   */
  public getCurrentSession(): ConversationSession | null {
    return this.currentSession;
  }

  /**
   * Generate a simple summary of the conversation
   */
  public generateConversationSummary(session: ConversationSession): string {
    const duration = session.endTime 
      ? Math.round((session.endTime.getTime() - session.startTime.getTime()) / 1000)
      : 0;
    
    const segmentCount = session.segments.length;
    const wordCount = session.segments.reduce((total, segment) => 
      total + segment.text.split(' ').length, 0);

    return `Conversation with ${session.recognizedPerson?.name || 'Unknown person'} - ${duration}s, ${segmentCount} segments, ${wordCount} words`;
  }
}