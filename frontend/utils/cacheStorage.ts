import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const WATCHLIST_CACHE_KEY = 'watchlist_cache';
const WATCHED_CACHE_KEY = 'watched_cache';

export async function cacheWatchlist(data: any[]): Promise<void> {
  try {
    const str = JSON.stringify(data);
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(WATCHLIST_CACHE_KEY, str);
      }
    } else {
      await AsyncStorage.setItem(WATCHLIST_CACHE_KEY, str);
    }
  } catch (e) {
    console.error('Error caching watchlist:', e);
  }
}

export async function getCachedWatchlist(): Promise<any[] | null> {
  try {
    const str = Platform.OS === 'web'
      ? (typeof window !== 'undefined' ? window.localStorage.getItem(WATCHLIST_CACHE_KEY) : null)
      : await AsyncStorage.getItem(WATCHLIST_CACHE_KEY);
    return str ? JSON.parse(str) : null;
  } catch (e) {
    console.error('Error reading watchlist cache:', e);
    return null;
  }
}

export async function cacheWatched(data: any[]): Promise<void> {
  try {
    const str = JSON.stringify(data);
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(WATCHED_CACHE_KEY, str);
      }
    } else {
      await AsyncStorage.setItem(WATCHED_CACHE_KEY, str);
    }
  } catch (e) {
    console.error('Error caching watched list:', e);
  }
}

export async function getCachedWatched(): Promise<any[] | null> {
  try {
    const str = Platform.OS === 'web'
      ? (typeof window !== 'undefined' ? window.localStorage.getItem(WATCHED_CACHE_KEY) : null)
      : await AsyncStorage.getItem(WATCHED_CACHE_KEY);
    return str ? JSON.parse(str) : null;
  } catch (e) {
    console.error('Error reading watched cache:', e);
    return null;
  }
}
