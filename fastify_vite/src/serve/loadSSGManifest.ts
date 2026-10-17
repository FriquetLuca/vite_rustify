import fs from 'node:fs';
import type { ManifestSSG } from '../types.js';
import { IS_SSG } from './environment.js';

export function loadSSGManifest(manifestLocation: string): ManifestSSG[] {
  if (__IS_PRODUCTION__ && !IS_SSG && fs.existsSync(manifestLocation)) {
    return JSON.parse(fs.readFileSync(manifestLocation, 'utf-8'));
  }
  return [];
}
