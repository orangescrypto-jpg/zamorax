"use client"
import type { Dispute } from "@/src/types"
import { Badge } from "@/components/ui/badge"
import { MessageSquare } from "lucide-react"

type ExtendedDispute = Dispute & {
  sellerEvidence?: string[]
  categorySpecificNotes?: Record<string, unknown>
}

export function DisputeEvidenceViewer({ dispute }: { dispute: ExtendedDispute }) {
  const evidence             = dispute.evidence             ?? []
  const sellerEvidence       = dispute.sellerEvidence       ?? []
  const categorySpecificNotes = dispute.categorySpecificNotes ?? {}

  return (
    <div className="space-y-6">
      {/* ── Buyer's Claim ─────────────────────────────────────────────────── */}
      <div className="p-4 bg-muted/50 rounded-lg space-y-3">
        <h4 className="font-semibold flex items-center gap-2">
          Buyer's Claim
          <Badge variant="outline" className="text-xs font-normal">{evidence.length} file{evidence.length !== 1 ? "s" : ""}</Badge>
        </h4>
        <p className="text-sm text-muted-foreground">{dispute.description}</p>
        {evidence.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
            {evidence.map((url: string, i: number) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                <img
                  src={url}
                  alt={`Buyer evidence ${i + 1}`}
                  className="rounded border h-32 w-full object-cover cursor-pointer hover:opacity-80 transition"
                />
              </a>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">No media uploaded by buyer.</p>
        )}
      </div>

      {/* ── Seller's Response ─────────────────────────────────────────────── */}
      <div className="p-4 bg-muted/50 rounded-lg space-y-3">
        <h4 className="font-semibold flex items-center gap-2">
          Seller's Response
          <Badge variant="outline" className="text-xs font-normal">{sellerEvidence.length} file{sellerEvidence.length !== 1 ? "s" : ""}</Badge>
        </h4>

        {dispute.sellerResponse ? (
          <div className="flex gap-2 text-sm bg-white border rounded-lg p-3">
            <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-foreground">{dispute.sellerResponse}</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">
            {dispute.sellerRespondedAt
              ? "Seller responded but provided no text."
              : "Seller has not responded yet."}
          </p>
        )}

        {sellerEvidence.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {sellerEvidence.map((url: string, i: number) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                <img
                  src={url}
                  alt={`Seller evidence ${i + 1}`}
                  className="rounded border h-32 w-full object-cover cursor-pointer hover:opacity-80 transition"
                />
              </a>
            ))}
          </div>
        ) : (
          dispute.sellerRespondedAt && (
            <p className="text-sm text-muted-foreground italic">No media uploaded by seller.</p>
          )
        )}

        {dispute.sellerRespondedAt && (
          <p className="text-xs text-muted-foreground">
            Responded {new Date(dispute.sellerRespondedAt).toLocaleString("en-NG")}
          </p>
        )}
      </div>

      {/* ── Category Context ──────────────────────────────────────────────── */}
      {Object.keys(categorySpecificNotes).length > 0 && (
        <div className="p-4 border rounded-lg">
          <h4 className="font-semibold mb-2 flex items-center gap-2">
            <Badge>Category Context</Badge>
          </h4>
          <div className="grid md:grid-cols-2 gap-3 text-sm">
            {Object.entries(categorySpecificNotes).map(([key, val]) => (
              <div key={key} className="flex flex-col">
                <span className="text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                <span className="font-medium">{String(val)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
