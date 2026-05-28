"use client"
import type { Dispute } from "@/src/types"

import { Badge } from "@/components/ui/badge"

export function DisputeEvidenceViewer({ dispute }: { dispute: Dispute }) {
  const { evidence = [], sellerEvidence = [], categorySpecificNotes = {} } = dispute

  return (
    <div className="space-y-6">
      <div className="p-4 bg-muted/50 rounded-lg">
        <h4 className="font-semibold mb-2">Buyer's Claim Evidence</h4>
        {evidence.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {evidence.map((url: string, i: number) => (
              <img key={i} src={url} alt={`Evidence ${i+1}`} className="rounded border h-32 w-full object-cover cursor-pointer hover:opacity-80 transition" />
            ))}
          </div>
        ) : <p className="text-sm text-muted-foreground">No media uploaded.</p>}
      </div>

      <div className="p-4 bg-muted/50 rounded-lg">
        <h4 className="font-semibold mb-2">Seller's Response Evidence</h4>
        {sellerEvidence.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {sellerEvidence.map((url: string, i: number) => (
              <img key={i} src={url} alt={`Response ${i+1}`} className="rounded border h-32 w-full object-cover cursor-pointer hover:opacity-80 transition" />
            ))}
          </div>
        ) : <p className="text-sm text-muted-foreground">No response provided.</p>}
      </div>

      <div className="p-4 border rounded-lg">
        <h4 className="font-semibold mb-2 flex items-center gap-2"><Badge>Category Context</Badge></h4>
        <div className="grid md:grid-cols-2 gap-3 text-sm">
          {Object.entries(categorySpecificNotes).map(([key, val]) => (
            <div key={key} className="flex flex-col">
              <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
              <span className="font-medium">{String(val)}</span>
            </div>
          ))}
          {Object.keys(categorySpecificNotes).length === 0 && <p className="text-muted-foreground col-span-full">No category-specific flags detected.</p>}
        </div>
      </div>
    </div>
  )
}
