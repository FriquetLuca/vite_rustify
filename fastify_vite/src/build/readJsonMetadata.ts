import fs from 'node:fs';

export function readJsonMetadata(
  file: string,
  allowProperties: string[]
): Record<string, unknown> {
  const source = fs.readFileSync(file, 'utf8');
  const parsed: unknown = JSON.parse(source);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {};
  }
  const metadata: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(
    parsed as Record<string, unknown>
  )) {
    if (!allowProperties.includes(key)) {
      continue;
    }
    metadata[key] = value;
  }
  return metadata;
}
