// The real store: Android keystore via expo-secure-store.
//
// Three things to know about it. It cannot list keys, so the index is kept by hand. It is wiped
// when the app is uninstalled — the season secret is random and local since 21.09.2026 (Seed
// Vault cannot sign messages), so the only way back is the backup code the player copies out
// (app/src/core/secret.ts). And `keychainAccessible` is an iOS option: on Android the values sit
// in SharedPreferences, encrypted with a key in the Android keystore, and are kept out of cloud
// backup and device transfer by expo-secure-store's own backup rules plus `allowBackup: false`
// in app.json.
import * as SecureStore from "expo-secure-store";
import type { Store } from "../core/store.ts";

const INDEX = "observed__keys";
/** SecureStore keys may only contain letters, digits, ".", "-" and "_". */
const encode = (key: string) => `observed_${key.replace(/[^A-Za-z0-9._-]/g, "_")}`;

export class SecureStoreAdapter implements Store {
  async get(key: string) {
    return SecureStore.getItemAsync(encode(key));
  }

  async set(key: string, value: string) {
    await SecureStore.setItemAsync(encode(key), value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    const keys = await this.keys();
    if (!keys.includes(key)) await this.writeIndex([...keys, key]);
  }

  async delete(key: string) {
    await SecureStore.deleteItemAsync(encode(key));
    await this.writeIndex((await this.keys()).filter((k) => k !== key));
  }

  async keys() {
    const raw = await SecureStore.getItemAsync(INDEX);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as string[];
    } catch {
      return [];
    }
  }

  private writeIndex(keys: string[]) {
    return SecureStore.setItemAsync(INDEX, JSON.stringify(keys), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }
}
