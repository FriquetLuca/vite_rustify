import fs from 'node:fs';
import ts from 'typescript';

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

export function readScriptMetadata(file: string, allowProperties: string[]): Record<string, unknown> {
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

  