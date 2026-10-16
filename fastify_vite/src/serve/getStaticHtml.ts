import * as fsp from 'node:fs/promises';

const htmlCache = new Map<string, string>();

export async function getStaticHtml(
  staticLocation: string
): Promise<string | undefined> {
  const cached = htmlCache.get(staticLocation);
  if (cached !== undefined) {
    return cached;
  }
  try {
    const html = await fsp.readFile(staticLocation, 'utf8');
    htmlCache.set(staticLocation, html);
    return html;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined;
    }
    throw error;
  }
}
