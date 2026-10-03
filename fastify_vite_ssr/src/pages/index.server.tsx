import { serverSideTranslations } from '../utils/serverSideTranslations.js';
import type { SSRCtx, GetStaticProps } from '../types';

export default async function getStaticProps({
  i18n,
  headers,
}: SSRCtx): GetStaticProps {
  return {
    data: { title: 'About Us' },
    ...serverSideTranslations({
      i18n,
      ns: ['translations'],
      host: headers.host,
    }),
  };
}
