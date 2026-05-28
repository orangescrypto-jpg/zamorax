"use client"

import { useEffect } from "react"

export function RegisterServiceWorker() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
          })
          .catch((error) => {
          })
      })
    }
  }, [])

  return null
}
