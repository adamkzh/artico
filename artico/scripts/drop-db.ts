import * as FileSystem from 'expo-file-system/legacy';

async function dropDatabase() {
  try {
    const dbPath = `${FileSystem.documentDirectory}SQLite/artico.db`;
    console.log('Attempting to delete database at:', dbPath);
    
    const dbInfo = await FileSystem.getInfoAsync(dbPath);
    if (dbInfo.exists) {
      await FileSystem.deleteAsync(dbPath);
      console.log('Database deleted successfully');
    } else {
      console.log('Database file does not exist');
    }
  } catch (error) {
    console.error('Error deleting database:', error);
  }
}

dropDatabase(); 
