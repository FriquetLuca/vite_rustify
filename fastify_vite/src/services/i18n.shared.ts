export const defaultLanguage = 'en';

export const languageLabels: Record<string, { label: string; flag: string }> = {
  en: { label: 'English', flag: '🇬🇧' },
  fr: { label: 'Français', flag: '🇫🇷' },
};

export const languages = Array.from(Object.getOwnPropertyNames(languageLabels));

export const i18nOptions = {
  fallbackLng: defaultLanguage,
  debug: false,
  interpolation: {
    escapeValue: false,
  },
  supportedLngs: languages,
  ns: ['translations', 'contact'],
  defaultNS: 'translations',
};
