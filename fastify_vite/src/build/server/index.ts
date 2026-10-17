import { devServer } from './devServer.js';
import { ssgServer } from './ssgServer.js';

export function viteServer(location: string, isSSG = false) {
  if (isSSG) {
    ssgServer(location);
  } else {
    devServer(location);
  }
}
