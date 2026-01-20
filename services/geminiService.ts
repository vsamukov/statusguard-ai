
import { GoogleGenAI } from "@google/genai";

// Always use named parameter for apiKey and get it from process.env.API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const geminiService = {
  /**
   * Generates a professional public incident summary from internal notes.
   */
  async generateIncidentSummary(title: string, internalDescription: string) {
    // Basic Text Tasks use gemini-3-flash-preview
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `You are a professional Site Reliability Engineer communicating with customers. 
      Convert the following internal incident report into a concise, reassuring, and professional public status update.
      
      Internal Headline: ${title}
      Internal Notes: ${internalDescription}
      
      Response requirements:
      - Be brief (max 3 sentences).
      - Maintain a calm and professional tone.
      - Do not include internal technical details unless relevant to the user impact.
      - Output ONLY the generated text.`,
    });

    return response.text;
  },

  /**
   * Analyzes platform health data to provide an executive summary.
   */
  async getHealthAnalysis(healthData: any) {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze the following platform health metrics and provide a one-sentence executive summary:
      ${JSON.stringify(healthData)}`,
    });

    return response.text;
  }
};
