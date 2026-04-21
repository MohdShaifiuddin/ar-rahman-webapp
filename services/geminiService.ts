import { GoogleGenAI, Modality, ThinkingLevel, Type } from "@google/genai";

// The GEMINI_API_KEY is provided by the environment
const apiKey = process.env.GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  image?: string; // base64
}

export const geminiService = {
  /**
   * General purpose chat with history
   */
  async chat(message: string, history: ChatMessage[] = [], imageBase64?: string) {
    const model = "gemini-3-flash-preview";
    const contents = history.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }]
    }));

    const currentParts: any[] = [{ text: message }];
    if (imageBase64) {
      currentParts.push({
        inlineData: {
          data: imageBase64.split(',')[1],
          mimeType: "image/jpeg"
        }
      });
    }

    contents.push({ role: 'user', parts: currentParts });

    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: "You are the Ar-Rahman Academy Learning Assistant. You help students with Arabic learning, Islamic studies, and academy-related questions. Be polite, encouraging, and informative.",
      }
    });

    return response.text;
  },

  /**
   * Complex task with high thinking level
   */
  async analyzeComplexQuery(query: string) {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: query,
      config: {
        thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
        systemInstruction: "You are an expert Islamic scholar and Arabic linguist. Provide deep, well-reasoned analysis for complex queries.",
      }
    });
    return response.text;
  },

  /**
   * Image analysis using Pro model
   */
  async analyzeImage(imageBase64: string, prompt: string = "Analyze this image in detail.") {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: {
        parts: [
          { text: prompt },
          {
            inlineData: {
              data: imageBase64.split(',')[1],
              mimeType: "image/jpeg"
            }
          }
        ]
      }
    });
    return response.text;
  },

  /**
   * Google Maps grounding for location-based queries
   */
  async findNearbyPlaces(query: string, latitude?: number, longitude?: number) {
    const config: any = {
      tools: [{ googleMaps: {} }],
    };

    if (latitude && longitude) {
      config.toolConfig = {
        retrievalConfig: {
          latLng: { latitude, longitude }
        }
      };
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: query,
      config
    });

    return {
      text: response.text,
      groundingChunks: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
    };
  }
};
