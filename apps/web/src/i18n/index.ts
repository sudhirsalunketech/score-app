import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import hi from './hi.json';
import mr from './mr.json';

export const locales = ['en', 'hi', 'mr'] as const;
export type Locale = (typeof locales)[number];

function readStoredLocale() {
  try {
    if (typeof localStorage === 'undefined' || typeof localStorage.getItem !== 'function') return null;
    return localStorage.getItem('cs.locale');
  } catch {
    return null;
  }
}

const stored = readStoredLocale();
const lng = stored === 'hi' || stored === 'mr' || stored === 'en' ? stored : 'en';

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    hi: { translation: hi },
    mr: { translation: mr },
  },
  lng,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export function setLocale(next: Locale) {
  try {
    if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
      localStorage.setItem('cs.locale', next);
    }
  } catch {
    /* private mode / tests */
  }
  if (typeof document !== 'undefined') document.documentElement.lang = next;
  void i18n.changeLanguage(next);
}

export default i18n;
