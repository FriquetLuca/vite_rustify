import type { InitialProps, RouteDataCache } from './types';

export {};

declare global {
  interface Window {
    __INITIAL_PROPS__: InitialProps;
    __ROUTE_DATA__: RouteDataCache;
  }
}
