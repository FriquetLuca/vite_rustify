import type { SSRCtx, StaticProps } from '../../types';

export default async function getStaticProps({ params }: SSRCtx): StaticProps {
  return {
    data: params,
  };
}
