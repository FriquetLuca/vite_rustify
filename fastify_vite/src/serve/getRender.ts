import type { ViteDevServer } from 'vite';
import type { RenderFunction } from '../types.js';
import { render } from '../renderer/entry-server.js';

export async function getRender(
  vite: ViteDevServer | undefined
): Promise<RenderFunction> {
  if (!__IS_PRODUCTION__) {
    return (await vite!.ssrLoadModule('/src/renderer/entry-server.tsx')).render;
  } else {
    return render;
  }
}
