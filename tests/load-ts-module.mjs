import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import ts from "typescript";

function resolveAliasTarget(relPath) {
  const base = resolve(relPath);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, resolve(relPath, "index.ts")];
  return candidates.find((item) => existsSync(item)) ?? base;
}

export async function loadTsModule(pathFromRoot) {
  const filePath = resolve(pathFromRoot);
  let source = await readFile(filePath, "utf8");
  source = source.replace(/from\s+["']@\/([^"']+)["']/g, (_match, rel) => `from "${pathToFileURL(resolveAliasTarget(rel)).href}"`);

  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filePath,
  });

  const encoded = encodeURIComponent(transpiled.outputText);
  return import(`data:text/javascript;charset=utf-8,${encoded}`);
}
