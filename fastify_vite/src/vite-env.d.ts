/// <reference types="vite/client" />

declare module 'virtual:framework-router' {
  import type { RouteObject } from 'react-router';
  import type { JSX } from 'react';
  type RenderMode = import('./types.js').RenderMode;

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
  export interface RoutePage {
    id: string;
    path: string;
    mode: RenderMode;
    metadata: Record<string, RouteMetadata>;
    load: () => Promise<PageModule>;
  }
  const pages: RoutePage[];
  export default pages;
}

declare module 'virtual:server-router' {
  type SSRCtx = import('./types.js').SSRCtx;
  type GetStaticProps = import('./types.js').GetStaticProps;
  type RenderMode = import('./types.js').RenderMode;
  export interface ServerRouteModule {
    default: (props: SSRCtx) => GetStaticProps;
  }
  export interface ServerRoute {
    path: string;
    mode: RenderMode;
    filePath: string;
    serverFile?: () => ServerRouteModule;
  }
  const routes: ServerRoute[];
  export default routes;
}
