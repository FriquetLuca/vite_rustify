import type { i18n, ResourceKey } from 'i18next';
import { resolveLocale } from '../serve/resolveLocale.js';

interface ServerSideTranslationProps {
  i18n: i18n;
  ns: string[];
  host?: string;
}

export function serverSideTranslations({
  i18n,
  ns,
  host,
}: ServerSideTranslationProps) {
  if (i18n === null)
    return {
      language: undefined,
      i18nStore: undefined,
    };
  const initialI18nStore: Record<string, Record<string, ResourceKey>> = {};
  const ons = i18n.options.ns || [];
  const namespaces = typeof ons === 'string' ? [ons] : ons;
  const usedNamespaces = namespaces.filter((n) => ns.includes(n));
  i18n.languages.forEach((language) => {
    initialI18nStore[language] = {};

    usedNamespaces.forEach((namespace) => {
      initialI18nStore[language][namespace] =
        i18n.services.resourceStore.data[language][namespace];
    });
  });
  const locale = resolveLocale(host ?? '', i18n);
  return {
    language: locale,
    i18nStore: initialI18nStore,
  };
}
