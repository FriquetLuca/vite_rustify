declare module 'virtual:route-metadata' {
  export interface RouteMetadata {
    isChild?: boolean;
  }
  const metadata: Record<string, RouteMetadata>;
  export default metadata;
}
