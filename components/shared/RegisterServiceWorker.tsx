"use client"

import { useEffect } from "react"

export function RegisterServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          // Check for an updated sw.js on every page load, in case the
          // browser is holding onto a stale worker from a previous deploy.
          registration.update().catch(() => {})

          // If a new worker is found and takes control, the page is now
          // being served by new logic but with old JS already loaded in
          // memory — reload once so everything is consistent.
          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing
            if (!newWorker) return
            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "activated") {
                window.location.reload()
              }
            })
          })
        })
        .catch(() => {})
    })
  }, [])

  return null
}
