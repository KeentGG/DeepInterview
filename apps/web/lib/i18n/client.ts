"use client";

import { useEffect, useState } from "react";
import { getMessages, type Dictionary, type Locale } from "@/lib/i18n";

/**
 * Shared window event emitted after the `locale` cookie changes. Hooks listen
 * for it so client components re-render without a full page reload; server
 * components still update through `router.refresh()`.
 */
export const LOCALE_CHANGE_EVENT = "openinterview:locale-change";

type LocaleChangeDetail = { locale: Locale };

/**
 * Read the tracked `locale` cookie. Unset/unknown values fall back to EN.
 */
export function readLocaleCookie(): Locale {
  if (typeof document === "undefined") return "en";
  const match = document.cookie
    .split("; ")
    .find((c) => c.startsWith("locale="));
  return match?.split("=")[1] === "vi" ? "vi" : "en";
}

/** Notify mounted locale hooks that the cookie changed (no page reload). */
export function emitLocaleChange(locale: Locale): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<LocaleChangeDetail>(LOCALE_CHANGE_EVENT, {
      detail: { locale },
    }),
  );
}

/**
 * The active locale from the `locale` cookie. Starts at EN for a stable first
 * paint, then re-resolves after mount and on every `LOCALE_CHANGE_EVENT` (the
 * toggle writes the cookie and emits it) — hydration-safe without a reload.
 */
export function useLocale(): Locale {
  const [locale, setLocale] = useState<Locale>("en");
  useEffect(() => {
    const sync = () => setLocale(readLocaleCookie());
    sync();
    window.addEventListener(LOCALE_CHANGE_EVENT, sync);
    return () => window.removeEventListener(LOCALE_CHANGE_EVENT, sync);
  }, []);
  return locale;
}

/**
 * Messages for the active locale. `getMessages` keeps EN as the default pack
 * and swaps in `vi` once the cookie says so — without touching the server-side
 * registry. Shares `useLocale`'s cookie/event state, so `useMessages()` and
 * `useLocale()` always agree after a language switch.
 */
export function useMessages(): Dictionary {
  return getMessages(useLocale());
}
