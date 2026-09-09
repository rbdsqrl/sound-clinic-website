import { Capacitor } from '@capacitor/core'
import { Filesystem, Directory } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import { Browser } from '@capacitor/browser'
import { toPlatformMediaUrl } from './mediaUrl'

// Two shapes of "download" exist across the app, and each needs different handling on native:
//
//  - viewFile(url)   — a file that already lives on the server (a discharge/assessment PDF,
//                       a resource, an attachment). Capacitor's WKWebView/WebView has no real
//                       "open in new tab" — window.open() either silently no-ops or navigates
//                       the app itself away from the page. Browser.open() launches the actual
//                       system browser (Custom Tabs / SFSafariViewController), which already
//                       knows how to view and save a PDF.
//
//  - saveBlob(...)   — a file that exists only in memory (a CSV string we built, a jsPDF
//                       output). There's no URL to hand the system browser, so this writes the
//                       bytes to the app's own cache dir via Filesystem, then opens the native
//                       share sheet (Share.share) so the user can save it to Files / send it on.
//
// Both fall back to plain web behavior (unchanged from before) when not running natively.

export function viewFile(url: string) {
  if (Capacitor.isNativePlatform()) {
    // Chrome Custom Tabs / SFSafariViewController run as a separate process from the app's
    // WebView, so they never see the Android-emulator 10.0.2.2 rewrite the WebView itself gets —
    // it has to be applied explicitly here too (see toPlatformMediaUrl in mediaUrl.ts). No-op in
    // production, where files come back as real HTTPS URLs.
    Browser.open({ url: toPlatformMediaUrl(url) })
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      // reader.result is "data:<mime>;base64,<data>" — Filesystem.writeFile wants just <data>.
      const result = reader.result as string
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

export async function saveBlob(filename: string, blob: Blob) {
  if (Capacitor.isNativePlatform()) {
    const data = await blobToBase64(blob)
    const { uri } = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache })
    await Share.share({ title: filename, url: uri })
    return
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  // WebKit (Safari, iOS/Capacitor WKWebView) can still be reading the blob URL when the
  // click handler returns — revoking it immediately races the download and silently drops
  // it on those browsers. Deferring one tick lets the download start first everywhere.
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
