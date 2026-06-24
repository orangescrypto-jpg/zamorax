// src/services/providers/r2/storage.ts
// ─────────────────────────────────────────────────────────────────
// WAS FIREBASE STORAGE → NOW CLOUDFLARE R2
// Browser-side: calls /api/upload (POST multipart) and /api/upload (DELETE).
// The actual S3/R2 SDK lives only on the server (app/api/upload/route.ts).
// ─────────────────────────────────────────────────────────────────

import { supabase } from "@/lib/supabase/client"
import type { IStorageService } from "@/src/services/storage"
import type { UploadResult } from "@/src/types"

/** Get the current Supabase session token for authenticated uploads */
async function getBearerToken(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error("Not authenticated — cannot upload files")
  return session.access_token
}

// ── Implementation ───────────────────────────────────────────────

export const StorageService: IStorageService = {

  // WAS: uploadBytesResumable(ref(storage, path), file)
  // NOW: fetch('/api/upload', FormData)
  async uploadFile(file, path, onProgress) {
    const token    = await getBearerToken()
    const formData = new FormData()
    formData.append("file", file)
    formData.append("path", path)

    // XHR gives us upload progress; fetch does not
    return new Promise<UploadResult>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open("POST", "/api/upload")
      xhr.setRequestHeader("Authorization", `Bearer ${token}`)

      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
        }
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          const { url } = JSON.parse(xhr.responseText)
          resolve({ url, path })
        } else {
          reject(new Error(`Upload failed: ${xhr.statusText}`))
        }
      }
      xhr.onerror = () => reject(new Error("Upload network error"))
      xhr.send(formData)
    })
  },

  async uploadFiles(files, pathPrefix, onProgress) {
    const results: UploadResult[] = []
    for (let i = 0; i < files.length; i++) {
      const ext  = files[i].name.split(".").pop() ?? "bin"
      const path = `${pathPrefix}/${Date.now()}_${i}.${ext}`
      const result = await this.uploadFile(files[i], path, pct => {
        if (onProgress) onProgress(Math.round(((i * 100) + pct) / files.length))
      })
      results.push(result)
    }
    return results
  },

  // WAS: deleteObject(ref(storage, path))
  // NOW: DELETE /api/upload { path }
  async deleteFile(pathOrUrl) {
    const token = await getBearerToken()
    // Normalise: accept either a full R2 public URL or a bare key
    const publicBase = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? ""
    const key        = pathOrUrl.startsWith(publicBase)
      ? pathOrUrl.slice(publicBase.length + 1)
      : pathOrUrl

    await fetch("/api/upload", {
      method:  "DELETE",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
      body:    JSON.stringify({ path: key }),
    })
  },

  // WAS: getDownloadURL(ref(storage, path))
  // NOW: R2 files are publicly accessible via CDN URL
  async getDownloadUrl(path) {
    const publicBase = process.env.NEXT_PUBLIC_R2_PUBLIC_URL
    if (!publicBase) throw new Error("NEXT_PUBLIC_R2_PUBLIC_URL is not set")
    return `${publicBase}/${path}`
  },
}
