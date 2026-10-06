import { readJsonMetadata } from "./readJsonMetadata.js";
import { readScriptMetadata } from "./readScriptMetadata.js";

export function readMetadata(file: string, allowProperties: string[]): Record<string, unknown> {
    if (file.endsWith('.json')) {
      return readJsonMetadata(file, allowProperties);
    }
    return readScriptMetadata(file, allowProperties);
  }
  