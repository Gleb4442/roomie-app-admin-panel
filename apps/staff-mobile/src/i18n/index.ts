import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import * as SecureStore from 'expo-secure-store';

import en from './locales/en.json';
import ru from './locales/ru.json';
import uk from './locales/uk.json';

const LANG_KEY = 'staff_language';

const deviceLanguage = getLocales()[0]?.languageCode || 'en';
const supportedLangs = ['en', 'ru', 'uk'];
const defaultLang = supportedLangs.includes(deviceLanguage) ? deviceLanguage : 'en';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ru: { translation: ru },
    uk: { translation: uk },
  },
  lng: defaultLang,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

// Load persisted language preference
SecureStore.getItemAsync(LANG_KEY).then(saved => {
  if (saved && supportedLangs.includes(saved)) {
    i18n.changeLanguage(saved);
  }
}).catch(() => {});

// Persist language changes
const originalChangeLanguage = i18n.changeLanguage.bind(i18n);
i18n.changeLanguage = async (lng?: string, callback?: any) => {
  if (lng) {
    SecureStore.setItemAsync(LANG_KEY, lng).catch(() => {});
  }
  return originalChangeLanguage(lng, callback);
};

export default i18n;
