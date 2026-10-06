import path from 'node:path';
import { glob } from 'tinyglobby';

import type { RenderMode } from '../types';

const isProduction = process.env.NODE_ENV === 'production';

export interface RouteDefinition {
  path: string;
  filePath: string;
  mode: RenderMode;
  serverFilePath?: string;
}

function routeScore(routePath: string) {
  return routePath
    .split('/')
    .filter(Boolean)
    .reduce((score, segment) => {
      if (segment === '*') {
        return score - 1;
      }
      if (segment.startsWith(':')) {
        return score + 10;
      }
      return score + 100;
    }, 0);
}

function fileToRoutePath(file: string) {
  let name = file
    .replace(isProduction ? /^dist\/pages\// : /^src\/pages\//, '')
    .replace(isProduction ? /\.js$/ : /\.tsx$/, '');
  name = name
    .replace(/\.(ssr|ssg|csr)$/, '')
    .replace(/\[([^\]]+)\]/g, ':$1')
    .replace(/\/index$/, '')
    .replace(/^index$/, '');

  return `/${name}`;
}

function getMode(file: string): RenderMode {
  if (file.endsWith(isProduction ? '.ssg.js' : '.ssg.tsx')) {
    return 'ssg';
  }
  if (file.endsWith(isProduction ? '.csr.js' : '.csr.tsx')) {
    return 'csr';
  }
  return 'ssr';
}

export async function discoverRoutes(): Promise<RouteDefinition[]> {
  const files = await glob(
    isProduction ? 'dist/pages/**/*.js' : 'src/pages/**/*.tsx',
    {
      onlyFiles: true,
      dot: false,
    }
  );
  const pageFiles = files.filter(
    (file) => !file.endsWith(isProduction ? '.server.js' : '.server.tsx')
  );
  const serverFiles = new Map(
    files
      .filter((file) =>
        file.endsWith(isProduction ? '.server.js' : '.server.tsx')
      )
      .map((file) => [
        file.replace(isProduction ? /\.server\.js$/ : /\.server\.tsx$/, ''),
        path.resolve(file),
      ])
  );
  const routes = pageFiles.map((file) => {
    const pageKey = file.replace(
      isProduction ? /\.(ssr|ssg|csr)\.js$/ : /\.(ssr|ssg|csr)\.tsx$/,
      ''
    );
    return {
      path: fileToRoutePath(file),
      filePath: path.resolve(file),
      mode: getMode(file),
      serverFilePath: serverFiles.get(pageKey),
    };
  });

  return routes.sort((a, b) => {
    const score = routeScore(b.path) - routeScore(a.path);
    if (score !== 0) {
      return score;
    }
    return b.path.split('/').length - a.path.split('/').length;
  });
}
