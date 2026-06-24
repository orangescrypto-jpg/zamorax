// src/services/storage.ts
// ─────────────────────────────────────────────────────────────────
// WAS FIREBASE STORAGE → NOW CLOUDFLARE R2
// ─────────────────────────────────────────────────────────────────

import type { UploadResult } from "@/src/types"

// ── Switch provider here ─────────────────────────────────────────
// WAS: export { StorageService } from "@/src/services/providers/firebase/storage"
export { StorageService } from "@/src/services/providers/r2/storage"
// ─────────────────────────────────────────────────────────────────

export interface IStorageService {
  uploadFile(file: File, path: string, onProgress?: (pct: number) => void): Promise<UploadResult>
  uploadFiles(files: File[], pathPrefix: string, onProgress?: (pct: number) => void): Promise<UploadResult[]>
  deleteFile(pathOrUrl: string): Promise<void>
  getDownloadUrl(path: string): Promise<string>
}
