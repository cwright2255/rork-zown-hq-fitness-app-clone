import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { router } from 'expo-router';
import { useUserStore } from '@/store/userStore';

export type AdminAction =
  | { type: 'logout' }
  | { type: 'setOnboarded'; value: boolean }
  | { type: 'setFlag'; key: string; value: string }
  | { type: 'setLogoUrl'; url: string };

export interface AdminCommandResult {
  handled: boolean;
  message: string;
}

const ADMIN_CONFIG_KEY = 'zown-admin-config';
const ADMIN_LOGO_KEY = 'zown-admin-logo-url';

async function persistAdminConfig(update: Record<string, unknown>) {
  try {
    const existingRaw = await AsyncStorage.getItem(ADMIN_CONFIG_KEY);
    const existing = existingRaw ? JSON.parse(existingRaw) as Record<string, unknown> : {};
    const next = { ...existing, ...update };
    await AsyncStorage.setItem(ADMIN_CONFIG_KEY, JSON.stringify(next));
    return next;
  } catch (e) {
    console.error('[RemoteAdmin] Failed to persist admin config', e);
    throw e;
  }
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value == null) return undefined;
  const v = value.toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'no') return false;
  return undefined;
}

export async function processAdminLink(url: string): Promise<AdminCommandResult> {
  try {
    const parsed = Linking.parse(url);
    const pathPart = (parsed as any).host ?? parsed.path ?? '';
    if (!pathPart) {
      return { handled: false, message: 'Not an admin link' };
    }

    const path = String(pathPart).toLowerCase();
    const q = (parsed.queryParams || {}) as Record<string, string | undefined>;

    // Expect scheme: myapp://admin or myapp://remote-admin
    const isAdminPath = path.includes('admin');
    const cmd = (q.cmd || q.command || '').toLowerCase();

    if (!isAdminPath && cmd === '') {
      return { handled: false, message: 'Not an admin link' };
    }

    console.log('[RemoteAdmin] Admin link detected', { path, cmd, q });

    // Optional token gate — if provided we just log presence; project has no secure secret storage for tokens here.
    if (q.token) {
      console.log('[RemoteAdmin] Token provided');
    }

    // Map commands
    if (cmd === 'logout') {
      await useUserStore.getState().logout();
      try {
        router.replace('/');
      } catch (e) {
        console.warn('[RemoteAdmin] Router not ready to replace to /', e);
      }
      return { handled: true, message: 'User logged out' };
    }

    if (cmd === 'setonboarded') {
      const v = parseBoolean(q.value);
      if (typeof v === 'boolean') {
        if (v) {
          useUserStore.setState({ isOnboarded: true });
        } else {
          useUserStore.setState({ isOnboarded: false });
          try { router.replace('/'); } catch {}
        }
        await persistAdminConfig({ isOnboarded: v });
        return { handled: true, message: `isOnboarded set to ${v}` };
      }
      return { handled: false, message: 'Invalid value for setOnboarded' };
    }

    if (cmd === 'setflag') {
      const key = q.key;
      const value = q.value ?? '';
      if (!key) return { handled: false, message: 'Missing key for setFlag' };
      const saved = await persistAdminConfig({ [key]: value });
      console.log('[RemoteAdmin] Flag set', saved);
      return { handled: true, message: `Flag ${key} set` };
    }

    if (cmd === 'setlogourl') {
      const urlParam = q.url || q.value;
      if (!urlParam) return { handled: false, message: 'Missing url for setLogoUrl' };
      await AsyncStorage.setItem(ADMIN_LOGO_KEY, String(urlParam));
      await persistAdminConfig({ logoUrl: String(urlParam) });
      return { handled: true, message: 'Logo URL updated' };
    }

    // Friendly aliases by path style: myapp://admin/logout etc
    if (isAdminPath && !cmd) {
      const action = path.replace(/^\//, '').split('/')[1];
      if (action === 'logout') {
        await useUserStore.getState().logout();
        try { router.replace('/'); } catch {}
        return { handled: true, message: 'User logged out' };
      }
    }

    return { handled: false, message: 'Unknown admin command' };
  } catch (error) {
    console.error('[RemoteAdmin] Failed to process admin link', error);
    return { handled: false, message: 'Error processing admin link' };
  }
}

export async function getAdminLogoUrl(): Promise<string | null> {
  try {
    const val = await AsyncStorage.getItem(ADMIN_LOGO_KEY);
    return val;
  } catch (e) {
    console.error('[RemoteAdmin] Failed to read logo url', e);
    return null;
  }
}

export async function getAdminConfig(): Promise<Record<string, unknown>> {
  try {
    const raw = await AsyncStorage.getItem(ADMIN_CONFIG_KEY);
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch (e) {
    console.error('[RemoteAdmin] Failed to read admin config', e);
    return {};
  }
}
