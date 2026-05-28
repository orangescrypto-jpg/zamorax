// src/services/providers/firebase/storage.ts

import {
  ref, uploadBytesResumable, getDownloadURL,
  deleteObject, type StorageReference,
} from "firebase/storage"
import { storage } from "@/lib/firebase/config"
import type { IStorageService } from "@/src/services/storage"
import type { UploadResult } from "@/src/types"

export const StorageService: IStorageService = {

  async uploadFile(file, path, onProgress) {
    const storageRef: StorageReference = ref(storage, path)
    const task = uploadBytesResumable(storageRef, file)

    return new Promise<UploadResult>((resolve, reject) => {
      task.on(
        "state_changed",
        snapshot => {
          if (onProgress) {
            onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100))
          }
        },
        reject,
        async () => {
          const url = await getDownloadURL(task.snapshot.ref)
          resolve({ url, path })
        },
      )
    })
  },

  async uploadFiles(files, pathPrefix, onProgress) {
    const results: UploadResult[] = []
    for (let i = 0; i < files.length; i++) {
      const ext = files[i].name.split(".").pop()
      const path = `${pathPrefix}/${Date.now()}_${i}.${ext}`
      const result = await this.uploadFile(files[i], path, pct => {
        if (onProgress) {
          // Report aggregate progress across all files
          onProgress(Math.round(((i * 100) + pct) / files.length))
        }
      })
      results.push(result)
    }
    return results
  },

  async deleteFile(pathOrUrl) {
    try {
      // Accept either a storage path or a full https URL
      const storageRef = pathOrUrl.startsWith("https://")
        ? ref(storage, decodeURIComponent(pathOrUrl.split("/o/")[1].split("?")[0]))
        : ref(storage, pathOrUrl)
      await deleteObject(storageRef)
    } catch (err: any) {
      // Ignore "object not found" errors (already deleted)
      if (err.code !== "storage/object-not-found") throw err
    }
  },

  async getDownloadUrl(path) {
    return getDownloadURL(ref(storage, path))
  },
}
