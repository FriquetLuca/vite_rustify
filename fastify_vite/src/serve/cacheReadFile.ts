import fs from 'node:fs';

export function cacheReadFile(location: string) {
  let content: string | undefined;
  return {
    read() {
      if (content) return content;
      content = fs.readFileSync(location, 'utf8');
      return content;
    },
    clear() {
      content = undefined;
    },
  };
}

export function tempCacheReadFile(location: string, cacheTimeoutMS: number) {
  let content: string | undefined;
  let timeout = cacheTimeoutMS;
  let nextlastTimePurge: number | undefined;
  return {
    read() {
      if (
        (nextlastTimePurge === undefined ||
          Number(nextlastTimePurge) > Date.now()) &&
        content
      )
        return content;
      content = fs.readFileSync(location, 'utf8');
      nextlastTimePurge = Date.now() + timeout;
      return content;
    },
    clear() {
      content = undefined;
      nextlastTimePurge = undefined;
    },
    setNewTimeout(cacheTimeoutMS: number) {
      nextlastTimePurge =
        nextlastTimePurge !== undefined
          ? nextlastTimePurge - timeout + cacheTimeoutMS
          : nextlastTimePurge;
      timeout = cacheTimeoutMS;
    },
  };
}
