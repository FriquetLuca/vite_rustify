import { createServer, createServerModuleRunner } from 'vite';
import { BASE } from '../../serve/environment.js';

export async function ssgServer(url: string) {
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    base: BASE,
  });
  const runner = createServerModuleRunner(vite.environments.ssr);
  const main = await runner.import(url);
  try {
    await main.default();
  } catch (err) {
    console.error('SSG build failed:', err);
    process.exit(1);
  }
}
