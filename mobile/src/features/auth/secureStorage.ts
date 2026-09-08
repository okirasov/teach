import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Обёртка над SecureStore. На web (только превью) SecureStore — пустой модуль,
 * поэтому используем localStorage; в нативных сборках — Keychain / Keystore.
 */
export interface KeyValueStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

const webStorage: KeyValueStorage = {
  async get(key) {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  async set(key, value) {
    globalThis.localStorage?.setItem(key, value);
  },
  async remove(key) {
    globalThis.localStorage?.removeItem(key);
  },
};

const nativeStorage: KeyValueStorage = {
  get: (key) => SecureStore.getItemAsync(key),
  set: (key, value) => SecureStore.setItemAsync(key, value),
  remove: (key) => SecureStore.deleteItemAsync(key),
};

export const secureStorage: KeyValueStorage = Platform.OS === 'web' ? webStorage : nativeStorage;
