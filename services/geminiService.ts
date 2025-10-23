import { GoogleGenAI, Type } from "@google/genai";
import { Subject, TranslationResult } from '../types';

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result.split(',')[1]);
      } else {
        reject(new Error("Failed to convert blob to base64"));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const PROMPTS = {
    Baby: {
        audio: `You are an expert baby sound analyst. Analyze the following baby audio (e.g., crying, cooing, babbling) and determine the most likely reason. The possible reasons are: Hungry, Tired, Diaper, Uncomfortable, Bored. If the audio is unclear, too short, or not a baby sound, classify it as Unknown. Respond with a single JSON object.`,
        video: `You are an expert baby analyst. Analyze the following image frames from a video of a baby. 1. Describe the baby's key actions and behaviors in Traditional Chinese (e.g., rubbing eyes, stretching, smiling, looking intently). 2. Based *only* on the visual cues, determine the baby's state. Choose from: Playful, Tired, Uncomfortable, Bored. If the state is happy, calm, sleeping, or unclear, choose "Unknown". Do not use "Hungry" or "Diaper" as these cannot be determined from images alone. 3. Provide a helpful suggestion for the parent in Traditional Chinese. Respond with a single JSON object.`,
        audioTypes: ['Hungry', 'Tired', 'Diaper', 'Uncomfortable', 'Bored', 'Unknown'],
        videoTypes: ['Playful', 'Tired', 'Uncomfortable', 'Bored', 'Unknown'],
    },
    Dog: {
        audio: `You are an expert dog vocalization analyst. Analyze the following dog audio (e.g., barking, whining, growling). Determine the most likely emotion or need. The possible reasons are: Happy, Playful, Anxious, Warning, Lonely. If the audio is unclear, too short, or not a dog sound, classify it as Unknown. Respond with a single JSON object.`,
        video: `You are a dog behavior expert. Analyze the image frames from a video of a dog. 1. Describe the dog's key body language in Traditional Chinese (e.g., tail wagging, ears forward, showing teeth, play bow). 2. Based *only* on the visual cues, determine the dog's most likely state. Choose from: Happy, Playful, Anxious, Warning. If the state is calm or unclear, choose "Unknown". 3. Provide a helpful suggestion for the owner in Traditional Chinese. Respond with a single JSON object.`,
        audioTypes: ['Happy', 'Playful', 'Anxious', 'Warning', 'Lonely', 'Unknown'],
        videoTypes: ['Happy', 'Playful', 'Anxious', 'Warning', 'Unknown'],
    },
    Cat: {
        audio: `You are an expert cat vocalization analyst. Analyze the following cat audio (e.g., meowing, purring, hissing). Determine the most likely meaning. The possible reasons are: Greeting, Hungry, Attention, Annoyed, Pain. If the audio is unclear, too short, or not a cat sound, classify it as Unknown. Respond with a single JSON object.`,
        video: `You are a cat behavior expert. Analyze the image frames from a video of a cat. 1. Describe the cat's key body language in Traditional Chinese (e.g., tail high, slow blinking, ears back, hissing). 2. Based *only* on the visual cues, determine the cat's most likely state. Choose from: Relaxed, Playful, Greeting, Attention, Annoyed. If the state is unclear, choose "Unknown". 3. Provide a helpful suggestion for the owner in Traditional Chinese. Respond with a single JSON object.`,
        audioTypes: ['Greeting', 'Hungry', 'Attention', 'Annoyed', 'Pain', 'Unknown'],
        videoTypes: ['Relaxed', 'Playful', 'Greeting', 'Attention', 'Annoyed', 'Unknown'],
    }
}

export async function translateAudio(audioBlob: Blob, subject: Subject): Promise<TranslationResult> {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const audioBase64 = await blobToBase64(audioBlob);
  const subjectPrompts = PROMPTS[subject];

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { text: subjectPrompts.audio },
          { inlineData: { mimeType: audioBlob.type, data: audioBase64 } }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            cryType: {
              type: Type.STRING,
              enum: subjectPrompts.audioTypes,
              description: "The most likely reason for the sound."
            },
            confidence: {
              type: Type.NUMBER,
              description: "Confidence score from 0 to 1 for the classification."
            },
            suggestion: {
              type: Type.STRING,
              description: "A short, one-sentence suggestion for the owner in Traditional Chinese."
            }
          },
          required: ["cryType", "confidence", "suggestion"]
        }
      }
    });

    const resultJson = JSON.parse(response.text);
    
    if (subjectPrompts.audioTypes.includes(resultJson.cryType as string)) {
        return resultJson as TranslationResult;
    } else {
        return {
            cryType: 'Unknown',
            confidence: 0.5,
            suggestion: "無法識別聲音，請再試一次。"
        };
    }
    
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return {
      cryType: 'Unknown',
      confidence: 0,
      suggestion: '分析時發生錯誤，請檢查網路連線後再試一次。',
    };
  }
}

export async function analyzeVideoFrames(imageBase64s: string[], subject: Subject): Promise<TranslationResult> {
  if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable is not set");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const subjectPrompts = PROMPTS[subject];

  const imageParts = imageBase64s.map(data => ({
    inlineData: { mimeType: 'image/jpeg', data }
  }));

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [{ text: subjectPrompts.video }, ...imageParts]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            cryType: {
              type: Type.STRING,
              enum: subjectPrompts.videoTypes,
              description: "The most likely reason for the state based on visual cues."
            },
            behavior: {
              type: Type.STRING,
              description: "A short description of the observed behavior in Traditional Chinese."
            },
            suggestion: {
              type: Type.STRING,
              description: "A short, one-sentence suggestion for the owner in Traditional Chinese."
            }
          },
          required: ["cryType", "behavior", "suggestion"]
        }
      }
    });

    const resultJson = JSON.parse(response.text);

    if (subjectPrompts.videoTypes.includes(resultJson.cryType as string)) {
      return { ...resultJson, confidence: 0.7 }; 
    } else {
      return {
        ...resultJson,
        cryType: 'Unknown',
        confidence: 0.7
      };
    }
  } catch (error) {
    console.error("Error calling Gemini API for video frames:", error);
    return {
      cryType: 'Unknown',
      confidence: 0,
      suggestion: '影片分析時發生錯誤，請檢查網路連線後再試一次。',
      behavior: '無法分析行為。'
    };
  }
}