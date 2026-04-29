#!/usr/bin/env -S node --import tsx
/**
 * rebrand.ts — Paperclip → MSPro-Ltd Corp rebrand script
 *
 * Replaces all occurrences of Paperclip-branded strings across the repo:
 *   - npm scope:    @paperclipai/  →  @msproltd/
 *   - env vars:     PAPERCLIP_     →  MSPROLTD_
 *   - CLI / org:    paperclipai    →  msproltdai
 *   - PascalCase:   Paperclip      →  MSProLtd
 *   - kebab-case:   paperclip      →  mspro-ltd
 *   - UPPER:        PAPERCLIP      →  MSPROLTD
 *
 * Usage:
 *   tsx scripts/rebrand.ts [--dry-run] [--dir <path>]
 *
 * By default operates on the repo root (parent of scripts/).
 */

import {
  readdirSync,
  readFileSync,
  writeFileSync,
  statSync,
  renameSync,
  mkdirSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ── Configuration ──────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

// Parse CLI args
const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const dirArgIdx = args.indexOf("--dir");
const TARGET_DIR = dirArgIdx >= 0 ? path.resolve(args[dirArgIdx + 1]) : REPO_ROOT;

// Directories and files to skip entirely
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".turbo",
  ".pnpm-store",
  ".cache",
]);

const SKIP_EXTENSIONS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico",
  ".woff", ".woff2", ".ttf", ".eot",
  ".zip", ".tar", ".gz", ".tgz",
  ".pdf", ".bin", ".lock", // pnpm-lock.yaml is text but we skip it to avoid breakage
  ".patch",
]);

// Skip specific files
const SKIP_FILES = new Set([
  "pnpm-lock.yaml",
  "package-lock.json",
  "yarn.lock",
  "rebrand.ts", // skip self
]);

// ── Replacement rules (applied in ORDER — most specific first) ─────────────────

interface ReplacementRule {
  name: string;
  pattern: RegExp;
  replacement: string;
}

const RULES: ReplacementRule[] = [
  // 1. npm scope — must be first (most specific)
  {
    name: "npm-scope",
    pattern: /@paperclipai\//g,
    replacement: "@msproltd/",
  },
  // 2. GitHub org in URLs
  {
    name: "github-org-url",
    pattern: /github\.com\/paperclipai\//g,
    replacement: "github.com/vladimirspecalp-hub/",
  },
  // 3. Skill path prefix  e.g. "paperclipai/paperclip/..."
  {
    name: "skill-org",
    pattern: /"paperclipai\//g,
    replacement: '"msproltdai/',
  },
  // 4. PAPERCLIP_ env vars (UPPER_SNAKE before general PAPERCLIP)
  {
    name: "env-vars",
    pattern: /\bPAPERCLIP_/g,
    replacement: "MSPROLTD_",
  },
  // 5. Bare PAPERCLIP (remaining, e.g. in comments/docs)
  {
    name: "PAPERCLIP-upper",
    pattern: /\bPAPERCLIP\b/g,
    replacement: "MSPROLTD",
  },
  // 6. CLI command `paperclipai` (before generic paperclip)
  {
    name: "cli-paperclipai",
    pattern: /\bpaperclipai\b/g,
    replacement: "msproltdai",
  },
  // 7. PascalCase brand  Paperclip → MSProLtd
  {
    name: "PascalCase",
    pattern: /\bPaperclip\b/g,
    replacement: "MSProLtd",
  },
  // 8. camelCase  paperclip → mspro-ltd  (identifiers in package names, paths)
  {
    name: "kebab-lowercase",
    pattern: /\bpaperclip\b/g,
    replacement: "mspro-ltd",
  },
];

// ── File walking ───────────────────────────────────────────────────────────────

function shouldSkip(filePath: string): boolean {
  const base = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();
  if (SKIP_FILES.has(base)) return true;
  if (SKIP_EXTENSIONS.has(ext)) return true;
  return false;
}

function walkDir(dir: string): string[] {
  const results: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      results.push(...walkDir(full));
    } else if (stat.isFile()) {
      if (!shouldSkip(full)) results.push(full);
    }
  }
  return results;
}

// ── Content replacement ────────────────────────────────────────────────────────

function applyRules(content: string): { result: string; changed: boolean; changes: string[] } {
  let result = content;
  const changes: string[] = [];
  for (const rule of RULES) {
    const before = result;
    result = result.replace(rule.pattern, rule.replacement);
    if (result !== before) {
      // Count matches
      const count = (before.match(rule.pattern) ?? []).length;
      changes.push(`${rule.name}: ${count} replacement(s)`);
    }
  }
  return { result, changed: result !== content, changes };
}

// ── File rename (path contains "paperclip") ────────────────────────────────────

function rebrandPath(filePath: string): string {
  // Apply rename rules to the filename component
  let renamed = filePath;
  for (const rule of RULES) {
    renamed = renamed.replace(rule.pattern, rule.replacement);
  }
  return renamed;
}

// ── Main ───────────────────────────────────────────────────────────────────────

console.log(`\n🔄 MSPro-Ltd Corp Rebrand Script`);
console.log(`   Target: ${TARGET_DIR}`);
console.log(`   Mode:   ${DRY_RUN ? "DRY RUN (no changes written)" : "LIVE"}\n`);

const files = walkDir(TARGET_DIR);
console.log(`Found ${files.length} files to process.\n`);

let totalFiles = 0;
let totalReplacements = 0;
const renamedFiles: { from: string; to: string }[] = [];

for (const filePath of files) {
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    // binary or unreadable — skip
    continue;
  }

  // Skip if content looks binary (null bytes)
  if (content.includes("\0")) continue;

  const { result, changed, changes } = applyRules(content);

  if (changed) {
    totalFiles++;
    totalReplacements += changes.length;
    const rel = path.relative(TARGET_DIR, filePath);
    console.log(`  ✏️  ${rel}`);
    for (const c of changes) {
      console.log(`       └─ ${c}`);
    }
    if (!DRY_RUN) {
      writeFileSync(filePath, result, "utf-8");
    }
  }

  // Check if file path needs renaming
  const newPath = rebrandPath(filePath);
  if (newPath !== filePath) {
    renamedFiles.push({ from: filePath, to: newPath });
  }
}

// Rename files (do after content replacement)
if (renamedFiles.length > 0) {
  console.log(`\nFiles to rename: ${renamedFiles.length}`);
  for (const { from, to } of renamedFiles) {
    const relFrom = path.relative(TARGET_DIR, from);
    const relTo = path.relative(TARGET_DIR, to);
    console.log(`  🏷️  ${relFrom} → ${relTo}`);
    if (!DRY_RUN) {
      try {
        // Ensure target directory exists
        mkdirSync(path.dirname(to), { recursive: true });
        renameSync(from, to);
      } catch (e) {
        console.error(`     ❌ rename failed: ${e}`);
      }
    }
  }
}

console.log(`\n✅ Done.`);
console.log(`   Files modified:  ${totalFiles}`);
console.log(`   Rule hits:       ${totalReplacements}`);
console.log(`   Files renamed:   ${renamedFiles.length}`);
if (DRY_RUN) {
  console.log(`\n⚠️  DRY RUN — no changes were written. Re-run without --dry-run to apply.\n`);
}
