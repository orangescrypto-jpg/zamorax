"use client"

import { useState, useRef } from "react"
import { Bold, Italic, Heading2, Heading3, List, Quote, Code, Image, Eye, Edit3, Link as LinkIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface RichBlogEditorProps {
  value: string
  onChange: (val: string) => void
  placeholder?: string
}

type Tool = { icon: typeof Bold; label: string; syntax: [string, string] | string }

const TOOLS: Tool[] = [
  { icon: Bold,     label: "Bold",       syntax: ["**", "**"] },
  { icon: Italic,   label: "Italic",     syntax: ["_", "_"] },
  { icon: Heading2, label: "Heading 2",  syntax: "## " },
  { icon: Heading3, label: "Heading 3",  syntax: "### " },
  { icon: List,     label: "List",       syntax: "- " },
  { icon: Quote,    label: "Quote",      syntax: "> " },
  { icon: Code,     label: "Code",       syntax: ["`", "`"] },
  { icon: LinkIcon, label: "Link",       syntax: ["[", "](url)"] },
]

function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, "<h3 class='text-lg font-bold mt-4 mb-2'>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2 class='text-xl font-bold mt-6 mb-2'>$1</h2>")
    .replace(/^> (.+)$/gm, "<blockquote class='border-l-4 border-primary pl-4 italic text-muted-foreground my-3'>$1</blockquote>")
    .replace(/^- (.+)$/gm, "<li class='ml-4 list-disc'>$1</li>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/_(.+?)_/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code class='bg-muted px-1 rounded text-sm'>$1</code>")
    .replace(/\[(.+?)\]\((.+?)\)/g, "<a href='$2' class='text-primary underline' target='_blank'>$1</a>")
    .replace(/!\[(.+?)\]\((.+?)\)/g, "<img src='$2' alt='$1' class='rounded-xl max-w-full my-4' />")
    .replace(/\n\n/g, "</p><p class='mb-3'>")
    .replace(/^(?!<[h|b|l|i|p])(.+)$/gm, "<p class='mb-3'>$1</p>")
}

export function RichBlogEditor({ value, onChange, placeholder = "Write your post…" }: RichBlogEditorProps) {
  const [preview, setPreview] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const insertSyntax = (syntax: [string, string] | string) => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = value.slice(start, end)

    let newText: string
    if (Array.isArray(syntax)) {
      newText = value.slice(0, start) + syntax[0] + selected + syntax[1] + value.slice(end)
    } else {
      const lineStart = value.lastIndexOf("\n", start - 1) + 1
      newText = value.slice(0, lineStart) + syntax + value.slice(lineStart)
    }
    onChange(newText)
    setTimeout(() => ta.focus(), 0)
  }

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-3 py-2 bg-muted/50 border-b border-border flex-wrap">
        {TOOLS.map(({ icon: Icon, label, syntax }) => (
          <button
            key={label}
            type="button"
            title={label}
            onClick={() => insertSyntax(syntax)}
            className="p-1.5 rounded-lg hover:bg-background text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPreview(false)}
            className={cn("px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1",
              !preview ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            <Edit3 className="h-3 w-3" /> Edit
          </button>
          <button
            type="button"
            onClick={() => setPreview(true)}
            className={cn("px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1",
              preview ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            <Eye className="h-3 w-3" /> Preview
          </button>
        </div>
      </div>

      {/* Editor / Preview */}
      {preview ? (
        <div
          className="min-h-[300px] p-4 prose prose-sm dark:prose-invert max-w-none text-sm"
          dangerouslySetInnerHTML={{ __html: markdownToHtml(value) || `<p class="text-muted-foreground">${placeholder}</p>` }}
        />
      ) : (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full min-h-[300px] p-4 text-sm bg-background text-foreground resize-none focus:outline-none font-mono"
        />
      )}

      <div className="px-4 py-2 border-t border-border bg-muted/30 flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground">Markdown supported</p>
        <p className="text-[10px] text-muted-foreground">{value.length} chars · ~{Math.ceil(value.split(" ").length / 200)} min read</p>
      </div>
    </div>
  )
}
