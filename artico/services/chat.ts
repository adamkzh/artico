import { API_BASE_URL } from '../utils/config';

interface ChatResponse {
  text: string;
}

interface Message {
  role: string;
  content: string;
}

interface FollowupRequest {
  user_input: string;
  artwork_name: string;
  artwork_artist: string;
  artwork_museum: string;
  message_history: Message[];
}

export const generateResponse = async (
  artworkName: string,
  artworkArtist: string,
  artworkMuseumName: string,
  message: string,
  messageHistory: Message[]
): Promise<ChatResponse> => {
  try {
    const requestBody: FollowupRequest = {
      user_input: message,
      artwork_name: artworkName,
      artwork_artist: artworkArtist,
      artwork_museum: artworkMuseumName,
      message_history: messageHistory
    };

    const response = await fetch(`${API_BASE_URL}/api/followup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return { text: data.reply };
  } catch (error) {
    console.error('Error generating chat response:', error);
    throw error;
  }
};
