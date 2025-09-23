export interface VoiceCommand {
  action: string;
  parameters: {
    url?: string;
    query?: string;
    selector?: string;
    text?: string;
    direction?: "up" | "down" ;
    index?: number; // Add index parameter for numbered selections
  };
  response: string;
}

export interface ChromeMessage {
  action: string;
  command?: string;
  parameters?: VoiceCommand["parameters"];
}

export interface RecognitionResult {
  transcript: string;
  confidence: number;
  isFinal: boolean;
}

export type RecordingState = "idle" | "recording" | "processing";
