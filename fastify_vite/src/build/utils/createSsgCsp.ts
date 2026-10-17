import crypto from 'node:crypto';
import * as parse5 from 'parse5';

export interface CspResult {
  hashes: string[];
  header: string;
}

interface Parse5Node {
  nodeName?: string;
  attrs?: Array<{
    name: string;
    value: string;
  }>;
  childNodes?: Parse5Node[];
  sourceCodeLocation?: {
    startTag?: {
      startOffset: number;
      endOffset: number;
    };
    endTag?: {
      startOffset: number;
      endOffset: number;
    };
  };
}

function collectInlineScriptHashes(html: string): string[] {
  const document = parse5.parse(html, {
    sourceCodeLocationInfo: true,
  }) as Parse5Node;

  const hashes: string[] = [];

  walk(document, (node) => {
    if (node.nodeName !== 'script') {
      return;
    }

    const location = node.sourceCodeLocation;

    // Shouldn't normally happen for a normal <script>, but be defensive.
    if (!location?.startTag || !location.endTag) {
      return;
    }

    // External script:
    //
    // <script src="/assets/app.js"></script>
    //
    // Doesn't need a CSP hash because script-src 'self' handles it.
    const hasSrc = node.attrs?.some(
      (attr) => attr.name.toLowerCase() === 'src'
    );

    if (hasSrc) {
      return;
    }

    // Extract the content directly from the ORIGINAL HTML.
    //
    // This is important. We don't reconstruct the content from the
    // parse5 AST because CSP hashes are sensitive to exact bytes.
    const content = html.slice(
      location.startTag.endOffset,
      location.endTag.startOffset
    );

    // Empty inline script doesn't need a useful hash.
    if (content.length === 0) {
      return;
    }

    const hash = crypto
      .createHash('sha256')
      .update(content, 'utf8')
      .digest('base64');

    hashes.push(hash);
  });

  return hashes;
}

function walk(node: Parse5Node, callback: (node: Parse5Node) => void): void {
  callback(node);

  for (const child of node.childNodes ?? []) {
    walk(child, callback);
  }
}

export function createSsgCsp(html: string): CspResult {
  const hashes = collectInlineScriptHashes(html);

  const scriptHashes = hashes.map((hash) => `'sha256-${hash}'`).join(' ');

  const header = [
    "default-src 'self'",
    `script-src 'self'${scriptHashes ? ` ${scriptHashes}` : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
  ].join('; ');

  return {
    hashes,
    header,
  };
}
