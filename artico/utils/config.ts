import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Allow overriding via env for physical devices or custom hosts
const envBase = process.env.EXPO_PUBLIC_API_URL;

// Try to derive host from the Expo dev server host (helpful on physical devices)
const hostUri = Constants.expoConfig?.hostUri || Constants.expoConfig?.hostUrl;
const derivedHost = hostUri ? hostUri.split(':')[0] : undefined;
const derivedBase = derivedHost ? `http://${derivedHost}:8000` : undefined;

const platformDefault = Platform.select({
  ios: 'http://localhost:8000',
  android: 'http://10.0.2.2:8000', // Android emulator loopback
  default: 'http://127.0.0.1:8000',
});

export const API_BASE_URL = (envBase || derivedBase || platformDefault || '').replace(/\/$/, '');
