import fsp from 'node:fs/promises';

interface CacheEntry {
  html: string;
  size: number;
}

export class FileCache {
  private readonly entries = new Map<string, CacheEntry>();
  private totalSize = 0;
  private readonly maxBytes;
  private readonly maxEntryBytes;
  constructor(
    maxBytes = 64 * 1024 * 1024, // 64 MiB
    maxEntryBytes = 2 * 1024 * 1024 // 2 MiB
  ) {
    this.maxBytes = maxBytes;
    this.maxEntryBytes = maxEntryBytes;
  }
  async get(filePath: string): Promise<string | undefined> {
    const cached = this.entries.get(filePath);
    if (cached) {
      this.entries.delete(filePath);
      this.entries.set(filePath, cached);
      return cached.html;
    }
    let html: string;
    try {
      html = await fsp.readFile(filePath, 'utf8');
    } catch {
      return undefined;
    }
    const size = Buffer.byteLength(html, 'utf8');
    // Don't cache oversized pages, but still serve them.
    if (size > this.maxEntryBytes || size > this.maxBytes) {
      return html;
    }
    // Evict least recently used entries until this page fits.
    while (this.totalSize + size > this.maxBytes && this.entries.size > 0) {
      const oldestKey = this.entries.keys().next().value!;
      const oldest = this.entries.get(oldestKey)!;
      this.entries.delete(oldestKey);
      this.totalSize -= oldest.size;
    }
    this.entries.set(filePath, { html, size });
    this.totalSize += size;
    return html;
  }
  clear(): void {
    this.entries.clear();
    this.totalSize = 0;
  }
  get stats() {
    return {
      entries: this.entries.size,
      bytes: this.totalSize,
      maxBytes: this.maxBytes,
    };
  }
}
