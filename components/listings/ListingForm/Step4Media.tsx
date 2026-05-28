"use client"
import { useFormContext, useFieldArray } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Plus, X, Upload, Video, Lock } from "lucide-react"
import { useState } from "react"
import { useToast } from "@/components/ui/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"

export function Step4Media() {
  const { control, setValue, watch } = useFormContext()
  const { fields, append, remove } = useFieldArray({ control, name: "images" })
  const imageValues: string[] = watch("images") || []
  const [uploading, setUploading] = useState(false)
  const { toast } = useToast()
  const videoUrl = watch("verificationVideo")

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.length || !auth.currentUser) return
    setUploading(true)
    try {
      const file = e.target.files[0]
      const path = `listings/${auth.currentUser.uid}/${Date.now()}_${file.name}`
      const snap = await uploadBytes(ref(storage, path), file)
      const url = await getDownloadURL(snap.ref)
      append(url)
      toast({ title: "Image Uploaded", description: "Photo secured to Zamorax Storage.", variant: "success" })
    } catch (err: any) {
      toast({ title: "Upload Failed", description: err.message, variant: "destructive" })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
      {/* Photo Upload Section */}
      <div className="space-y-2">
        <Label>Photos (Max 10) — Required</Label>
        <div className="grid grid-cols-3 gap-2">
          {fields.map((field, i) => (
            <div key={field.id} className="relative aspect-square rounded-lg overflow-hidden bg-muted border">
              <img src={imageValues[i]} alt="Upload" className="w-full h-full object-cover" />
              <button onClick={() => remove(i)} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 hover:bg-red-500">
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {fields.length < 10 && (
            <label className="aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:border-primary bg-muted/20 transition">
              <Upload className="h-6 w-6 text-muted-foreground mb-1" />
              <span className="text-xs text-muted-foreground">Add Photo</span>
              <Input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
          )}
        </div>
      </div>

      {/* Video Upload - COMING SOON */}
      <div className="p-4 border-2 border-dashed border-warning/30 rounded-lg bg-warning/5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><Video className="h-5 w-5 text-warning" /><h4 className="font-medium text-warning">Verification Video</h4></div>
          <span className="text-xs font-bold uppercase tracking-wider bg-warning/20 text-warning px-2 py-0.5 rounded">Coming Soon</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Video uploads (power-on, boot, cold-start) are temporarily disabled. Please upload clear, real photos showing the item from all angles.
        </p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground opacity-70">
          <Lock className="h-4 w-4" /> <span>Feature enabled in next update</span>
        </div>
      </div>
    </div>
  )
}
