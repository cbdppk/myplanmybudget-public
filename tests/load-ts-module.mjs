import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

function resolveAliasTarget(relPath) {
  const base = resolve(relPath);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, resolve(relPath, "index.ts")];
  return candidates.find((item) => existsSync(item)) ?? base;
}

const moduleUrlCache = new Map();

const ALIAS_IMPORT_RE = /from\s+["']@\/([^"']+)["']/g;

// Transpile a TS module (and, recursively, its "@/..." dependencies) into
// data: URLs so node --test can import project modules without a build step.
// Bare package imports are left alone; TypeScript's import elision drops the
// type-only ones (e.g. Prisma types) during transpilation.
async function buildModuleUrl(filePath) {
  const cached = moduleUrlCache.get(filePath);
  if (cached) return cached;

  let source = await readFile(filePath, "utf8");

  const aliasTargets = new Map();
  for (const match of source.matchAll(ALIAS_IMPORT_RE)) {
    const rel = match[1];
    if (!aliasTargets.has(rel)) aliasTargets.set(rel, resolveAliasTarget(rel));
  }
  const urlByRel = new Map();
  for (const [rel, target] of aliasTargets) {
    urlByRel.set(rel, await buildModuleUrl(target));
  }
  source = source.replace(ALIAS_IMPORT_RE, (_match, rel) => `from "${urlByRel.get(rel)}"`);

  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
    fileName: filePath,
  });

  const url = `data:text/javascript;charset=utf-8,${encodeURIComponent(transpiled.outputText)}`;
  moduleUrlCache.set(filePath, url);
  return url;
}

export async function loadTsModule(pathFromRoot) {
  return import(await buildModuleUrl(resolve(pathFromRoot)));
}
