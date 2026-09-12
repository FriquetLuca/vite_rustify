import { serverSideTranslations } from '../../utils/serverSideTranslations.js';
import type { SSRCtx, StaticProps } from '../../types';

export default async function getStaticProps({ i18n }: SSRCtx): StaticProps {
  return {
    data: { title: 'Contact Us' },
    title: 'Contact',
    ...serverSideTranslations({
      i18n,
      ns: ['contact'],
    }),
  };
}
