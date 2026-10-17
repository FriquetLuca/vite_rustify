import crypto from 'node:crypto';
import { IS_SSG } from './environment.js';

interface CSPSecureResponse {
  isSecure: true;
  nonce: string;
  script: string;
  cspHeader: string;
}
interface CSPUnsecureResponse {
  isSecure: false;
  nonce: undefined;
  script: string;
}
export type CSPResponse = CSPSecureResponse | CSPUnsecureResponse;

export function contentSecurityPolicy(scriptContent: string): CSPResponse {
  if (__IS_PRODUCTION__ && !IS_SSG) {
    const nonce = crypto.randomBytes(16).toString('base64');
    const scriptCsp = `'nonce-${nonce}'`;
    return {
      isSecure: true,
      nonce,
      script: `<script nonce="${nonce}">` + scriptContent + '</script>',
      cspHeader: [
        "default-src 'self'",
        `script-src 'self' ${scriptCsp}`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: https:",
        "font-src 'self' data:",
      ].join('; '),
    };
  } else {
    return {
      isSecure: false,
      nonce: undefined,
      script: '<script>' + scriptContent + '</script>',
    };
  }
}
