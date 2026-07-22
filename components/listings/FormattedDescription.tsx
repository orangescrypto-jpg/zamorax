import { formatDescription } from "@/lib/formatDescription"

export function FormattedDescription({ text }: { text: string }) {
  const blocks = formatDescription(text)

  if (blocks.length === 0) return null

  return (
    <div className="space-y-3">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "heading":
            return (
              <h3 key={i} className="text-sm font-semibold text-foreground pt-1 first:pt-0">
                {block.text}
              </h3>
            )
          case "paragraph":
            return (
              <p key={i} className="text-sm text-muted-foreground leading-relaxed">
                {block.text}
              </p>
            )
          case "ordered-list":
            return (
              <ol key={i} className="list-decimal list-outside pl-5 space-y-1.5 text-sm text-muted-foreground leading-relaxed marker:text-foreground marker:font-medium">
                {block.items.map((item, j) => <li key={j}>{item}</li>)}
              </ol>
            )
          case "unordered-list":
            return (
              <ul key={i} className="list-disc list-outside pl-5 space-y-1.5 text-sm text-muted-foreground leading-relaxed marker:text-foreground">
                {block.items.map((item, j) => <li key={j}>{item}</li>)}
              </ul>
            )
          default:
            return null
        }
      })}
    </div>
  )
}
