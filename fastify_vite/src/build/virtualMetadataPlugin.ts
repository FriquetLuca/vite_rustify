import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import type { Plugin, ResolvedConfig } from 'vite';
import { createFilter, type FilterPattern } from './createFilter.js';

export interface VirtualMetadataPluginOptions {
  /**
   * ID of the virtual module containing metadatas.
   *
   * @default "module-metadata"
   */
  moduleId?: string;
  /**
   * Directory containing your page files.
   *
   * @default ""
   */
  filesRoot?: string;
  /**
   * File extensions to inspect.
   *
   * @default undefined
   */
  include?: FilterPattern;
  /**
   * Files to ignore.
   *
   * @default undefined
   */
  exclude?: FilterPattern;
  /**
   * Properties to extract.
   *
   * @default []
   */
  allowProperties?: string[];
}

export default function virtualMetadataPlugin(
  options: VirtualMetadataPluginOptions = {}
): Plugin {
  let config: ResolvedConfig;
  let filter: (id: unknown) => boolean;
  const filesDir = options.filesRoot ?? '';
  const allowProperties = options.allowProperties ?? [];
  const moduleId = options.moduleId ?? 'module-metadata';
  const virtualModuleID = `virtual:${moduleId}`;
  const resolvedVirtualModuleID = '\0' + virtualModuleID;

  function resolvePatterns(
    patterns: FilterPattern | undefined
  ): FilterPattern | undefined {
    if (patterns === undefined) {
      return undefined;
    }
    const list = Array.isArray(patterns) ? patterns : [patterns];
    return list.map((pattern) => {
      if (typeof pattern !== 'string') {
        return pattern;
      }
      if (pattern.startsWith('/')) {
        return path.resolve(config.root, pattern.slice(1));
      }
      return pattern;
    });
  }
  function getFilesRoot(): string {
    return path.resolve(config.root, filesDir);
  }
  function isAllowedFile(file: string): boolean {
    return filter(file);
  }
  function getFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) {
      return [];
    }
    const result: string[] = [];
    for (const entry of fs.readdirSync(dir, {
      withFileTypes: true,
    })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        result.push(...getFiles(fullPath));
        continue;
      }
      if (entry.isFile() && isAllowedFile(fullPath)) {
        result.push(fullPath);
      }
    }
    return result;
  }
  function getModulePath(file: string): string {
    const relative = path.relative(config.root, file);
    return '/' + relative.split(path.sep).join('/');
  }
  function getExportValue(initializer: ts.Expression): unknown {
    if (initializer.kind === ts.SyntaxKind.TrueKeyword) {
      return true;
    }
    if (initializer.kind === ts.SyntaxKind.FalseKeyword) {
      return false;
    }
    if (initializer.kind === ts.SyntaxKind.NullKeyword) {
      return null;
    }
    if (ts.isStringLiteral(initializer)) {
      return initializer.text;
    }
    if (ts.isNumericLiteral(initializer)) {
      return Number(initializer.text);
    }
    if (ts.isPrefixUnaryExpression(initializer)) {
      const value = getExportValue(initializer.operand);
      if (typeof value !== 'number') {
        return undefined;
      }
      if (initializer.operator === ts.SyntaxKind.MinusToken) {
        return -value;
      }
      if (initializer.operator === ts.SyntaxKind.PlusToken) {
        return value;
      }
    }
    if (ts.isArrayLiteralExpression(initializer)) {
      return initializer.elements.map((element) => {
        return getExportValue(element);
      });
    }
    if (ts.isObjectLiteralExpression(initializer)) {
      const object: Record<string, unknown> = {};
      for (const property of initializer.properties) {
        if (!ts.isPropertyAssignment(property)) {
          continue;
        }
        const name = getPropertyName(property.name);
        if (!name) {
          continue;
        }
        const value = getExportValue(property.initializer);
        if (value !== undefined) {
          object[name] = value;
        }
      }
      return object;
    }
    return undefined;
  }
  function getPropertyName(name: ts.PropertyName): string | undefined {
    if (ts.isIdentifier(name)) {
      return name.text;
    }
    if (ts.isStringLiteral(name)) {
      return name.text;
    }
    if (ts.isNumericLiteral(name)) {
      return name.text;
    }
    return undefined;
  }
  function readMetadata(file: string): Record<string, unknown> {
    if (file.endsWith('.json')) {
      return readJsonMetadata(file);
    }
    return readScriptMetadata(file);
  }
  function readJsonMetadata(file: string): Record<string, unknown> {
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
  function readScriptMetadata(file: string): Record<string, unknown> {
    const source = fs.readFileSync(file, 'utf8');
    const sourceFile = ts.createSourceFile(
      file,
      source,
      ts.ScriptTarget.Latest,
      true,
      getScriptKind(file)
    );
    const metadata: Record<string, unknown> = {};
    for (const statement of sourceFile.statements) {
      if (!ts.isVariableStatement(statement)) {
        continue;
      }
      const isExported = statement.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
      );
      if (!isExported) {
        continue;
      }
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) {
          continue;
        }
        if (!allowProperties.includes(declaration.name.text)) {
          continue;
        }
        const value = getExportValue(declaration.initializer);
        if (value != undefined) {
          metadata[declaration.name.text as keyof typeof metadata] = value;
        }
      }
    }
    return metadata;
  }
  function generateModule(): string {
    const files = getFiles(getFilesRoot());
    const metadata: Record<string, Record<string, unknown>> = {};
    for (const file of files) {
      const moduleMetadata = readMetadata(file);
      metadata[getModulePath(file)] = moduleMetadata;
    }
    return [
      `const moduleMetadata = ${JSON.stringify(metadata, null, 2)};`,
      '',
      'export default moduleMetadata;',
      '',
    ].join('\n');
  }
  return {
    name: `glob-${moduleId}`,
    configResolved(resolvedConfig) {
      config = resolvedConfig;
      filter = createFilter(
        resolvePatterns(options.include),
        resolvePatterns(options.exclude)
      );
    },
    resolveId(id) {
      if (id === virtualModuleID) {
        return resolvedVirtualModuleID;
      }
      return undefined;
    },
    load(id) {
      if (id !== resolvedVirtualModuleID) {
        return undefined;
      }
      return generateModule();
    },
    hotUpdate({ file }) {
      if (!isAllowedFile(file)) {
        return;
      }
      const module = this.environment.moduleGraph.getModuleById(
        resolvedVirtualModuleID
      );
      if (module) {
        this.environment.moduleGraph.invalidateModule(module);
      }
      this.environment.hot.send({
        type: 'full-reload',
      });
      return [];
    },
  };
}

function getScriptKind(file: string): ts.ScriptKind {
  if (file.endsWith('.tsx')) {
    return ts.ScriptKind.TSX;
  }
  if (file.endsWith('.jsx')) {
    return ts.ScriptKind.JSX;
  }
  if (file.endsWith('.ts')) {
    return ts.ScriptKind.TS;
  }
  return ts.ScriptKind.JS;
}
