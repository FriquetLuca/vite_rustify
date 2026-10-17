import type { i18n } from 'i18next';
import path from 'node:path';
import { FileCache } from './fileCache.js';
import { resolveLocale } from './resolveLocale.js';

const ssgCache = new FileCache();
export async function loadSSGPage(
  ssgDir: string,
  pathname: string,
  host: string,
  i18n: i18n
): Promise<[path: string, html: string | undefined]> {
  const locale = resolveLocale(host, i18n);
  const reqURL = pathname === '/' ? '/index' : pathname;
  const ssrPath = `${locale}${reqURL}`;
  const staticLocation = path.join(ssgDir, `.ssg/${ssrPath}.html`);
  const html = await ssgCache.get(staticLocation);
  return [ssrPath, html];
}
