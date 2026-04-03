import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import type { FaceMatchResult } from "@/src/types";

export type { FaceMatchResult };

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const gemini = {
  async compareFaces(referenceImageBase64: string, candidateImages: { id: string, base64: string }[]): Promise<FaceMatchResult[]> {
    if (candidateImages.length === 0) return [];

    const referencePart = {
      inlineData: {
        mimeType: "image/jpeg",
        data: referenceImageBase64.split(",")[1] || referenceImageBase64,
      },
    };

    const candidateParts = candidateImages.map((img, index) => ({
      text: `Candidate Image ${index + 1}:`,
      inlineData: {
        mimeType: "image/jpeg",
        data: img.base64.split(",")[1] || img.base64,
      },
    }));

    const prompt = `
      You are a facial recognition expert. 
      The first image provided is the REFERENCE image of a person.
      The subsequent images are CANDIDATE images.
      
      For each candidate image, determine if the person from the REFERENCE image is present.
      Respond ONLY with a JSON array of objects, one for each candidate image in order:
      [
        { "imageId": "id_from_input", "isMatch": true/false, "confidence": 0-1, "reasoning": "brief explanation" }
      ]
    `;

    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: {
          parts: [
            { text: prompt },
            referencePart,
            ...candidateParts.flatMap(p => [ { text: p.text }, { inlineData: p.inlineData } ])
          ]
        },
        config: {
          responseMimeType: "application/json",
        }
      });

      const text = response.text || "[]";
      const results = JSON.parse(text.trim());
      
      // Map back to original IDs
      return results.map((res: any, index: number) => ({
        ...res,
        imageId: candidateImages[index].id
      }));
    } catch (error) {
      console.error("Gemini Face Comparison Error:", error);
      return candidateImages.map(img => ({ imageId: img.id, isMatch: false, confidence: 0 }));
    }
  }
};
