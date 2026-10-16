/// <reference types="vite/client" />

declare module 'virtual:framework-router' {
  import type { RouteObject } from 'react-router';
  import type { JSX } from 'react';
  export interface RouteMetadata {
    isChild?: boolean;
  }
  export type PageModule = {
    default: () => JSX.Element;
  } & Omit<
    RouteObject,
    | 'lazy'
    | 'caseSensitive'
    | 'path'
    | 'id'
    | 'index'
    | 'children'
    | 'unstable_validateParams'
    | 'middleware'
  >;
  const pages: {
    id: string;
    path: string;
    mode: 'ssr' | 'ssg' | 'csr';
    metadata: Record<string, RouteMetadata>;
    load: () => Promise<PageModule>;
  }[];
  export default pages;
}

declare module 'virtual:server-router' {
  import type { SSRCtx, GetStaticProps } from './src/types.js';

  export type ServerRouteModule = {
    default: (props: SSRCtx) => GetStaticProps;
  };

  export type ServerRoute = {
    path: string;
    mode: 'ssr' | 'ssg' | 'csr';
    filePath: string;
    serverFile?: () => ServerRouteModule;
  };

  const routes: ServerRoute[];

  export default routes;
}
