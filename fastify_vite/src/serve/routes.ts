import path from 'node:path';
import fs from 'node:fs';
import { glob } from 'tinyglobby';
import type { ManifestSSG, RenderMode } from '../types';
import { getRoutePath } from './getRoutePath.js';
import { normalizeRoutePath } from './normalizeRoutePath.js';
import { compareRoutes } from './compareRoutes.js';
import { IS_PRODUCTION, IS_SECURE } from './environment.js';

export interface RouteSSG {
  hashes: string[];
  header: string;
}

export interface RouteDefinition {
  path: string;
  filePath: string;
  mode: RenderMode;
  serverFilePath?: string;
  ssg?: RouteSSG;
}

function getMode(file: string): RenderMode {
  if (file.match(/\.ssg\.(tsx|ts|jsx|js)$/)) {
    return 'ssg';
  }
  if (file.match(/\.csr\.(tsx|ts|jsx|js)$/)) {
    return 'csr';
  }
  return 'ssr';
}

const ROUTE_FILE_REGEX = /\.(ssr|ssg|csr)\.(tsx|ts|jsx|js)$/;
const SERVER_FILE_REGEX = /\.server\.(tsx|ts|jsx|js)$/;

export function loadSSGManifest(manifestLocation: string): ManifestSSG[] {
  if (IS_SECURE) {
    return JSON.parse(fs.readFileSync(manifestLocation, 'utf-8'));
  }
  return [];
}

export async function discoverRoutes(): Promise<RouteDefinition[]> {
  const files = await glob(
    IS_PRODUCTION ? 'dist/pages/**/*.js' : 'src/pages/**/*.tsx',
    {
      onlyFiles: true,
      dot: false,
    }
  );
  const pageFiles = files.filter((file) => !file.match(SERVER_FILE_REGEX));
  const serverFiles = new Map(
    files
      .filter((file) => file.match(SERVER_FILE_REGEX))
      .map((file) => [file.replace(SERVER_FILE_REGEX, ''), path.resolve(file)])
  );
  const routes = pageFiles.map((file) => {
    const pageKey = file.replace(ROUTE_FILE_REGEX, '');
    return {
      path: normalizeRoutePath(
        getRoutePath(IS_PRODUCTION ? 'dist/pages' : 'src/pages', file)
      ),
      filePath: path.resolve(file),
      mode: getMode(file),
      serverFilePath: serverFiles.get(pageKey),
    };
  });

  return routes.sort((a, b) =>
    compareRoutes({ path: a.path }, { path: b.path })
  );
}
