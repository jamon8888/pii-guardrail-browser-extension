/**
 * i18n helper for Chrome extension internationalization.
 *
 * Supports runtime language switching via chrome.storage.
 * Loads _locales/<lang>/messages.json manually so the user
 * can override the browser default.
 */

import { writable, get, type Readable } from 'svelte/store';
import type { EntityType, NerModelKey } from './message-types';

// Message keys matching _locales/<lang>/messages.json
export type MessageKey = string;

// Supported languages
export type Locale = 'en' | 'fr';
export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'fr'];
export const DEFAULT_LOCALE: Locale = 'fr';

const STORAGE_KEY = 'pg_locale';

// In-memory cache of loaded message bundles keyed by locale.
const cache: Record<string, Record<string, string>> = {};

// Current language store — starts with browser default, overridden by storage.
export const currentLocale = writable<Locale>(DEFAULT_LOCALE);

// Load a locale's messages.json via fetch (works in extension context).
async function loadLocaleMessages(locale: Locale): Promise<Record<string, string>> {
  if (cache[locale]) return cache[locale];
  try {
    const url = chrome.runtime.getURL(`_locales/${locale}/messages.json`);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw: Record<string, { message: string; description?: string }> = await res.json();
    const flat: Record<string, string> = {};
    for (const [key, entry] of Object.entries(raw)) {
      flat[key] = entry.message;
    }
    cache[locale] = flat;
    return flat;
  } catch {
    // If loading fails, fall back to empty (t() returns the key itself).
    cache[locale] = {};
    return cache[locale];
  }
}

// Load default locale eagerly so t() works synchronously after init().
void loadLocaleMessages(DEFAULT_LOCALE);

// Initialize: read stored preference, load that locale.
export async function initI18n(): Promise<void> {
  let locale: Locale = DEFAULT_LOCALE;
  try {
    const stored = await chrome.storage.local.get(STORAGE_KEY);
    if (stored[STORAGE_KEY] && SUPPORTED_LOCALES.includes(stored[STORAGE_KEY])) {
      locale = stored[STORAGE_KEY];
    }
  } catch {
    // storage unavailable (tests, non-extension)
  }
  await loadLocaleMessages(locale);
  currentLocale.set(locale);
}

// Switch language and persist.
export async function setLanguage(locale: Locale): Promise<void> {
  await loadLocaleMessages(locale);
  currentLocale.set(locale);
  try {
    await chrome.storage.local.set({ [STORAGE_KEY]: locale });
  } catch {
    // storage unavailable
  }
}

// Resolve substitution placeholders {0}, {1}, … in a message string.
function applySubstitutions(message: string, substitutions: string[]): string {
  return message.replace(/\{(\d+)\}/g, (_, idx) => substitutions[Number(idx)] ?? `{${idx}}`);
}

// Retrieve a human-readable label for an entity type.
export function entityTypeLabel(type: EntityType): string {
  return t(`entityType_${type}`);
}

// Retrieve a human-readable label for an NER model key.
export function nerModelLabel(key: NerModelKey): string {
  return t(`nerModel_${key.replace(/-/g, '')}`);
}

// Retrieve a translated message by key.
//
// Uses the loaded message bundle. Falls back to chrome.i18n.getMessage()
// in case the bundle hasn't loaded yet, then to the raw key.
export function t(key: MessageKey, ...substitutions: string[]): string {
  const locale = get(currentLocale);
  const messages = cache[locale];
  if (messages?.[key] !== undefined) {
    return applySubstitutions(messages[key], substitutions);
  }
  // Fallback to Chrome built-in i18n (uses browser locale).
  if (typeof chrome !== 'undefined' && chrome.i18n?.getMessage) {
    const builtIn = chrome.i18n.getMessage(key, substitutions);
    if (builtIn) return builtIn;
  }
  // Last resort: return the key itself.
  return key;
}
