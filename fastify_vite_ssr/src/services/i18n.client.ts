import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpApi from 'i18next-http-backend';
import { i18nOptions } from './i18n.shared.js';

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
    detection: {
      order: ['querystring', 'cookie', 'localStorage', 'navigator', 'htmlTag'],
      lookupQuerystring: 'lng',
      lookupCookie: 'i18next',
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage', 'cookie'],
    },
    backend: {
      loadPath: joinPaths(import.meta.env.VITE_BASE_PATH ?? '/', 'locales/{{ns}}/{{lng}}.json'),
    },
  });
export { i18n };

/*
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import HttpApi from 'i18next-http-backend';
import { i18nOptions } from './i18n.shared.js';

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
    detection: {
      order: ['querystring', 'cookie', 'localStorage', 'navigator', 'htmlTag'],
      lookupQuerystring: 'lng',
      lookupCookie: 'i18next',
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage', 'cookie'],
    },
    backend: {
      loadPath: joinPaths(import.meta.env.VITE_BASE_PATH ?? '/', 'locales/{{ns}}/{{lng}}.json'),
    },
  });
export { i18n };

*/