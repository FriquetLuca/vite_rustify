import type { i18n, ResourceKey } from 'i18next';

export function serverSideTranslations({
  i18n,
  ns,
}: {
  i18n: i18n;
  ns: string[];
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
  return {
    language: i18n.languages[0],
    namespaces: ns,
    i18nStore: initialI18nStore,
  };
}
