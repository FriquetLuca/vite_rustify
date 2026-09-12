import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpApi from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

export const defaultLanguage = 'en';

export const languageLabels: Record<string, { label: string; flag: string }> = {
  en: { label: 'English', flag: '🇬🇧' },
  fr: { label: 'Français', flag: '🇫🇷' },
};

export const languages = Object.keys(languageLabels);

export const i18nOptions = {
  fallbackLng: defaultLanguage,
  debug: false,
  interpolation: {
    escapeValue: false,
  },
  supportedLngs: languages,
};

const joinPaths = (...parts: string[]): string => {
  const filtered = parts.filter(Boolean);
  if (filtered.length === 0) return '';

  return filtered
    .map((part, index) => {
      if (index === 0) return part.replace(/\/+$/, '');
      if (index === filtered.length - 1) return part.replace(/^\/+/, '');
      return part.replace(/^\/+|\/+$/g, '');
    })
    .join('/');
};

i18n
  .use(HttpApi)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    ...i18nOptions,
    backend: {
      loadPath: joinPaths(
        import.meta.env.VITE_BASE_PATH ?? '/',
        'locales/{{ns}}/{{lng}}.json'
      ),
    },
    detection: {
      order: ['querystring', 'cookie', 'localStorage', 'navigator', 'htmlTag'],
      lookupQuerystring: 'lng',
      lookupCookie: 'i18next',
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage', 'cookie'],
    },
  });

export { i18n };
