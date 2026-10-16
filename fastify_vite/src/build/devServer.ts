import { createServer, createServerModuleRunner, type Plugin } from 'vite';
import { BASE } from '../serve/environment.js';
import type { FastifyInstance } from 'fastify';

const serverReload = (onChange: (file: string) => void): Plugin => ({
  name: 'server-reload',
  hotUpdate({ file, modules }) {
    if (this.environment.name !== 'ssr') return;
    if (modules.length === 0) return;
    for (const mod of modules)
      this.environment.moduleGraph.invalidateModule(mod);
    onChange(file);
    return [];
  },
});

export async function devServer(url: string) {
  let app: FastifyInstance | undefined;
  let queue = Promise.resolve();

  const vite = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    base: BASE,
    plugins: [
      serverReload(() => {
        queue = queue
          .then(restart)
          .catch((e) => console.error('reload failed:', e));
      }),
    ],
  });
  const runner = createServerModuleRunner(vite.environments.ssr);

  async function start() {
    const server = await runner.import(url);
    app = await server.default({ vite });
  }

  async function restart() {
    await app?.close();
    runner.clearCache();
    await start();
  }

  await start();
}
