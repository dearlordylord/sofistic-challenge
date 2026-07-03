import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";

const sourceRoots = [join("packages")];
const forbiddenPrimitives = new Set(["Number", "String"]);
const findings = [];

for (const root of sourceRoots) {
  for (const file of walk(root)) {
    if (!/\/src\/.*\.tsx?$/.test(file) || /\.test\.tsx?$/.test(file)) continue;
    checkFile(file);
  }
}

if (findings.length > 0) {
  console.error("Exported Schema.Struct fields must use named domain schemas, not raw Schema.String/Schema.Number:");
  for (const finding of findings) {
    console.error(`- ${finding}`);
  }
  process.exitCode = 1;
}

function* walk(path) {
  const stat = statSync(path);
  if (stat.isDirectory()) {
    if (path.endsWith("node_modules") || path.endsWith("dist")) return;
    for (const entry of readdirSync(path)) {
      yield* walk(join(path, entry));
    }
    return;
  }

  yield path;
}

function checkFile(file) {
  const sourceText = readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(file, sourceText, ts.ScriptTarget.Latest, true);
  const exportedNames = findExportedNames(sourceFile);

  const visit = (node) => {
    if (ts.isVariableStatement(node)) {
      for (const declaration of node.declarationList.declarations) {
        if (!isExported(node) && !isExportedDeclaration(declaration, exportedNames)) continue;
        const initializer = declaration.initializer;
        if (initializer !== undefined && isSchemaStructCall(initializer)) {
          checkStructFields(file, sourceFile, initializer);
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
}

function checkStructFields(file, sourceFile, structCall) {
  const fields = structCall.arguments[0];
  if (fields === undefined || !ts.isObjectLiteralExpression(fields)) return;

  for (const property of fields.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    if (containsForbiddenPrimitive(property.initializer)) {
      const name = property.name.getText(sourceFile);
      const position = sourceFile.getLineAndCharacterOfPosition(property.name.getStart(sourceFile));
      findings.push(`${file}:${position.line + 1}:${position.character + 1} field ${name}`);
    }
  }
}

function containsForbiddenPrimitive(expression) {
  if (isForbiddenSchemaPrimitive(expression)) return true;

  return Array.from(expression.getChildren()).some((child) => containsForbiddenPrimitive(child));
}

function isForbiddenSchemaPrimitive(expression) {
  return ts.isPropertyAccessExpression(expression)
    && expression.expression.getText() === "Schema"
    && forbiddenPrimitives.has(expression.name.text);
}

function isExported(node) {
  return node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

function isExportedDeclaration(declaration, exportedNames) {
  return ts.isIdentifier(declaration.name) && exportedNames.has(declaration.name.text);
}

function findExportedNames(sourceFile) {
  const names = new Set();

  for (const statement of sourceFile.statements) {
    if (!ts.isExportDeclaration(statement)) continue;
    if (statement.exportClause === undefined || !ts.isNamedExports(statement.exportClause)) continue;

    for (const element of statement.exportClause.elements) {
      names.add((element.propertyName ?? element.name).text);
    }
  }

  return names;
}

function isSchemaStructCall(expression) {
  return ts.isCallExpression(expression)
    && ts.isPropertyAccessExpression(expression.expression)
    && expression.expression.expression.getText() === "Schema"
    && expression.expression.name.text === "Struct";
}
