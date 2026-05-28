"use client"
// components/blog/BlogEditor.tsx
// Dual-mode editor: Visual (WYSIWYG toolbar) + Raw HTML — like WordPress.
// No external editor library needed — pure contenteditable + execCommand for visual mode.

import { useRef, useState, useEffect, useCallback } from "react"
import {
  Bold, Italic, Underline, Strikethrough, AlignLeft, AlignCenter, AlignRight,
  List, ListOrdered, Link2, Image, Quote, Heading1, Heading2, Heading3,
  Code, Minus, Undo, Redo, Eye, Code2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface BlogEditorProps {
  value: string
  onChange: (html: string) => void
  minHeight?: number
}

type Mode = "visual" | "html"

interface ToolbarButton {
  icon: React.ReactNode
  title: string
  action: () => void
  isActive?: boolean
}

export function BlogEditor({ value, onChange, minHeight = 400 }: BlogEditorProps) {
  const editorRef   = useRef<HTMLDivElement>(null)
  const [mode, setMode]           = useState<Mode>("visual")
  const [htmlValue, setHtmlValue] = useState(value)
  const [linkUrl, setLinkUrl]     = useState("")
  const [showLink, setShowLink]   = useState(false)
  const [imgUrl, setImgUrl]       = useState("")
  const [showImg, setShowImg]     = useState(false)

  // Sync external value → editor on first load
  useEffect(() => {
    if (editorRef.current && mode === "visual") {
      editorRef.current.innerHTML = value
    }
    setHtmlValue(value)
  }, []) // intentionally only on mount

  // Switch modes
  const switchToHtml = () => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML
      setHtmlValue(html)
      onChange(html)
    }
    setMode("html")
  }

  const switchToVisual = () => {
    setMode("visual")
    // Sync textarea → editor after render
    setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = htmlValue
      }
    }, 0)
  }

  const handleEditorInput = useCallback(() => {
    if (editorRef.current) {
      const html = editorRef.current.innerHTML
      setHtmlValue(html)
      onChange(html)
    }
  }, [onChange])

  const handleHtmlChange = (val: string) => {
    setHtmlValue(val)
    onChange(val)
  }

  const exec = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value)
    editorRef.current?.focus()
    handleEditorInput()
  }

  const insertHtml = (html: string) => {
    editorRef.current?.focus()
    document.execCommand("insertHTML", false, html)
    handleEditorInput()
  }

  const handleInsertLink = () => {
    if (!linkUrl.trim()) return
    exec("createLink", linkUrl.trim())
    setLinkUrl("")
    setShowLink(false)
  }

  const handleInsertImage = () => {
    if (!imgUrl.trim()) return
    insertHtml(`<img src="${imgUrl.trim()}" alt="" style="max-width:100%;border-radius:8px;" />`)
    setImgUrl("")
    setShowImg(false)
  }

  const toolbarGroups: ToolbarButton[][] = [
    // History
    [
      { icon: <Undo className="h-4 w-4" />, title: "Undo", action: () => exec("undo") },
      { icon: <Redo className="h-4 w-4" />, title: "Redo", action: () => exec("redo") },
    ],
    // Headings
    [
      { icon: <Heading1 className="h-4 w-4" />, title: "Heading 1", action: () => exec("formatBlock", "h1") },
      { icon: <Heading2 className="h-4 w-4" />, title: "Heading 2", action: () => exec("formatBlock", "h2") },
      { icon: <Heading3 className="h-4 w-4" />, title: "Heading 3", action: () => exec("formatBlock", "h3") },
    ],
    // Inline formatting
    [
      { icon: <Bold className="h-4 w-4" />,          title: "Bold",          action: () => exec("bold") },
      { icon: <Italic className="h-4 w-4" />,        title: "Italic",        action: () => exec("italic") },
      { icon: <Underline className="h-4 w-4" />,     title: "Underline",     action: () => exec("underline") },
      { icon: <Strikethrough className="h-4 w-4" />, title: "Strikethrough", action: () => exec("strikeThrough") },
      { icon: <Code className="h-4 w-4" />,          title: "Inline Code",   action: () => insertHtml("<code>code</code>") },
    ],
    // Alignment
    [
      { icon: <AlignLeft className="h-4 w-4" />,   title: "Align Left",   action: () => exec("justifyLeft") },
      { icon: <AlignCenter className="h-4 w-4" />, title: "Align Center", action: () => exec("justifyCenter") },
      { icon: <AlignRight className="h-4 w-4" />,  title: "Align Right",  action: () => exec("justifyRight") },
    ],
    // Lists & blocks
    [
      { icon: <List className="h-4 w-4" />,        title: "Bullet List",  action: () => exec("insertUnorderedList") },
      { icon: <ListOrdered className="h-4 w-4" />, title: "Numbered List",action: () => exec("insertOrderedList") },
      { icon: <Quote className="h-4 w-4" />,       title: "Blockquote",   action: () => exec("formatBlock", "blockquote") },
      { icon: <Minus className="h-4 w-4" />,       title: "Divider",      action: () => insertHtml("<hr/>") },
    ],
    // Media & links
    [
      { icon: <Link2 className="h-4 w-4" />, title: "Insert Link",  action: () => { setShowLink(s => !s); setShowImg(false) } },
      { icon: <Image className="h-4 w-4" />, title: "Insert Image (URL)", action: () => { setShowImg(s => !s); setShowLink(false) } },
    ],
  ]

  return (
    <div className="rounded-xl border border-white/10 overflow-hidden bg-[#0f0f14]">
      {/* Top bar: mode switcher */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-white/5">
        <span className="text-white/40 text-xs font-medium">Editor</span>
        <div className="flex gap-1">
          <button
            onClick={switchToVisual}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all
              ${mode === "visual" ? "bg-primary text-white" : "text-white/40 hover:text-white"}`}
          >
            <Eye className="h-3.5 w-3.5" /> Visual
          </button>
          <button
            onClick={switchToHtml}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all
              ${mode === "html" ? "bg-primary text-white" : "text-white/40 hover:text-white"}`}
          >
            <Code2 className="h-3.5 w-3.5" /> HTML
          </button>
        </div>
      </div>

      {/* Toolbar — only in visual mode */}
      {mode === "visual" && (
        <div className="flex flex-wrap gap-1 p-2 border-b border-white/10 bg-white/[0.02]">
          {toolbarGroups.map((group, gi) => (
            <div key={gi} className="flex gap-0.5">
              {group.map((btn, bi) => (
                <button
                  key={bi}
                  title={btn.title}
                  onMouseDown={e => { e.preventDefault(); btn.action() }}
                  className="p-1.5 rounded text-white/60 hover:text-white hover:bg-white/10 transition-colors"
                >
                  {btn.icon}
                </button>
              ))}
              {gi < toolbarGroups.length - 1 && (
                <div className="w-px bg-white/10 mx-1 self-stretch" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Link input popup */}
      {showLink && mode === "visual" && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-white/5">
          <Link2 className="h-4 w-4 text-white/40 flex-shrink-0" />
          <Input
            value={linkUrl}
            onChange={e => setLinkUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleInsertLink()}
            placeholder="https://..."
            className="h-7 text-xs bg-transparent border-white/20 text-white placeholder:text-white/30 flex-1"
          />
          <Button size="sm" onClick={handleInsertLink} className="h-7 text-xs px-3">Insert</Button>
          <button onClick={() => setShowLink(false)} className="text-white/40 hover:text-white text-xs">✕</button>
        </div>
      )}

      {/* Image URL input popup */}
      {showImg && mode === "visual" && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-white/5">
          <Image className="h-4 w-4 text-white/40 flex-shrink-0" />
          <Input
            value={imgUrl}
            onChange={e => setImgUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleInsertImage()}
            placeholder="https://example.com/image.jpg"
            className="h-7 text-xs bg-transparent border-white/20 text-white placeholder:text-white/30 flex-1"
          />
          <Button size="sm" onClick={handleInsertImage} className="h-7 text-xs px-3">Insert</Button>
          <button onClick={() => setShowImg(false)} className="text-white/40 hover:text-white text-xs">✕</button>
        </div>
      )}

      {/* Visual editor area */}
      {mode === "visual" && (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleEditorInput}
          style={{ minHeight }}
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
      )}

      {/* HTML mode textarea */}
      {mode === "html" && (
        <textarea
          value={htmlValue}
          onChange={e => handleHtmlChange(e.target.value)}
          style={{ minHeight }}
          className="w-full p-4 bg-transparent text-green-400 text-xs font-mono leading-relaxed outline-none resize-y"
          placeholder="<p>Write your HTML here...</p>"
          spellCheck={false}
        />
      )}

      {/* Footer hint */}
      <div className="px-3 py-1.5 border-t border-white/5 bg-white/[0.01]">
        <p className="text-white/20 text-[10px]">
          {mode === "visual"
            ? "Visual editor — format text like WordPress. Switch to HTML for raw control."
            : "HTML mode — write raw HTML. Switch to Visual to use the toolbar."}
        </p>
      </div>
    </div>
  )
}
