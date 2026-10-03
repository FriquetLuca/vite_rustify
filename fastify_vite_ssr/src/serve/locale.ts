import { languages, defaultLanguage } from '../services/i18n.shared.js';
import type { i18n } from 'i18next';

export function resolveLocale(host: string, i18n: i18n): string {
  const hostname = host.split(':')[0].toLowerCase();
  const firstLabel = hostname.split('.')[0];
  if (languages.includes(firstLabel)) {
    return firstLabel;
  }
  const maybeLanguage = i18n.languages[0];
  return languages.includes(maybeLanguage) ? maybeLanguage : defaultLanguage;
}
