"use client"
// components/blog/BlogEditor.tsx
// Enriched 3-mode editor: Rich Text (WYSIWYG) + Markdown + HTML — like Homverax.
// No external editor library needed — pure contenteditable + execCommand for rich mode,
// toolbar-assisted textarea for markdown/html, with live preview for both.

import { useRef, useState, useEffect, useCallback } from "react"
import {
  Bold, Italic, Heading2, Heading3, List, ListOrdered, Link as LinkIcon,
  Image as ImageIcon, Quote, Minus, Type, AlignLeft, Code2, Eye, Edit3,
  Upload, Loader2,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { StorageService } from "@/src/services"
import { useToast } from "@/components/ui/use-toast"

interface BlogEditorProps {
  value: string
  onChange: (html: string) => void
  minHeight?: number
}

// ─── Editor mode ──────────────────────────────────────────────────────────
type EditorMode = "rich" | "markdown" | "html"

// ─── Toolbar action (for markdown / html textarea modes) ──────────────────
interface ToolbarAction {
  icon: React.ElementType
  title: string
  action: (selected: string) => string
  wrapLine?: boolean // prefix/insert on its own line
}

const MARKDOWN_TOOLBAR: ToolbarAction[] = [
  { icon: Bold,        title: "Bold",          action: (s) => `**${s || "bold text"}**` },
  { icon: Italic,      title: "Italic",        action: (s) => `*${s || "italic text"}*` },
  { icon: Heading2,    title: "Heading 2",     action: (s) => `## ${s || "Section heading"}`, wrapLine: true },
  { icon: Heading3,    title: "Heading 3",     action: (s) => `### ${s || "Sub-heading"}`, wrapLine: true },
  { icon: List,        title: "Bullet list",   action: () => `- First item\n- Second item\n- Third item`, wrapLine: true },
  { icon: ListOrdered, title: "Numbered list", action: () => `1. First\n2. Second\n3. Third`, wrapLine: true },
  { icon: Quote,       title: "Blockquote",    action: (s) => `> ${s || "Quote text here"}`, wrapLine: true },
  { icon: LinkIcon,    title: "Link",          action: (s) => `[${s || "link text"}](URL)` },
  { icon: ImageIcon,   title: "Image",         action: () => `![Description](https://example.com/image.jpg)`, wrapLine: true },
  { icon: Minus,       title: "Divider",       action: () => `---`, wrapLine: true },
]

const HTML_TOOLBAR: ToolbarAction[] = [
  { icon: Bold,        title: "strong tag",   action: (s) => `<strong>${s || "bold"}</strong>` },
  { icon: Italic,      title: "em tag",       action: (s) => `<em>${s || "italic"}</em>` },
  { icon: Heading2,    title: "h2 tag",       action: (s) => `<h2>${s || "Heading"}</h2>`, wrapLine: true },
  { icon: Heading3,    title: "h3 tag",       action: (s) => `<h3>${s || "Heading"}</h3>`, wrapLine: true },
  { icon: List,        title: "ul list",      action: () => `<ul>\n  <li>Item</li>\n  <li>Item</li>\n</ul>`, wrapLine: true },
  { icon: ListOrdered, title: "ol list",      action: () => `<ol>\n  <li>Item</li>\n  <li>Item</li>\n</ol>`, wrapLine: true },
  { icon: Quote,       title: "blockquote",  action: (s) => `<blockquote>${s || "Quote"}</blockquote>`, wrapLine: true },
  { icon: LinkIcon,    title: "a tag",        action: (s) => `<a href="URL">${s || "link"}</a>` },
  { icon: ImageIcon,   title: "img tag",      action: () => `<img src="URL" alt="description" />`, wrapLine: true },
  { icon: Minus,       title: "hr tag",       action: () => `<hr />`, wrapLine: true },
]

// ─── Render content for preview ────────────────────────────────────────────
function renderContent(content: string, mode: EditorMode): string {
  if (mode === "html" || mode === "rich") {
    return content // already HTML
  }
  // Markdown → basic HTML conversion for preview
  return content
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>")
    .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
    .replace(/^---$/gm, "<hr />")
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    .replace(/!\[(.+?)\]\((.+?)\)/g, '<img src="$2" alt="$1" />')
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[h|b|u|o|l|p|h|b|i|a|d|q|h])(.+)$/gm, "<p>$1</p>")
}

