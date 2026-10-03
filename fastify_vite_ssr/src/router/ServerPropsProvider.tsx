import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { RouteData, StaticProps } from '../types';

interface ServerPropsContextValue {
  props: RouteData | null;
}
const ServerPropsContext = createContext<ServerPropsContextValue | null>(null);

export interface ServerPropsProviderProps {
  path: string;
  props?: RouteData;
  children: ReactNode;
}

export function ServerPropsProvider({
  path,
  props,
  children,
}: ServerPropsProviderProps) {
  const [data, setData] = useState<RouteData | null>(() => {
    if (typeof window === 'undefined') {
      return props ?? null;
    }
    return window.__ROUTE_DATA__?.[path] ?? props ?? null;
  });
  useEffect(() => {
    const cached = window.__ROUTE_DATA__?.[path];
    if (cached) {
      document.title = cached.title || document.title;
      setData(cached);
      return;
    }
    fetch(`/__data${path}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load route data: ${response.status}`);
        }
        return response.json() as Promise<StaticProps>;
      })
      .then((result) => {
        window.__ROUTE_DATA__ ??= {};
        window.__ROUTE_DATA__[path] = result;
        document.title = result?.title || document.title;
        setData(result);
      })
      .catch((error) => {
        console.error(`Failed to load data for ${path}`, error);
      });
  }, [path]);

  return (
    <ServerPropsContext.Provider value={{ props: data }}>
      {children}
    </ServerPropsContext.Provider>
  );
}

export function useServerProps<T>() {
  return (useContext(ServerPropsContext)?.props?.data ?? null) as T | null;
}
