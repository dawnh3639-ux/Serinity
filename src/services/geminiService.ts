import { GoogleGenAI, Type } from "@google/genai";
import { MoodAnalysis, MoodLog, SleepLog } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function generateSleepMoodInsights(moodLogs: MoodLog[], sleepLogs: SleepLog[]): Promise<string> {
  if (moodLogs.length === 0 || sleepLogs.length === 0) {
    return "Once you log some sleep and mood entries, I can help you find patterns and insights between your rest and your well-being.";
  }

  try {
    const dataSummary = {
      mood: moodLogs.slice(-7).map(m => ({ date: m.timestamp.split('T')[0], anxiety: m.anxietyLevel })),
      sleep: sleepLogs.slice(-7).map(s => ({ date: s.date, duration: s.duration, quality: s.quality }))
    };

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `As a compassionate wellness coach, analyze this user's data and provide a concise (max 3 sentences) insight into how their sleep might be affecting their anxiety levels.
      
      Data (last 7 entries): ${JSON.stringify(dataSummary)}`,
    });

    return response.text || "I'm still learning about your rhythms. Keep logging to help me understand better.";
  } catch (error) {
    console.error("Gemini insights failed:", error);
    return "I'm having trouble connecting to my knowledge base right now, but remember that rest is a key pillar of mental health.";
  }
}

export async function findSupportResources(location: string, type: 'support group' | 'professional'): Promise<{ title: string; link: string; description: string; lat?: number; lng?: number }[]> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Find high-quality, reputable local ${type}s near "${location}". 
      Return a JSON array of objects with "title", "link", "description", "lat" (latitude), and "lng" (longitude). 
      Focus on established organizations and verified local listings. 
      Use coordinates that are as accurate as possible for the map display.`,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              link: { type: Type.STRING },
              description: { type: Type.STRING },
              lat: { type: Type.NUMBER, description: "Latitude of the resource" },
              lng: { type: Type.NUMBER, description: "Longitude of the resource" }
            },
            required: ["title", "link", "description", "lat", "lng"]
          }
        }
      }
    });

    const text = response.text || "[]";
    return JSON.parse(text);
  } catch (error) {
    console.error("Gemini resource search failed:", error);
    return [];
  }
}

export async function analyzeMood(text: string): Promise<MoodAnalysis> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze the following text for signs of anxiety or being overwhelmed. Return a JSON object.
      
      User text: "${text}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            anxietyLevel: {
              type: Type.NUMBER,
              description: "Anxiety level from 0 (none) to 1 (extreme overwhelm)",
            },
            isOverwhelmed: {
              type: Type.BOOLEAN,
              description: "Whether the user sounds like they are currently in a crisis or extreme state",
            },
            message: {
              type: Type.STRING,
              description: "A very short, empathetic observation of their state (max 15 words)",
            },
            recommendedActivity: {
              type: Type.STRING,
              enum: ['breathing', 'grounding', 'journaling', 'listening', 'picture_journaling'],
              description: "The most appropriate activity for their current state",
            },
          },
          required: ["anxietyLevel", "isOverwhelmed", "message", "recommendedActivity"],
        },
      },
    });

    const result = JSON.parse(response.text || "{}");
    return result;
  } catch (error) {
    console.error("Gemini analysis failed:", error);
    return {
      anxietyLevel: 0.5,
      isOverwhelmed: false,
      message: "I'm here for you. How can we find some calm together?",
      recommendedActivity: 'breathing',
    };
  }
}

export async function generateDailyQuote(): Promise<{ quote: string; author: string }> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Generate a deeply calming and motivational quote for someone struggling with anxiety. Return a JSON object with 'quote' (the text) and 'author' (who said it, or 'Serenity' if original). Keep it short and impactful.",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            quote: { type: Type.STRING },
            author: { type: Type.STRING }
          },
          required: ["quote", "author"]
        }
      }
    });

    return JSON.parse(response.text || '{"quote": "Take a deep breath. You are doing enough.", "author": "Serenity"}');
  } catch (error) {
    console.error("Gemini quote generation failed:", error);
    return { quote: "Take a deep breath. You are doing enough.", author: "Serenity" };
  }
}

export async function getCalmingSuggestions() {
    // This could be expanded, but for now we'll use a static set or dynamic if needed.
}
