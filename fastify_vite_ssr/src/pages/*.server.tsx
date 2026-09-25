import { serverSideTranslations } from '../utils/serverSideTranslations.js';
import type { SSRCtx, StaticProps } from '../types';

export default async function getStaticProps({ i18n }: SSRCtx): StaticProps {
  return {
    title: 'Oops, no page here',
    statusCode: 404,
    ...serverSideTranslations({
      i18n,
      ns: ['translations'],
    }),
  };
}
