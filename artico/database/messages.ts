import db, { initDatabase } from './database';

export interface Message {
  id: string;
  type: 'message';
  artwork_id: string;
  role: string;
  text: string;
  audio_path?: string;
  created_at: number;
}

export const addMessage = async (message: Omit<Message, 'id' | 'type' | 'created_at'>): Promise<Message> => {
  await initDatabase();
  const id = `message_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const created_at = Date.now();
  
  await db.runAsync(
    'INSERT INTO messages (id, type, artwork_id, role, text, audio_path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      id,
      'message',
      message.artwork_id,
      message.role,
      message.text,
      message.audio_path || null,
      created_at
    ]
  );

  return {
    id,
    type: 'message',
    ...message,
    created_at
  };
};

export const getMessagesByArtwork = async (artworkId: string): Promise<Message[]> => {
  await initDatabase();
  return await db.getAllAsync<Message>(
    'SELECT * FROM messages WHERE artwork_id = ? ORDER BY created_at ASC',
    [artworkId]
  );
}; 
