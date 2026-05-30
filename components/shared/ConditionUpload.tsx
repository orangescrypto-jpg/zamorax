"use client"

import { AdminService, serverTimestamp, arrayUnion } from "@/src/services"
import { storage } from "@/lib/firebase/config"
import { ref, uploadBytes, getDownloadURL } from "firebase/storage"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Upload, CheckCircle, Loader2, X } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { cn } from "@/lib/utils"

export function ConditionUpload({ orderId, type = "conditionAfterPhotos" }: { orderId: string; type?: string }) {
  const [uploading, setUploading] = useState(false)
  const [urls, setUrls] = useState<string[]>([])
  const { toast } = useToast()

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length) return
    setUploading(true)
    const files = Array.from(e.target.files)

    try {
      const newUrls: string[] = []
      for (const file of files) {
        const path = `orders/${orderId}/${type}/${Date.now()}_${file.name}`
        const snap = await uploadBytes(ref(storage, path), file)
        const url = await getDownloadURL(snap.ref)
        newUrls.push(url)
      }

      setUrls(prev => [...prev, ...newUrls])
      await AdminService.updateDoc("orders", orderId, {
        [type]: arrayUnion(...newUrls),
        updatedAt: serverTimestamp(),
      })

      toast({ title: "Photos Uploaded", description: "Condition evidence secured.", variant: "success" })
    } catch (err: any) {
      console.error("Condition upload failed:", err)
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-3">
      <Label>{type === "conditionAfterPhotos" ? "Delivery/Return Condition Photos" : "Initial Condition Photos"}</Label>
      <div className="flex flex-wrap gap-2">
        {urls.map((url, i) => (
          <div key={i} className="relative h-20 w-20 rounded-lg overflow-hidden border">
            <img src={url} alt="Condition" className="h-full w-full object-cover" />
            <button onClick={() => setUrls(u => u.filter((_, idx) => idx !== i))} className="absolute top-0.5 right-0.5 bg-black/50 rounded-full p-0.5">
              <X className="h-3 w-3 text-white" />
            </button>
          </div>
        ))}
        <label className={cn("h-20 w-20 flex flex-col items-center justify-center border-2 border-dashed rounded-lg cursor-pointer hover:border-primary transition bg-muted/20", uploading && "opacity-50 pointer-events-none")}>
          {uploading ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /> : <Upload className="h-5 w-5 text-muted-foreground" />}
          <span className="text-[10px] text-muted-foreground mt-1">{uploading ? "Uploading..." : "Add Photo"}</span>
          <input type="file" accept="image/*" multiple className="hidden" onChange={handleUpload} />
        </label>
      </div>
      {urls.length > 0 && <p className="text-xs text-accent flex items-center gap-1"><CheckCircle className="h-3 w-3" /> {urls.length} photos secured</p>}
    </div>
  )
}
