import type { i18n, ResourceKey } from 'i18next';
import { resolveLocale } from '../serve/resolveLocale.js';

export function serverSideTranslations({
  i18n,
  ns,
  host,
}: {
  i18n: i18n;
  ns: string[];
  host?: string;
}) {
  if (i18n === null)
    return {
      language: '',
      namespaces: [],
      i18nStore: {},
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
    namespaces: ns,
    i18nStore: initialI18nStore,
  };
}
