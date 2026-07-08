import { GoogleGenAI, Type } from "@google/genai";

// Initialize Gemini
// NOTE: API Key must be provided in the environment variable process.env.API_KEY
// The user of this code must ensure the key is valid.

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const parseAddressWithGemini = async (rawText: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Parse the following unstructured address text into a structured JSON object. 
      Text: "${rawText}"
      
      Extract: Name, Company (if available), Street1, Street2 (if available), City, State, Zip, Country, Phone, Email.
      If a field is missing, leave it as an empty string.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            company: { type: Type.STRING },
            street1: { type: Type.STRING },
            street2: { type: Type.STRING },
            city: { type: Type.STRING },
            state: { type: Type.STRING },
            zip: { type: Type.STRING },
            country: { type: Type.STRING },
            phone: { type: Type.STRING },
            email: { type: Type.STRING },
          },
          required: ["name", "street1", "city", "state", "zip"],
        },
      },
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    console.error("Gemini Parsing Error:", error);
    throw new Error("Failed to parse address with AI");
  }
};
