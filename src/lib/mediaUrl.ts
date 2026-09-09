import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'

// Locally-stored files (the backend's local storage provider, used in dev) are returned as
// absolute URLs baked with the backend's own base URL, which defaults to 'http://localhost:8080'
// (see backend StorageProperties.baseUrl / app.storage.base-url). That host doesn't resolve on
// the Android emulator, which needs the 10.0.2.2 alias instead — same substitution api/client.ts
// already makes for API calls. No-op everywhere else, including production, where files come
// back as real S3/Supabase HTTPS URLs that are never on localhost.
export function toPlatformMediaUrl(url: string): string {
  if (Capacitor.getPlatform() === 'android' && url.startsWith('http://localhost:8080')) {
    return url.replace('http://localhost:8080', 'http://10.0.2.2:8080')
  }
  return url
}

/**
 * An `<img src>` pointed at the rewritten URL above still fails on Android: WebView applies
 * Chromium's mixed-content "autoupgrade" to image loads specifically, silently retrying the
 * http:// URL as https:// — since the local dev backend has no TLS cert, that retry fails and
 * the image renders broken. This happens even with WebSettings.MIXED_CONTENT_ALWAYS_ALLOW set
 * (MainActivity.java), which only ever covered active content (XHR/fetch), not this per-resource
 * autoupgrade. fetch() isn't autoupgraded — same reason the app's API calls succeed with only a
 * console warning — so fetching the bytes ourselves and handing WebView a blob: URL sidesteps it
 * entirely. No-op (returns the rewritten URL as-is) everywhere else, including production.
 */
export function useMediaSrc(url: string): string {
  const rewritten = toPlatformMediaUrl(url)
  const needsBlobFetch = Capacitor.getPlatform() === 'android' && rewritten.startsWith('http://')
  const [src, setSrc] = useState(() => (needsBlobFetch ? '' : rewritten))

  useEffect(() => {
    if (!needsBlobFetch) { setSrc(rewritten); return }
    let objectUrl: string | undefined
    let cancelled = false
    fetch(rewritten)
      .then(res => res.blob())
      .then(blob => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setSrc(objectUrl)
      })
      .catch(() => { if (!cancelled) setSrc(rewritten) })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [rewritten, needsBlobFetch])

  return src
}
