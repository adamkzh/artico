import { saveAudioToFileSystem } from '../utils/fileSystem';
import { API_BASE_URL } from '../utils/config';
import { hashString } from '../utils/hash';

export const getTtsStreamUrl = (text: string, voice: string = 'alloy') => {
  const encodedText = encodeURIComponent(text);
  const encodedVoice = encodeURIComponent(voice);
  return `${API_BASE_URL}/api/tts_stream?text=${encodedText}&voice=${encodedVoice}`;
};

export const getTtsCacheKey = (text: string, voice: string = 'alloy') => {
  return hashString(`${voice}:${text}`);
};

export const getCachedTtsUrl = async (cacheKey: string): Promise<string | null> => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/tts_cache?cache_key=${encodeURIComponent(cacheKey)}`);
    if (!response.ok) {
      return null;
    }
    const data = await response.json();
    return data.audio_url || null;
  } catch (error) {
    console.error('Error fetching cached TTS URL:', error);
    return null;
  }
};

export const cacheTtsAudio = async (
  text: string,
  voice: string = 'alloy',
  cacheKey?: string
): Promise<{ audio_url: string | null; cache_key: string }> => {
  const response = await fetch(`${API_BASE_URL}/api/tts_cache`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      voice,
      cache_key: cacheKey,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return await response.json();
};


interface PollAudioOptions {
  sessionId: string;
  onAudioReady: (localAudioUri: string) => void;
  onError?: (error: any) => void;
  timeoutMs?: number;
}

export const pollAudioUrl = ({
  sessionId,
  onAudioReady,
  onError,
  timeoutMs = 15 * 1000
}: PollAudioOptions) => {
  const startTime = Date.now();

  const poll = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/audio_url?session_id=${sessionId}`);
      const data = await response.json();

      if (data.audio_url) {
        const savedAudioUri = await saveAudioToFileSystem(data.audio_url);
        onAudioReady(savedAudioUri);
        return true;
      }

      if (Date.now() - startTime > timeoutMs) {
        onError?.(new Error('Audio polling timeout'));
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error polling audio URL:', error);
      onError?.(error);
      return false;
    }
  };

  const pollInterval = setInterval(async () => {
    const isDone = await poll();
    if (isDone) {
      clearInterval(pollInterval);
    }
  }, 5000);

  return () => clearInterval(pollInterval);
}; 
