import type { Resource, ResourceKey } from 'i18next';

export interface i18nProps {
  i18nStore?: Record<string, Record<string, ResourceKey>>;
  language?: string;
}

export interface InitialProps {
  initialI18nStore: Resource;
  initialLanguage: string;
  initialNS: string[];
}
