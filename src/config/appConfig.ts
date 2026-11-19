/**
 * Centralized domain, URL, and Capacitor API configuration for TITAN.
 */

export const APP_DOMAIN = 'titan.luluapp.com';
export const LEGACY_DOMAIN = 'titan.lalo-app.com';

const DEFAULT_APP_URL = `https://${APP_DOMAIN}`;

export const APP_CONFIG = {
  domain: APP_DOMAIN,
  legacyDomain: LEGACY_DOMAIN,
  appUrl: (import.meta.env.VITE_APP_URL as string | undefined)?.replace(/\/+$/, '') || DEFAULT_APP_URL,
  apiUrl: (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '') || DEFAULT_APP_URL,
  googleClientId: (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() || '',
} as const;

interface CapacitorWindow extends Window {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    getPlatform?: () => string;
  };
}

/**
 * Returns true when running inside a native Capacitor WebView (Android/iOS APK).
 */
export function isCapacitorNative(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as CapacitorWindow;
  if (win.Capacitor?.isNativePlatform?.()) return true;
  return window.location.protocol === 'capacitor:';
}

/**
 * Resolves the API origin safely:
 * - Same-origin relative path ('') on web https://titan.luluapp.com (keeps cookies first-party).
 * - Explicit HTTPS origin (https://titan.luluapp.com) inside native Capacitor APK (avoids Mixed Content).
 */
export function getApiBaseUrl(): string {
  if (isCapacitorNative()) {
    return APP_CONFIG.apiUrl;
  }
  return '';
}

/**
 * Builds a full API endpoint URL for fetch requests from web PWA or Android APK.
 */
export function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}
