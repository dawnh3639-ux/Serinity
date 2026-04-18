export type ActivityType = 'breathing' | 'grounding' | 'journaling' | 'listening' | 'picture_journaling';

export interface PictureEntry {
  id: string;
  imageUrl: string;
  notes: string;
  createdAt: string;
}

export interface SleepLog {
  id: string;
  date: string; // YYYY-MM-DD
  duration: number; // hours
  quality: number; // 1-5
  notes?: string;
}

export interface MoodLog {
  id: string;
  timestamp: string;
  anxietyLevel: number;
  isOverwhelmed: boolean;
  text: string;
}

export interface MoodAnalysis {
  anxietyLevel: number; // 0 to 1
  isOverwhelmed: boolean;
  message: string;
  recommendedActivity: ActivityType;
}

export interface Reminder {
  id: string;
  time: string; // HH:mm
  days: number[]; // 0-6 (Sun-Sat)
  message: string;
  enabled: boolean;
  lastTriggered?: string; // ISO string to prevent double triggering same day
}
