import { GoogleGenAI, Type, Modality } from "@google/genai";

const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API Key is missing! If you are running this as a local or Android app, you must provide your own API key in a .env file (GEMINI_API_KEY=your_key). Get one at aistudio.google.com.");
  }
  return new GoogleGenAI({ apiKey });
};

export interface GeneratedStory {
  title: string;
  content: string;
}

export async function generateStory(theme: string, character: string, language: string): Promise<GeneratedStory> {
  const ai = getAI();
  const prompt = `Please generate kids friendly bedtime story based on following:
  Theme: ${theme}. 
  Main Character: ${character}. 
  Language: ${language}. 
  Length: 200-300 words. 
  The story should be gentle, whimsical, and perfect for bedtime.
  Format the response as JSON with 'title' and 'content' fields.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "The title of the story." },
            content: { type: Type.STRING, description: "The text content of the story." },
          },
          required: ["title", "content"],
        },
      },
    });

    const text = response.text;
    if (!text) throw new Error("Failed to generate story text.");
    return JSON.parse(text);
  } catch (err: any) {
    console.error('Gemini Story Error:', err);
    throw err;
  }
}

export async function checkSafety(content: string): Promise<{ isSafe: boolean, reason?: string }> {
  const ai = getAI();
  const prompt = `Analyze the following content for a children's bedtime story app. 
  Check if it contains inappropriate content for kids, such as sex, extreme violence, hate speech, or explicit language.
  Content: "${content}"
  
  Respond ONLY with a JSON object: {"isSafe": boolean, "reason": "short explanation if unsafe"}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text;
    if (!text) return { isSafe: true };
    return JSON.parse(text);
  } catch (err) {
    console.error('Safety check error:', err);
    return { isSafe: true }; // Default to safe if check fails, story generation has its own safety filters
  }
}

export async function generateImage(character: string, theme: string, style: string = 'watercolor'): Promise<string> {
  const ai = getAI();
  
  const stylePrompts: Record<string, string> = {
    watercolor: "A gentle, whimsical watercolor and papercraft illustration for a children's book. Soft pastel colors, hand-drawn textures.",
    pixel_art: "Charming pixel art illustration for a children's book. Vibrant 8-bit colors, retro game aesthetic, friendly characters.",
    '3d_render': "High-quality 3D render in the style of a modern animated movie. Soft studio lighting, expressive characters, whimsical atmosphere.",
    oil_painting: "A rich oil painting illustration with visible brushstrokes and texture. Classic storybook feel, warm lighting.",
    sketch: "A beautiful pencil and charcoal sketch illustration. Detailed hand-drawn textures, artistic and soulful.",
    origami: "A diorama made of folded origami paper. Paper textures, handcrafted look, gentle shadows."
  };

  const styleBase = stylePrompts[style] || stylePrompts.watercolor;

  const prompt = `${styleBase} 
  The scene features a friendly character inspired by "${character}" in a magical world of "${theme}". 
  Happy and safe atmosphere, magical bedtime story aesthetic. 
  No text, no realistic faces, just pure artistic imagination.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            text: prompt,
          },
        ],
      },
    });

    console.log('Gemini Image Response:', response);

    const candidates = response.candidates;
    if (!candidates || candidates.length === 0 || !candidates[0].content || !candidates[0].content.parts) {
      const finishReason = candidates?.[0]?.finishReason;
      const safetyRatings = candidates?.[0]?.safetyRatings;
      console.error('Image Generation Failed. Finish Reason:', finishReason, 'Safety Ratings:', safetyRatings);
      
      let userMessage = "The AI painter was unable to create an image this time.";
      if (finishReason === 'PROHIBITED_CONTENT' || finishReason === 'SAFETY') {
        userMessage = "The AI painter couldn't draw this specific character or theme due to safety/copyright rules. Try using a more general description (like 'a brave lion' instead of a specific name)!";
      } else {
        userMessage += ` (Reason: ${finishReason || 'Unknown'}). Please try a different theme!`;
      }
      
      throw new Error(userMessage);
    }

    for (const part of candidates[0].content.parts) {
      if (part.inlineData) {
        const base64EncodeString: string = part.inlineData.data;
        return `data:image/png;base64,${base64EncodeString}`;
      }
    }
    throw new Error("No image data returned from Gemini.");
  } catch (err: any) {
    console.error('Gemini Image Error:', err);
    throw err;
  }
}

export async function generateNarration(text: string, voiceName: string = 'Kore'): Promise<string> {
  const ai = getAI();
  // Clean text for TTS (remove markdown symbols and extra whitespace)
  const cleanText = text.replace(/[*#_]/g, '').trim();
  
  let lastError: any = null;
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: cleanText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName },
            },
          },
        },
      });

      const candidates = response.candidates;
      if (!candidates || candidates.length === 0 || !candidates[0].content || !candidates[0].content.parts) {
        throw new Error("The storyteller's voice was lost in the stars. Please try again!");
      }

      const base64Audio = candidates[0].content.parts[0]?.inlineData?.data;
      if (!base64Audio) throw new Error("Failed to generate narration audio.");
      
      // Check if it already has a RIFF header (starts with 'UklGR' in base64)
      if (base64Audio.startsWith('UklGR')) {
        return `data:audio/wav;base64,${base64Audio}`;
      }

      // Convert raw PCM to WAV with header
      const pcmData = base64ToUint8Array(base64Audio);
      const wavHeader = createWavHeader(pcmData.length, 24000);
      const wavData = new Uint8Array(wavHeader.length + pcmData.length);
      wavData.set(wavHeader);
      wavData.set(pcmData, wavHeader.length);

      const finalBase64 = uint8ArrayToBase64(wavData);
      return `data:audio/wav;base64,${finalBase64}`;
    } catch (err: any) {
      lastError = err;
      console.warn(`Narration attempt ${attempt + 1} failed:`, err);
      
      // If it's a 500 error, wait a bit before retrying
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        continue;
      }
    }
  }

  // If we get here, all retries failed
  let errorMessage = "The storyteller is resting their voice right now. Please try again in a moment!";
  try {
    // Try to extract a cleaner message if it's a JSON error
    const parsed = typeof lastError?.message === 'string' ? JSON.parse(lastError.message) : lastError;
    if (parsed?.error?.message) {
      errorMessage = `Storyteller Error: ${parsed.error.message}. Please try again!`;
    }
  } catch (e) {
    // Not JSON, use default or lastError.message
    if (lastError?.message) errorMessage = lastError.message;
  }

  throw new Error(errorMessage);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64(uint8: Uint8Array): string {
  let binary = '';
  const len = uint8.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  return btoa(binary);
}

function createWavHeader(dataLength: number, sampleRate: number): Uint8Array {
  const header = new ArrayBuffer(44);
  const view = new DataView(header);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  // File length
  view.setUint32(4, 36 + dataLength, true);
  // WAVE identifier
  writeString(view, 8, 'WAVE');
  // fmt chunk identifier
  writeString(view, 12, 'fmt ');
  // Format chunk length
  view.setUint32(16, 16, true);
  // Sample format (1 is PCM)
  view.setUint16(20, 1, true);
  // Channel count (1 is mono)
  view.setUint16(22, 1, true);
  // Sample rate
  view.setUint32(24, sampleRate, true);
  // Byte rate (sampleRate * channels * bitsPerSample / 8)
  view.setUint32(28, sampleRate * 2, true);
  // Block align (channels * bitsPerSample / 8)
  view.setUint16(32, 2, true);
  // Bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  writeString(view, 36, 'data');
  // Data chunk length
  view.setUint32(40, dataLength, true);

  return new Uint8Array(header);
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
