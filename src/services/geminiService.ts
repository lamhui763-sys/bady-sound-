import { Subject, TranslationResult } from '../types';

// This helper is still needed on the frontend to convert the blob before sending
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

async function analyzeMedia(body: object): Promise<any> {
    const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error from server' }));
        console.error("Error from backend API:", errorData);
        throw new Error(errorData.error || 'Analysis failed');
    }

    return response.json();
}

export async function translateAudio(audioBlob: Blob, subject: Subject): Promise<TranslationResult> {
  try {
    const audioBase64 = await blobToBase64(audioBlob);
    const result = await analyzeMedia({
      subject,
      mediaType: 'audio',
      data: audioBase64,
      mimeType: audioBlob.type,
    });
    
    return result as TranslationResult;

  } catch (error) {
    console.error("Error in translateAudio:", error);
    return {
      cryType: 'Unknown',
      confidence: 0,
      suggestion: '分析時發生錯誤，請檢查網路連線後再試一次。',
    };
  }
}

export async function analyzeVideoFrames(imageBase64s: string[], subject: Subject): Promise<TranslationResult> {
  try {
    const result = await analyzeMedia({
      subject,
      mediaType: 'video',
      data: imageBase64s,
    });
    
    // The backend result doesn't have confidence for video, add it here as before.
    return { ...result, confidence: 0.7 } as TranslationResult;

  } catch (error) {
    console.error("Error in analyzeVideoFrames:", error);
    return {
      cryType: 'Unknown',
      confidence: 0,
      suggestion: '影片分析時發生錯誤，請檢查網路連線後再試一次。',
      behavior: '無法分析行為。'
    };
  }
}
