#!/usr/bin/env node
/**
 * Fast JSX/TSX syntax gate used by the UI cleanup.
 *
 * `npm run build` is the authoritative check, but it is slow on constrained
 * machines. This script parses the given files with the same Babel parser the
 * CRA toolchain uses and fails on the first syntax error, so a broken component
 * is caught before an expensive build.
 *
 * Usage:
 *   node scripts/verify/jsx-parse.mjs src/components/shared/ui/index.js
 *   node scripts/verify/jsx-parse.mjs "src/components/**\/*.jsx"
 *
 * Note: this checks *syntax only*. It does not resolve imports or types.
 */
import { readFileSync } from "node:fs";
import { globSync } from "node:fs";
import path from "node:path";
import { parse } from "@babel/parser";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Pass at least one file or glob pattern.");
  process.exit(2);
}

const files = [];
for (const pattern of args) {
  if (pattern.includes("*")) {
    // Node >= 22 exposes globSync on fs.
    for (const match of globSync(pattern, { cwd: process.cwd() })) files.push(match);
  } else {
    files.push(pattern);
  }
}

const unique = [...new Set(files)];
let failures = 0;
let parsed = 0;

for (const file of unique) {
  const absolute = path.resolve(process.cwd(), file);
  let source;
  try {
    source = readFileSync(absolute, "utf8");
  } catch (error) {
    failures += 1;
    console.error(`MISSING ${file}: ${error.message}`);
    continue;
  }

  const isTypeScript = /\.tsx?$/.test(file);
  try {
    parse(source, {
      sourceType: "module",
      // `.js` files in this repo may still contain JSX; CRA's preset allows it.
      plugins: [
        "jsx",
        "classProperties",
        "objectRestSpread",
        "optionalChaining",
        "nullishCoalescingOperator",
        "dynamicImport",
        "topLevelAwait",
        ...(isTypeScript ? ["typescript"] : []),
      ],
      errorRecovery: false,
      attachComment: false,
    });
    parsed += 1;
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${file}: ${error.message}`);
  }
}

console.log(`\nParsed ${parsed}/${unique.length} file(s); ${failures} failure(s).`);
process.exit(failures === 0 ? 0 : 1);
