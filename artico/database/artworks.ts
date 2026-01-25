import db, { initDatabase } from './database';
import { deleteImageFromFileSystem } from '../utils/fileSystem';

export interface Artwork {
  id: string;
  type: 'artwork';
  museum_name: string;
  title: string;
  artist: string;
  image_uri?: string;
  description?: string;
  created_at: number;
  audio_url?: string;
  session_id?: string;
  liked?: boolean;
}

export const addArtwork = async (artwork: Omit<Artwork, 'id' | 'type' | 'created_at'>): Promise<Artwork> => {
  await initDatabase();
  const id = `artwork_${Date.now()}`;
  const created_at = Date.now();
  
  await db.runAsync(
    'INSERT INTO artworks (id, type, museum_name, title, artist, image_uri, description, created_at, audio_url, session_id, liked) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      id,
      'artwork',
      artwork.museum_name,
      artwork.title,
      artwork.artist,
      artwork.image_uri || null,
      artwork.description || null,
      created_at,
      artwork.audio_url || null,
      artwork.session_id || null,
      artwork.liked || false
    ]
  );

  return {
    id,
    type: 'artwork',
    ...artwork,
    created_at
  };
};

export const getArtwork = async (artworkId: string): Promise<Artwork | null> => {
  await initDatabase();
  const result = await db.getFirstAsync<Artwork>(
    'SELECT * FROM artworks WHERE id = ?',
    [artworkId]
  );
  return result || null;
};

export const getArtworksByMuseum = async (museumName: string): Promise<Artwork[]> => {
  await initDatabase();
  return await db.getAllAsync<Artwork>(
    'SELECT * FROM artworks WHERE museum_name = ? ORDER BY created_at DESC',
    [museumName]
  );
};

export const updateArtwork = async (artwork: Artwork): Promise<Artwork> => {
  await initDatabase();
  await db.runAsync(
    'UPDATE artworks SET museum_name = ?, title = ?, artist = ?, image_uri = ?, description = ?, audio_url = ?, session_id = ?, liked = ? WHERE id = ?',
    [
      artwork.museum_name,
      artwork.title,
      artwork.artist,
      artwork.image_uri || null,
      artwork.description || null,
      artwork.audio_url || null,
      artwork.session_id || null,
      artwork.liked || false,
      artwork.id
    ]
  );
  return artwork;
};

export const deleteArtwork = async (artworkId: string): Promise<void> => {
  try {
    await initDatabase();
    // Get the artwork first to get the image URI
    const artwork = await getArtwork(artworkId);
    if (!artwork) {
      throw new Error('Artwork not found');
    }

    // Delete associated messages
    await db.runAsync(
      'DELETE FROM messages WHERE artwork_id = ?',
      [artworkId]
    );

    // Delete the image file if it exists
    if (artwork.image_uri) {
      await deleteImageFromFileSystem(artwork.image_uri);
    }
    
    // Delete the artwork from the database
    await db.runAsync(
      'DELETE FROM artworks WHERE id = ?',
      [artworkId]
    );
  } catch (error) {
    console.error('Error deleting artwork:', error);
    throw error;
  }
};

export const getAllArtworks = async (): Promise<Artwork[]> => {
  await initDatabase();
  return await db.getAllAsync<Artwork>(
    'SELECT * FROM artworks ORDER BY created_at DESC'
  );
};

export const toggleArtworkLike = async (artworkId: string): Promise<Artwork> => {
  await initDatabase();
  const artwork = await getArtwork(artworkId);
  if (!artwork) {
    throw new Error('Artwork not found');
  }
  
  const updatedArtwork = {
    ...artwork,
    liked: !artwork.liked
  };
  
  return await updateArtwork(updatedArtwork);
}; 
