import * as ImageManipulator from 'expo-image-manipulator';
import { API_BASE_URL } from '../utils/config';

export interface ArtworkInfo {
  title: string;
  artist: string;
  museum_name: string;
  description: string;
  audio_description_url?: string;
  session_id: string;
}

export const identifyArtwork = async (imageUri: string, language: string = 'en', role: string = 'adult'): Promise<ArtworkInfo> => {
  const useMock = false;
  
  if (useMock) {
    try {
      console.log(`Mock identifyArtwork called with imageUri: ${imageUri}, language: ${language}, role: ${role}`);
      await new Promise(resolve => setTimeout(resolve, 500));

      return {
        title: "The Starry Night",
        artist: "Vincent van Gogh",
        museum_name: "Museum of Modern Art (MoMA)",
        description: "An iconic painting of a swirling night sky over a small townAn iconic painting of a swirling night sky over a smallAn iconic painting of a swirling night sky over a small townAn iconic painting of a swirling night sky over a small town townAn iconic painting of a swirling night sky over a small town, expressing van Gogh's emotional turbulence.",
        audio_description_url: "https://rubico-generated-audio.s3.us-east-2.amazonaws.com/sessions/66488f17-f3cf-428f-88e7-f10f8f9d3390/1745307722.mp3?response-content-disposition=inline&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEEgaCXVzLWVhc3QtMiJHMEUCIQCVpsmOfui%2FuMZXS%2FtAnK9ZRLpR3m5x%2F%2F1zvyq9RulapwIgT97yO5BDQ%2FLj0Ke%2BT%2BawPbI78hMsKOWhv0X8Zz9GCGwqvgMI0f%2F%2F%2F%2F%2F%2F%2F%2F%2FARAAGgwxMTcwODUxODQ5ODEiDEGVOsQRfl4E%2F%2BBWrSqSA%2FLcVJkhrSY4oGCJEBA%2ByML%2FcKI5S19cZuYF%2FaFu%2FTtlkrxmZa0fbhFm9X1wpHjgLMW4hGIOsJ7qfDK1HjGp%2FygzE2buH9rJCOUV5BwwMGGncOzLuIsa9b7ZE8ryTjaKJ7qlrFDfdKxs4wvIhaafkRfJezwJIs14NA9JaaRp4Y73X0gpdanzJYbPrTNV%2BRMBKbsKVk4ZZ3qooKzBkC1EAFDyP6uV5OapGlG5%2BN0f8z9qa6RBqAEL5Q1CLdoAZ%2BLk9z1FZ85j23V1C%2FPm%2F%2FWlNj9TiCCQlYlMYeuTsaFO2%2BjvJlEHmHoUfygsR2LC%2BfPyqRAL1tRFbxdEy5dzxtoZaBkd%2BtqB88%2BpaTfFGy52%2BFqFrxItJfOwkm9KYOhxG5wuEL2WOcOa5COs57rh1gYcA6HzuCU7uYCVOBZGT5gNHq1fAEvzz7UC12wx0GdiizPFQCphOE%2FZntF4bhg1wY%2B%2B7IUgPi1OrzwoKJmZRQUOEo8OlXYTyxxOCET%2B71BM26pfuCTca3AsdVnXchSdL6i5qYZIAzCg%2FpzABjreAlBBa%2FHKPmHEuN0rBwSmDb0Y3kK0h9lhTDNnwfoAesI4kbGeGmH0ulFGy99ve4uki5xG0XHl%2FKTVkzh%2BKo%2Fm3cz358J%2BUCD6WsUdXEtJ3NLb5afEkM2J58XZM6lxpLrpBSW1BaC1c4yu5OrZZHJd8PXeXlCFnRNrvZeGsJfjItm94XHXh5f8AkqbZZ3cpi5NqZz8XR4XBc0bCNaJJKW9xzwf1%2FqanzpQ6qFVF%2B1NrOAnrxhBTJKhgpdOV7DwDjSiha6V0A245qUa%2BYioTiFwXCiEs7ZboY%2FSE3pHZSMziN9XCi0UrIlzpe7XZ6k8oHVqg2V0WEVfN%2BzDCDIS4TYVXc13eufPafNBec8wivACc6XQKy0lzGbEJeKvmI%2FZHPB6yKKa%2FgJ9%2FwR%2BaMOvHum1%2FtR4TXVyQdBm8fyVUV9F7cX8v4EKmf2%2BKIyjKdkew1eeqmBGcWzpb9BKNpq2eFSP&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=ASIARWQWSEPK6ZT53BOW%2F20250422%2Fus-east-2%2Fs3%2Faws4_request&X-Amz-Date=20250422T075230Z&X-Amz-Expires=1800&X-Amz-SignedHeaders=host&X-Amz-Signature=5eff62ec7b0e285d90aa3c66c5a332e73e6877a463da743a566a57e4b8dca911",
        session_id: `session_${Date.now()}`
      };
    } catch (error) {
      console.error('Error identifying artwork (mock):', error);
      throw error;
    }
  }

  else {
    try {
      const compressed = await ImageManipulator.manipulateAsync(
        imageUri,
        [],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
      );

      const formData = new FormData();
      formData.append('image', {
        uri: compressed.uri,
        type: 'image/jpeg',
        name: 'artwork.jpg'
      } as any);

      formData.append('language', language);
      formData.append('role', role);

      const response = await fetch(`${API_BASE_URL}/api/recognize`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      return {
        title: data.title,
        artist: data.artist,
        museum_name: data.museum_name,
        description: data.description,
        audio_description_url: data.audio_description_url,
        session_id: data.session_id || `session_${Date.now()}`
      };
    } catch (error) {
      console.error('Error identifying artwork:', error);
      throw error;
    }
  }
};

