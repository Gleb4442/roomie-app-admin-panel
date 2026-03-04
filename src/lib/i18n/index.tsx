'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { en } from './en';
import { ru } from './ru';
import { uk } from './uk';

export type Lang = 'en' | 'ru' | 'uk';
// Use a loose type so ru/uk can have different literal strings than en
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Translations = Record<string, any>;

const TRANSLATIONS: Record<Lang, Translations> = { en, ru, uk };

interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'en',
  setLang: () => {},
  t: (k) => k,
});

function getByPath(obj: any, path: string): string {
  const keys = path.split('.');
  let cur = obj;
  for (const k of keys) {
    if (cur == null) return path;
    cur = cur[k];
  }
  return typeof cur === 'string' ? cur : path;
}

function interpolate(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    const saved = localStorage.getItem('hm_lang') as Lang | null;
    if (saved && ['en', 'ru', 'uk'].includes(saved)) setLangState(saved);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem('hm_lang', l);
  };

  const t = (key: string, vars?: Record<string, string | number>) => {
    const raw = getByPath(TRANSLATIONS[lang], key) || getByPath(TRANSLATIONS.en, key) || key;
    return interpolate(raw, vars);
  };

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
