import * as fsp from 'node:fs/promises';
import type { ManifestSSG } from '../types.js';
import { IS_SSG } from './environment.js';

export async function loadSSGManifest(
  manifestLocation: string
): Promise<ManifestSSG[]> {
  if (__IS_PRODUCTION__ && !IS_SSG) {
    try {
      const manifest = await fsp.readFile(manifestLocation, 'utf-8');
      return JSON.parse(manifest);
    } catch {
      return [];
    }
  }
  return [];
}
