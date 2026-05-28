// src/services/storage.ts
// ─────────────────────────────────────────────────────────────────
// File / image storage service — public interface.
// ─────────────────────────────────────────────────────────────────

import type { UploadResult } from "@/src/types"

// ── Switch provider here ─────────────────────────────────────────
export { StorageService } from "@/src/services/providers/firebase/storage"
// Future swap example:
// export { StorageService } from "@/src/services/providers/supabase/storage"
// ─────────────────────────────────────────────────────────────────

export interface IStorageService {
  /**
   * Upload a single file.
   * @param file    The File/Blob to upload
   * @param path    Storage path, e.g. "listings/uid/image1.jpg"
   * @param onProgress  Optional 0–100 progress callback
   */
  uploadFile(
    file: File,
    path: string,
    onProgress?: (pct: number) => void,
  ): Promise<UploadResult>

  /**
   * Upload multiple files and return all results in order.
   */
  uploadFiles(
    files: File[],
    pathPrefix: string,
    onProgress?: (pct: number) => void,
  ): Promise<UploadResult[]>

  /**
   * Delete a file by its storage path or full URL.
   */
  deleteFile(pathOrUrl: string): Promise<void>

  /**
   * Get a fresh download URL for a storage path.
   */
  getDownloadUrl(path: string): Promise<string>
}
