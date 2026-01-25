import * as FileSystem from 'expo-file-system/legacy';

const AUDIO_DIR = `${FileSystem.documentDirectory}audio`;

export const saveImageToFileSystem = async (imageUri: string): Promise<string> => {
  try {
    // Create a unique filename using timestamp
    const filename = `artwork_${Date.now()}.jpg`;
    const fileUri = `${FileSystem.documentDirectory}images/${filename}`;
    
    // Ensure the images directory exists
    await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory}images`, { intermediates: true });
    
    // Copy the image to the app's document directory
    await FileSystem.copyAsync({
      from: imageUri,
      to: fileUri
    });
    
    return fileUri;
  } catch (error) {
    console.error('Error saving image:', error);
    throw error;
  }
};

export const deleteImageFromFileSystem = async (fileUri: string): Promise<void> => {
  try {
    await FileSystem.deleteAsync(fileUri);
  } catch (error) {
    console.error('Error deleting image:', error);
    throw error;
  }
};

export const saveAudioToFileSystem = async (audioUrl: string): Promise<string> => {
  try {
    // Create a unique filename using timestamp
    const filename = `audio_${Date.now()}.mp3`;
    const fileUri = `${AUDIO_DIR}/${filename}`;
    
    // Ensure the audio directory exists
    await FileSystem.makeDirectoryAsync(AUDIO_DIR, { intermediates: true });
    
    // Download the audio file to the app's document directory
    const downloadResult = await FileSystem.downloadAsync(audioUrl, fileUri);
    
    return downloadResult.uri;
  } catch (error) {
    console.error('Error saving audio:', error);
    throw error;
  }
};

export const getAudioCachePath = (cacheKey: string): string => {
  return `${AUDIO_DIR}/tts_${cacheKey}.mp3`;
};

export const getCachedAudioUri = async (cacheKey: string): Promise<string | null> => {
  try {
    const fileUri = getAudioCachePath(cacheKey);
    await FileSystem.makeDirectoryAsync(AUDIO_DIR, { intermediates: true });
    const info = await FileSystem.getInfoAsync(fileUri);
    return info.exists ? fileUri : null;
  } catch (error) {
    console.error('Error checking cached audio:', error);
    return null;
  }
};

export const saveAudioToCache = async (audioUrl: string, cacheKey: string): Promise<string> => {
  try {
    const fileUri = getAudioCachePath(cacheKey);
    await FileSystem.makeDirectoryAsync(AUDIO_DIR, { intermediates: true });
    const downloadResult = await FileSystem.downloadAsync(audioUrl, fileUri);
    return downloadResult.uri;
  } catch (error) {
    console.error('Error saving cached audio:', error);
    throw error;
  }
};

export const deleteAudioFromFileSystem = async (fileUri: string): Promise<void> => {
  try {
    await FileSystem.deleteAsync(fileUri);
  } catch (error) {
    console.error('Error deleting audio:', error);
    throw error;
  }
}; 
