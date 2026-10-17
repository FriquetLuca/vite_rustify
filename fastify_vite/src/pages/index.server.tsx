import type { SSRCtx, GetStaticProps } from '../types';

export default async function getStaticProps(_: SSRCtx): GetStaticProps {
  return {
    data: { title: 'About Us' },
    i18nNS: ['translations'],
  };
}