// ─── Placeholder per editor mode ───────────────────────────────────────────
const PLACEHOLDERS: Record<EditorMode, string> = {
  rich: "",
  markdown: `## Introduction

Write your article here. Use **bold**, *italic*, and [links](URL).

## Main Section

Explain your topic with clear paragraphs.

- Key point one
- Key point two
- Key point three

## Conclusion

Wrap up with a clear takeaway for the reader.`,
  html: `<h2>Introduction</h2>
<p>Write your article here. Full HTML is supported.</p>

<h2>Main Section</h2>
<p>Use any HTML tags you need.</p>

<ul>
  <li>Key point one</li>
  <li>Key point two</li>
</ul>

<h2>Conclusion</h2>
<p>Wrap up your article here.</p>`,
}

const EDITOR_MODE_CONFIG: { value: EditorMode; label: string; icon: React.ElementType; description: string }[] = [
  { value: "rich",     label: "Rich Text", icon: AlignLeft, description: "WYSIWYG — see formatting as you type" },
  { value: "markdown", label: "Markdown",  icon: Type,      description: "Lightweight syntax for writers" },
  { value: "html",     label: "HTML",      icon: Code2,     description: "Full HTML control for developers" },
]

export function BlogEditor({ value, onChange, minHeight = 400 }: BlogEditorProps) {
  const textareaRef   = useRef<HTMLTextAreaElement>(null)
  const richEditorRef = useRef<HTMLDivElement>(null)
  const contentImageInputRef = useRef<HTMLInputElement>(null)

  const [editorMode, setEditorMode] = useState<EditorMode>("rich")
  const [activeView, setActiveView] = useState<"write" | "preview">("write")
  const [content, setContent]       = useState(value)
  const [uploadingContentImage, setUploadingContentImage] = useState(false)

  const { toast } = useToast()

  // Keep local content in sync if the parent resets `value` (e.g. loading an existing post)
  useEffect(() => {
    setContent(value)
    if (richEditorRef.current && editorMode === "rich") {
      richEditorRef.current.innerHTML = value
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally only on mount

  // Word count / reading time — used in toolbars
  const wordCount = content.replace(/<[^>]+>/g, " ").trim().split(/\s+/).filter(Boolean).length
  const readingTime = Math.max(1, Math.ceil(wordCount / 200))

  const pushChange = useCallback((html: string) => {
    setContent(html)
    onChange(html)
  }, [onChange])

  // ── Rich editor (contentEditable) exec commands ──────────────────────────
  const execRich = (command: string, val?: string) => {
    document.execCommand(command, false, val)
    richEditorRef.current?.focus()
    if (richEditorRef.current) {
      pushChange(richEditorRef.current.innerHTML)
    }
  }

  const handleRichEditorInput = () => {
    if (richEditorRef.current) {
      pushChange(richEditorRef.current.innerHTML)
    }
  }

  const insertRichImage = () => {
    const url = window.prompt("Image URL (or click Upload Image to upload from device):")
    if (!url) return
    execRich("insertHTML", `<img src="${url.trim()}" alt="" style="max-width:100%;border-radius:8px;" />`)
  }

  // Upload a file from disk into the post body — works for all three editor modes
  const handleContentImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""

    setUploadingContentImage(true)
    try {
      const path = `blog/content/${Date.now()}_${file.name}`
      const { url } = await StorageService.uploadFile(file, path)

      if (editorMode === "rich") {
        execRich("insertHTML", `<img src="${url}" alt="${file.name}" style="max-width:100%;border-radius:8px;" />`)
      } else if (editorMode === "markdown") {
        const textarea = textareaRef.current
        const pos = textarea?.selectionStart ?? content.length
        const newContent = `${content.substring(0, pos)}\n![${file.name}](${url})\n${content.substring(pos)}`
        pushChange(newContent)
      } else {
        // html mode
        const textarea = textareaRef.current
        const pos = textarea?.selectionStart ?? content.length
        const newContent = `${content.substring(0, pos)}\n<img src="${url}" alt="${file.name}" style="max-width:100%;border-radius:8px;" />\n${content.substring(pos)}`
        pushChange(newContent)
      }
      toast({ title: "Image uploaded ✅" })
    } catch (err: any) {
      console.error("Content image upload failed:", err)
      toast({ title: "Upload failed", description: err?.message, variant: "destructive" })
    } finally {
      setUploadingContentImage(false)
    }
  }, [editorMode, content, pushChange, toast])

  const insertRichLink = () => {
    const url = window.prompt("Enter URL:")
    if (url) execRich("createLink", url.trim())
  }

  const RICH_EXEC_TOOLBAR: { icon: React.ElementType; title: string; exec: () => void }[] = [
    { icon: Bold,        title: "Bold",          exec: () => execRich("bold") },
    { icon: Italic,      title: "Italic",        exec: () => execRich("italic") },
    { icon: Heading2,    title: "Heading 2",     exec: () => execRich("formatBlock", "h2") },
    { icon: Heading3,    title: "Heading 3",     exec: () => execRich("formatBlock", "h3") },
    { icon: List,        title: "Bullet list",   exec: () => execRich("insertUnorderedList") },
    { icon: ListOrdered, title: "Numbered list", exec: () => execRich("insertOrderedList") },
    { icon: Quote,       title: "Blockquote",    exec: () => execRich("formatBlock", "blockquote") },
    { icon: LinkIcon,    title: "Insert link",   exec: insertRichLink },
    { icon: ImageIcon,   title: "Insert image",  exec: insertRichImage },
    { icon: Minus,       title: "Divider",       exec: () => execRich("insertHorizontalRule") },
    { icon: Type,        title: "Paragraph",     exec: () => execRich("formatBlock", "p") },
  ]

  // ── Toolbar insert (for markdown + html textarea modes) ──────────────────
  const handleToolbarInsert = useCallback((action: ToolbarAction) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = content.substring(start, end)
    const inserted = action.action(selected)
    const before = content.substring(0, start)
    const after = content.substring(end)
    const newContent = action.wrapLine
      ? `${before}\n${inserted}\n${after}`
      : `${before}${inserted}${after}`
    pushChange(newContent)

    setTimeout(() => {
      textarea.focus()
      const newPos = start + inserted.length + (action.wrapLine ? 2 : 0)
      textarea.setSelectionRange(newPos, newPos)
    }, 0)
  }, [content, pushChange])

  // When switching modes, keep the rich editor's DOM synced with content
  useEffect(() => {
    if (editorMode === "rich" && richEditorRef.current) {
      richEditorRef.current.innerHTML = content
    }
    setActiveView("write")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorMode])

  const activeToolbar = editorMode === "markdown" ? MARKDOWN_TOOLBAR : HTML_TOOLBAR

  return (
    <div className="rounded-xl border border-white/10 overflow-hidden bg-[#0f0f14]">
      {/* Top bar: mode switcher */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-white/5 flex-wrap gap-2">
        <span className="text-white/40 text-xs font-medium">Editor</span>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 bg-black/30 p-0.5 rounded-lg">
            {EDITOR_MODE_CONFIG.map(({ value, label, icon: Icon, description }) => (
              <button
                key={value}
                type="button"
                title={description}
                onClick={() => setEditorMode(value)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all",
                  editorMode === value ? "bg-primary text-white" : "text-white/40 hover:text-white"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
          {editorMode !== "rich" && (
            <button
              type="button"
              onClick={() => setActiveView(activeView === "write" ? "preview" : "write")}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline px-1"
            >
              {activeView === "write" ? <Eye className="h-3 w-3" /> : <Edit3 className="h-3 w-3" />}
              {activeView === "write" ? "Preview" : "Edit"}
            </button>
          )}
        </div>
      </div>

      {/* ── RICH TEXT MODE ──────────────────────────────────────────────── */}
      {editorMode === "rich" && (
        <>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-0.5 p-2 border-b border-white/10 bg-white/[0.02]">
            {RICH_EXEC_TOOLBAR.map((tool) => {
              const Icon = tool.icon
              return (
                <button
                  key={tool.title}
                  type="button"
                  title={tool.title}
                  onMouseDown={(e) => { e.preventDefault(); tool.exec() }}
                  className="p-1.5 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <Icon className="h-4 w-4" />
                </button>
              )
            })}
            {/* Hidden file input — triggered by the Upload button below */}
            <input
              ref={contentImageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleContentImageUpload}
              disabled={uploadingContentImage}
            />
            <div className="w-px h-4 bg-white/10 mx-1" />
            <button
              type="button"
              title="Upload image from device"
              disabled={uploadingContentImage}
              onMouseDown={(e) => { e.preventDefault(); contentImageInputRef.current?.click() }}
              className="flex items-center gap-1 px-2 py-1 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors text-[11px] disabled:opacity-40 disabled:pointer-events-none"
            >
              {uploadingContentImage
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Upload className="h-3.5 w-3.5" />}
              {uploadingContentImage ? "Uploading…" : "Upload image"}
            </button>
            <div className="ml-auto text-[10px] text-white/30 px-2 whitespace-nowrap">
              ~{wordCount} words · {readingTime} min read
            </div>
          </div>

          {/* ContentEditable area */}
          <div
            ref={richEditorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleRichEditorInput}
            style={{ minHeight }}
            data-placeholder={!content ? "Start writing your article… Use the toolbar above to format." : ""}
            className="p-4 text-white/80 text-sm leading-relaxed outline-none
              [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-white [&_h1]:mb-3 [&_h1]:mt-4
              [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-white [&_h2]:mb-2 [&_h2]:mt-4
              [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-white [&_h3]:mb-2 [&_h3]:mt-3
              [&_p]:mb-3 [&_p]:leading-relaxed
              [&_a]:text-primary [&_a]:underline
              [&_strong]:text-white [&_strong]:font-bold
              [&_em]:italic
              [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ul]:space-y-1
              [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_ol]:space-y-1
              [&_li]:text-white/70
              [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:text-white/60 [&_blockquote]:italic [&_blockquote]:my-4
              [&_code]:bg-white/10 [&_code]:text-primary [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono
              [&_hr]:border-white/10 [&_hr]:my-4
              [&_img]:max-w-full [&_img]:rounded-lg [&_img]:my-3"
          />
          <style>{`
            [contenteditable]:empty:before {
              content: attr(data-placeholder);
              color: rgba(255,255,255,0.25);
              pointer-events: none;
            }
          `}</style>
        </>
      )}

      {/* ── MARKDOWN / HTML MODE ────────────────────────────────────────── */}
      {editorMode !== "rich" && (
        <>
          {activeView === "write" && (
            <div className="flex flex-wrap items-center gap-0.5 p-2 border-b border-white/10 bg-white/[0.02]">
              {activeToolbar.map((tool) => {
                const Icon = tool.icon
                return (
                  <button
                    key={tool.title}
                    type="button"
                    title={tool.title}
                    onClick={() => handleToolbarInsert(tool)}
                    className="p-1.5 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Icon className="h-4 w-4" />
                  </button>
                )
              })}
              <div className="w-px h-4 bg-white/10 mx-1" />
              <button
                type="button"
                title="Upload image from device"
                disabled={uploadingContentImage}
                onClick={() => contentImageInputRef.current?.click()}
                className="flex items-center gap-1 px-2 py-1 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors text-[11px] disabled:opacity-40 disabled:pointer-events-none"
              >
                {uploadingContentImage
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  : <Upload className="h-3.5 w-3.5" />}
                {uploadingContentImage ? "Uploading…" : "Upload image"}
              </button>
              <div className="ml-auto text-[10px] text-white/30 px-2 whitespace-nowrap">
                ~{wordCount} words · {readingTime} min read
              </div>
            </div>
          )}

          {activeView === "write" ? (
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => pushChange(e.target.value)}
              placeholder={PLACEHOLDERS[editorMode]}
              style={{ minHeight }}
              className={cn(
                "w-full p-4 bg-transparent text-sm leading-relaxed outline-none resize-y placeholder:text-white/20",
                editorMode === "html" ? "text-green-400 font-mono text-xs" : "text-white/80"
              )}
              spellCheck={editorMode === "markdown"}
            />
          ) : (
            <div
              style={{ minHeight }}
              className="p-4 prose prose-sm prose-invert max-w-none text-sm
                [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:text-white [&_h1]:mb-3 [&_h1]:mt-4
                [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-white [&_h2]:mb-2 [&_h2]:mt-4
                [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-white [&_h3]:mb-2 [&_h3]:mt-3
                [&_p]:text-white/70 [&_p]:mb-3 [&_p]:leading-relaxed
                [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-white/70 [&_ul]:mb-3
                [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:text-white/70 [&_ol]:mb-3
                [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-white/60
                [&_a]:text-primary [&_a]:underline
                [&_hr]:border-white/10 [&_hr]:my-4
                [&_strong]:text-white [&_strong]:font-semibold
                [&_img]:rounded-lg [&_img]:max-w-full [&_img]:my-3"
              dangerouslySetInnerHTML={{
                __html: renderContent(content, editorMode) || `<p class="text-white/20">Nothing to preview yet.</p>`,
              }}
            />
          )}
        </>
      )}

      {/* Footer hint */}
      <div className="px-3 py-1.5 border-t border-white/5 bg-white/[0.01]">
        <p className="text-white/20 text-[10px]">
          {editorMode === "rich" && "Rich Text — format like a WYSIWYG editor. Switch modes above for Markdown or raw HTML."}
          {editorMode === "markdown" && "Markdown mode — use toolbar buttons or type Markdown syntax directly. Toggle Preview to see rendered output."}
          {editorMode === "html" && "HTML mode — write raw HTML for full control. Toggle Preview to see rendered output."}
        </p>
      </div>
    </div>
  )
}
