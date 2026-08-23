import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY_ACCESS = 'oria_access_token';
const KEY_REFRESH = 'oria_refresh_token';
const KEY_EXPIRY = 'oria_token_expiry';

// Fallback for web where SecureStore is not available
// Uses sessionStorage (cleared on tab close) instead of plain JS object
const hasSessionStorage = Platform.OS === 'web' && typeof sessionStorage !== 'undefined';

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return hasSessionStorage ? sessionStorage.getItem(key) : null;
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') { if (hasSessionStorage) sessionStorage.setItem(key, value); return; }
  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') { if (hasSessionStorage) sessionStorage.removeItem(key); return; }
  await SecureStore.deleteItemAsync(key);
}

export async function getAccessToken(): Promise<string | null> {
  return getItem(KEY_ACCESS);
}

export async function getRefreshToken(): Promise<string | null> {
  return getItem(KEY_REFRESH);
}

export async function getTokenExpiry(): Promise<number | null> {
  const v = await getItem(KEY_EXPIRY);
  return v ? Number(v) : null;
}

export async function saveTokens(access: string, refresh: string, expiresAt: number) {
  await setItem(KEY_ACCESS, access);
  await setItem(KEY_REFRESH, refresh);
  await setItem(KEY_EXPIRY, String(expiresAt));
}

export async function clearTokens() {
  await deleteItem(KEY_ACCESS);
  await deleteItem(KEY_REFRESH);
  await deleteItem(KEY_EXPIRY);
}
