/**
 * Simplified TranscriptProcessor for conversation recording
 * Based on the original TranscriptProcessor but focused on conversation storage
 */
export class ConversationTranscriptProcessor {
  private maxCharsPerLine: number;
  private maxLines: number;
  private lines: string[];
  private partialText: string;
  private lastUserTranscript: string;
  private finalTranscriptHistory: string[]; // Array to store history of final transcripts
  private maxFinalTranscripts: number; // Max number of final transcripts to keep
  private currentDisplayLines: string[]; // Track current display lines to maintain consistency
  private conversationSegments: ConversationSegment[]; // Store conversation segments with metadata

  constructor(maxCharsPerLine: number = 30, maxLines: number = 3, maxFinalTranscripts: number = 10) {
    this.maxCharsPerLine = maxCharsPerLine;
    this.maxLines = maxLines;
    this.lastUserTranscript = "";
    this.lines = [];
    this.partialText = "";
    this.finalTranscriptHistory = [];
    this.maxFinalTranscripts = maxFinalTranscripts;
    this.currentDisplayLines = [];
    this.conversationSegments = [];
  }

  public processString(newText: string | null, isFinal: boolean): string {
    newText = (newText === null ? "" : newText.trim());

    if (!isFinal) {
      // Store this as the current partial text (overwriting old partial)
      this.partialText = newText;
      this.lastUserTranscript = newText;
      
      // Combine final history with new partial text
      const combinedText = this.getCombinedTranscriptHistory() + " " + newText;
      this.currentDisplayLines = this.wrapText(combinedText, this.maxCharsPerLine);
      
      // Ensure we have exactly maxLines
      while (this.currentDisplayLines.length < this.maxLines) {
        this.currentDisplayLines.push("");
      }
      while (this.currentDisplayLines.length > this.maxLines) {
        this.currentDisplayLines.shift();
      }
      
      return this.currentDisplayLines.join("\n");
    } else {
      // We have a final text -> clear out the partial text to avoid duplication
      this.partialText = "";

      // Add to transcript history when it's a final transcript
      this.addToTranscriptHistory(newText);

      // Use the same wrapping logic as partial to maintain consistency
      const combinedText = this.getCombinedTranscriptHistory();
      this.currentDisplayLines = this.wrapText(combinedText, this.maxCharsPerLine);
      
      // Ensure we have exactly maxLines
      while (this.currentDisplayLines.length < this.maxLines) {
        this.currentDisplayLines.push("");
      }
      while (this.currentDisplayLines.length > this.maxLines) {
        this.currentDisplayLines.shift();
      }
      
      return this.currentDisplayLines.join("\n");
    }
  }

  // Add to transcript history
  private addToTranscriptHistory(transcript: string): void {
    if (transcript.trim() === "") return; // Don't add empty transcripts
    
    this.finalTranscriptHistory.push(transcript);
    
    // Ensure we don't exceed maxFinalTranscripts
    while (this.finalTranscriptHistory.length > this.maxFinalTranscripts) {
      this.finalTranscriptHistory.shift(); // Remove oldest transcript
    }
  }

  // Add conversation segment with metadata
  public addConversationSegment(segment: ConversationSegment): void {
    this.conversationSegments.push(segment);
  }

  // Get the transcript history
  public getFinalTranscriptHistory(): string[] {
    return [...this.finalTranscriptHistory]; // Return a copy to prevent external modification
  }

  // Get conversation segments
  public getConversationSegments(): ConversationSegment[] {
    return [...this.conversationSegments];
  }

  // Get combined transcript history as a single string
  public getCombinedTranscriptHistory(): string {
    return this.finalTranscriptHistory.join(" ");
  }

  // Get full conversation text
  public getFullConversation(): string {
    return this.conversationSegments.map(segment => segment.text).join(" ");
  }

  // Method to set max final transcripts
  public setMaxFinalTranscripts(maxFinalTranscripts: number): void {
    this.maxFinalTranscripts = maxFinalTranscripts;
    // Trim history if needed after changing the limit
    while (this.finalTranscriptHistory.length > this.maxFinalTranscripts) {
      this.finalTranscriptHistory.shift();
    }
  }

  // Get max final transcripts
  public getMaxFinalTranscripts(): number {
    return this.maxFinalTranscripts;
  }

  private wrapText(text: string, maxLineLength: number): string[] {
    const result: string[] = [];
    while (text !== "") {
      if (text.length <= maxLineLength) {
        result.push(text);
        break;
      } else {
        let splitIndex = maxLineLength;
        
        // Find the last space before maxLineLength
        while (splitIndex > 0 && text.charAt(splitIndex) !== " ") {
          splitIndex--;
        }
        // If we didn't find a space, force split
        if (splitIndex === 0) {
          splitIndex = maxLineLength;
        }

        const chunk = text.substring(0, splitIndex).trim();
        result.push(chunk);
        text = text.substring(splitIndex).trim();
      }
    }
    return result;
  }

  public getTranscript(): string {
    // Create a copy of the lines for manipulation
    const allLines = [...this.lines];

    // Add padding to ensure exactly maxLines are displayed
    const linesToPad = this.maxLines - allLines.length;
    for (let i = 0; i < linesToPad; i++) {
      allLines.push(""); // Add empty lines at the end
    }

    const finalString = allLines.join("\n");

    // Clear the lines
    this.lines = [];
    return finalString;
  }

  public getLastUserTranscript(): string {
    return this.lastUserTranscript;
  }

  public clear(): void {
    this.lines = [];
    this.partialText = "";
    this.finalTranscriptHistory = [];
    this.conversationSegments = [];
  }

  public getMaxCharsPerLine(): number {
    return this.maxCharsPerLine;
  }

  public getMaxLines(): number {
    return this.maxLines;
  }
}

export interface ConversationSegment {
  text: string;
  timestamp: Date;
  isFinal: boolean;
  confidence?: number;
  speaker?: string;
}

export interface ConversationSession {
  sessionId: string;
  userId: string;
  recognizedPerson?: {
    name: string;
    confidence: number;
    face_id: string;
  };
  startTime: Date;
  endTime?: Date;
  segments: ConversationSegment[];
  location?: {
    city: string;
    state: string;
    country: string;
  };
  summary?: string;
}
