import { useRef, useState, useCallback, useEffect } from 'react'
import * as faceapi from 'face-api.js'

export type ScanStatus = 'idle' | 'scanning' | 'detected'
export type FaceMatchStatus = 'idle' | 'checking' | 'matched' | 'no-match'

interface Options {
  oneShot?: boolean  // stop after first detection (enroll)
}

export function useFaceScan(
  active: boolean,
  videoRef: React.RefObject<HTMLVideoElement | null>,
  options: Options = {}
) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const guardRef    = useRef(false)
  const oneShotOpt  = options.oneShot ?? false

  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle')
  const [descriptor, setDescriptor] = useState<number[] | null>(null)

  const stop = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    guardRef.current = false
    setScanStatus('idle')
    setDescriptor(null)
  }, [])

  useEffect(() => {
    if (!active) { stop(); return }
    if (intervalRef.current) return

    guardRef.current = true
    setScanStatus('scanning')

    intervalRef.current = setInterval(async () => {
      if (!guardRef.current || !videoRef.current) return
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options())
        .withFaceLandmarks()
        .withFaceDescriptor()
      if (detection && guardRef.current) {
        if (oneShotOpt) {
          guardRef.current = false
          clearInterval(intervalRef.current!)
          intervalRef.current = null
        }
        setDescriptor(Array.from(detection.descriptor))
        setScanStatus('detected')
      } else if (!oneShotOpt) {
        setScanStatus('scanning')
      }
    }, 1500)

    return () => stop()
  }, [active, stop]) // eslint-disable-line react-hooks/exhaustive-deps

  return { scanStatus, descriptor, stop }
}
