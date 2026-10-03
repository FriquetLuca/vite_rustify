import os from 'node:os';

const interfaces = os.networkInterfaces();
export function getIPs(family: 'IPv4' | 'IPv6'): string[] {
  const result: string[] = [];
  for (const key in interfaces) {
    const addresses = interfaces[key];
    if (!addresses) {
      continue;
    }
    for (const address of addresses) {
      if (address.family === family) {
        result.push(address.address);
      }
    }
  }
  return result;
}
