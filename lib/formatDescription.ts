/**
 * Formats a plain-text listing description into structured HTML-like blocks
 * without requiring a rich text editor or any change to how sellers write
 * descriptions today. Detects common patterns sellers already use:
 *
 *   Features:
 *   1. Some feature description that can run
 *      across multiple lines.
 *   2. Another feature.
 *
 * and turns them into a heading + ordered list. Also detects bullet markers
 * (-, *, •) and short ALL-CAPS or "Word:" style lines as sub-headers.
 *
 * This is intentionally conservative: if a description doesn't match any
 * recognizable pattern, it falls back to plain paragraphs (never worse than
 * today's whitespace-pre-line rendering).
 */

export type DescriptionBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "ordered-list"; items: string[] }
  | { type: "unordered-list"; items: string[] }

const HEADING_RE = /^([A-Z][A-Za-z /&]{2,30}):\s*$/          // "Features:" / "Specifications:"
const NUMBERED_RE = /^\s*(\d{1,2})[.)]\s+(.*)$/                // "1. text" / "1) text"
const BULLET_RE = /^\s*[-*•]\s+(.*)$/                          // "- text" / "* text" / "• text"

export function formatDescription(raw: string): DescriptionBlock[] {
  if (!raw?.trim()) return []

  // Normalize line endings and split into logical lines.
  const rawLines = raw.replace(/\r\n/g, "\n").split("\n")

  // Merge lines that are obviously a continuation of the previous
  // numbered/bulleted item (i.e. a line that doesn't start a new pattern
  // and doesn't look like a blank separator) into that item's text.
  const lines: string[] = []
  for (const line of rawLines) {
    const trimmed = line.trim()
    const startsNewItem =
      trimmed === "" ||
      HEADING_RE.test(trimmed) ||
      NUMBERED_RE.test(trimmed) ||
      BULLET_RE.test(trimmed)

    if (!startsNewItem && lines.length > 0 && lines[lines.length - 1] !== "") {
      lines[lines.length - 1] = `${lines[lines.length - 1]} ${trimmed}`.trim()
    } else {
      lines.push(trimmed)
    }
  }

  const blocks: DescriptionBlock[] = []
  let currentList: { type: "ordered-list" | "unordered-list"; items: string[] } | null = null
  let paragraphBuffer: string[] = []

  const flushParagraph = () => {
    if (paragraphBuffer.length > 0) {
      const text = paragraphBuffer.join(" ").trim()
      if (text) blocks.push({ type: "paragraph", text })
      paragraphBuffer = []
    }
  }
  const flushList = () => {
    if (currentList && currentList.items.length > 0) blocks.push(currentList)
    currentList = null
  }

  for (const line of lines) {
    if (line === "") {
      flushParagraph()
      flushList()
      continue
    }

    const headingMatch = HEADING_RE.exec(line)
    if (headingMatch) {
      flushParagraph()
      flushList()
      blocks.push({ type: "heading", text: headingMatch[1] })
      continue
    }

    const numberedMatch = NUMBERED_RE.exec(line)
    if (numberedMatch) {
      flushParagraph()
      if (currentList?.type !== "ordered-list") { flushList(); currentList = { type: "ordered-list", items: [] } }
      currentList.items.push(numberedMatch[2])
      continue
    }

    const bulletMatch = BULLET_RE.exec(line)
    if (bulletMatch) {
      flushParagraph()
      if (currentList?.type !== "unordered-list") { flushList(); currentList = { type: "unordered-list", items: [] } }
      currentList.items.push(bulletMatch[1])
      continue
    }

    // Plain text line — belongs to a paragraph, unless we're mid-list in
    // which case treat it as a continuation of the previous list item
    // (defensive; the merge pass above should normally have caught this).
    if (currentList && currentList.items.length > 0) {
      currentList.items[currentList.items.length - 1] += ` ${line}`
    } else {
      paragraphBuffer.push(line)
    }
  }

  flushParagraph()
  flushList()

  return blocks
}
