/**
 * Wikilink → Obsidian URI conversion.
 *
 * Recognises Obsidian-style `[[file/path]]` and `[[file/path|alias]]` and turns
 * them into standard Markdown links pointing at the `obsidian://` protocol so
 * react-markdown can render them as clickable anchors.
 */

const DEFAULT_VAULT = "Paperclip-MSPRO-org";

export interface WikilinkOptions {
  /** Override Obsidian vault name. Defaults to "Paperclip-MSPRO-org". */
  vault?: string;
}

export function obsidianHref(filepath: string, vault: string = DEFAULT_VAULT): string {
  const params = new URLSearchParams({ vault, file: filepath });
  return `obsidian://open?${params.toString()}`;
}

/**
 * Replace `[[file/path]]` and `[[file/path|alias]]` with markdown links.
 * - `[[a/b]]`        → `[a/b](obsidian://open?vault=…&file=a/b)`
 * - `[[a/b|alias]]`  → `[alias](obsidian://open?vault=…&file=a/b)`
 *
 * Skips occurrences inside fenced/inline code blocks.
 */
export function replaceWikilinks(markdown: string, options: WikilinkOptions = {}): string {
  const vault = options.vault ?? DEFAULT_VAULT;
  if (!markdown) return markdown;

  // Split by code fences first so we don't transform anything inside ``` … ```.
  const fenceRe = /```[\s\S]*?```/g;
  const parts: string[] = [];
  let lastIndex = 0;
  for (const match of markdown.matchAll(fenceRe)) {
    parts.push(transformOutsideCode(markdown.slice(lastIndex, match.index ?? 0), vault));
    parts.push(match[0]); // leave fenced block as-is
    lastIndex = (match.index ?? 0) + match[0].length;
  }
  parts.push(transformOutsideCode(markdown.slice(lastIndex), vault));
  return parts.join("");
}

function transformOutsideCode(chunk: string, vault: string): string {
  // Also avoid transforming inline code spans `…`
  const inlineRe = /`[^`\n]*`/g;
  const subParts: string[] = [];
  let cursor = 0;
  for (const match of chunk.matchAll(inlineRe)) {
    subParts.push(transformWikilinks(chunk.slice(cursor, match.index ?? 0), vault));
    subParts.push(match[0]);
    cursor = (match.index ?? 0) + match[0].length;
  }
  subParts.push(transformWikilinks(chunk.slice(cursor), vault));
  return subParts.join("");
}

function transformWikilinks(text: string, vault: string): string {
  return text.replace(/\[\[([^\]\n|]+)(?:\|([^\]\n]+))?\]\]/g, (_full, target: string, alias?: string) => {
    const filepath = target.trim();
    const label = (alias ?? target).trim();
    return `[${label}](${obsidianHref(filepath, vault)})`;
  });
}
