import Constants from 'expo-constants';
import { Platform } from 'react-native';

const DEFAULT_BACKEND_URL = 'http://localhost:8000';
const ENV_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

function getExpoHostFromManifest(): string | null {
  const manifest: any = Constants.manifest || (Constants as any).manifest2;
  if (!manifest) {
    return null;
  }

  const debuggerHost = manifest.debuggerHost || manifest.hostUri || manifest.extra?.expoClient?.hostUri;
  if (typeof debuggerHost === 'string' && debuggerHost.includes(':')) {
    return debuggerHost.split(':')[0];
  }

  return null;
}

function getMobileBackendUrl(): string | null {
  if (Platform.OS === 'web') {
    return null;
  }

  const host = getExpoHostFromManifest();
  if (!host || host === 'localhost' || host === '127.0.0.1') {
    return null;
  }

  return `http://${host}:8000`;
}

export const API_URL = ENV_BACKEND_URL || getMobileBackendUrl() || DEFAULT_BACKEND_URL;
