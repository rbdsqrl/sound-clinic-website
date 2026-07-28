import { useRef, useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as faceapi from 'face-api.js'
import { Camera, MapPin, CheckCircle, XCircle, Clock, LogIn, LogOut, UserCheck, AlertTriangle, RefreshCw } from 'lucide-react'
import { attendanceApi } from '../../api/attendance'
import { clinicsApi } from '../../api/clinics'
import { useAuth } from '../../contexts/AuthContext'
import { Select } from '../../components/ui/Select'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { PageLoader } from '../../components/ui/Spinner'
import { ToastContainer } from '../../components/ui/Toast'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { colors, styles, successAlpha, dangerAlpha, warningAlpha } from '../../theme'
import type { AttendanceResponse } from '../../types'

const MODELS_PATH = '/models'

function formatTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

type VerifyBadgeProps = { ok: boolean; label: string }
function VerifyBadge({ ok, label }: VerifyBadgeProps) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium"
      style={{
        background: ok ? successAlpha(0.12) : dangerAlpha(0.1),
        color: ok ? colors.status.success : colors.status.error,
      }}
    >
      {ok ? <CheckCircle size={12} /> : <XCircle size={12} />}
      {label}
    </span>
  )
}

// ── Camera badge helpers ──────────────────────────────────────────────────────

type ScanStatus      = 'idle' | 'scanning' | 'detected'
type FaceMatchStatus = 'idle' | 'checking' | 'matched' | 'no-match'

function cameraBadgeColor(faceMatch: FaceMatchStatus, scan: ScanStatus) {
  if (faceMatch === 'matched')  return '#86efac'
  if (faceMatch === 'no-match') return '#f87171'
  if (faceMatch === 'checking') return '#fbbf24'
  if (scan === 'detected')      return '#86efac'
  if (scan === 'scanning')      return '#fbbf24'
  return '#4ade80'
}

function cameraBadgeDot(faceMatch: FaceMatchStatus, scan: ScanStatus) {
  if (faceMatch === 'matched')  return 'bg-green-400'
  if (faceMatch === 'no-match') return 'bg-red-400'
  if (faceMatch === 'checking') return 'bg-yellow-400 animate-pulse'
  if (scan === 'detected')      return 'bg-green-400'
  if (scan === 'scanning')      return 'bg-yellow-400 animate-pulse'
  return 'bg-green-300'
}

function cameraBadgeLabel(faceMatch: FaceMatchStatus, scan: ScanStatus, enrollMode: boolean) {
  if (faceMatch === 'matched')  return 'Face matched'
  if (faceMatch === 'no-match') return 'Face not recognised'
  if (faceMatch === 'checking') return 'Matching…'
  if (scan === 'detected')      return enrollMode ? 'Face captured' : 'Face detected'
  if (scan === 'scanning')      return 'Detecting…'
  return 'Live'
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AttendancePage({ asTab = false }: { asTab?: boolean }) {
  const { user, refreshUser } = useAuth()
  const { toasts, toast, dismiss } = useToast()
  const qc = useQueryClient()

  const videoRef          = useRef<HTMLVideoElement>(null)
  const canvasRef         = useRef<HTMLCanvasElement>(null)
  const streamRef         = useRef<MediaStream | null>(null)
  const modelsLoadPromise = useRef<Promise<void> | null>(null)
  const didAutoEnroll     = useRef(false)
  const didAutoCheckIn    = useRef(false)
  const autoScanRef       = useRef<ReturnType<typeof setInterval> | null>(null)
  const isScanningRef     = useRef(false)
  const enrollScanRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const isEnrollScanRef   = useRef(false)
  const locationRef       = useRef<{ lat: number; lon: number } | null>(null)
  const geoStatusRef      = useRef<'idle' | 'loading' | 'ok' | 'denied' | 'permission-denied'>('idle')

  const [selectedClinicId, setSelectedClinicId] = useState('')
  const [cameraActive, setCameraActive]         = useState(false)
  const [modelsLoaded, setModelsLoaded]         = useState(false)
  const [modelsLoading, setModelsLoading]       = useState(false)
  const [geoStatus, setGeoStatus]               = useState<'idle' | 'loading' | 'ok' | 'denied' | 'permission-denied'>('idle')
  const [location, setLocation]                 = useState<{ lat: number; lon: number } | null>(null)
  const [geoFenceError, setGeoFenceError]       = useState(false)
  const [enrollMode, setEnrollMode]             = useState(false)
  const [showVerifyForm, setShowVerifyForm]     = useState(false)
  const [scanStatus, setScanStatus]             = useState<ScanStatus>('idle')
  const [enrollScanStatus, setEnrollScanStatus] = useState<ScanStatus>('idle')
  const [capturedDescriptor, setCapturedDescriptor] = useState<number[] | null>(null)
  const [reCheckIn, setReCheckIn]               = useState(false)
  const [faceMatchStatus, setFaceMatchStatus]   = useState<FaceMatchStatus>('idle')

  const faceEnrolled = user?.faceEnrolled ?? false

  useEffect(() => { locationRef.current  = location  }, [location])
  useEffect(() => { geoStatusRef.current = geoStatus }, [geoStatus])

  // Fetch fresh user on mount — localStorage may have stale faceEnrolled
  useEffect(() => { refreshUser() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Drive enrollMode from server: enter when not enrolled, exit after successful registration
  useEffect(() => {
    setEnrollMode(!faceEnrolled)
  }, [faceEnrolled])

  // ── Data queries ─────────────────────────────────────────────────────────────

  const { data: today, isLoading: loadingToday } = useQuery({
    queryKey: ['attendance', 'today'],
    queryFn: () => attendanceApi.today(),
  })

  const { data: clinics = [] } = useQuery({
    queryKey: ['clinics'],
    queryFn: () => clinicsApi.list(),
  })

  const clinicOptions = clinics.map(c => ({ value: c.id, label: c.name }))

  useEffect(() => {
    if (clinics.length > 0 && !selectedClinicId) {
      const preferred = user?.clinicId
        ? clinics.find(c => c.id === user.clinicId)?.id
        : undefined
      setSelectedClinicId(preferred ?? clinics[0].id)
    }
  }, [clinics, user?.clinicId, selectedClinicId])

  // ── Face-api models ───────────────────────────────────────────────────────────

  const loadModels = useCallback(async () => {
    if (modelsLoaded) return
    if (modelsLoadPromise.current) return modelsLoadPromise.current
    setModelsLoading(true)
    modelsLoadPromise.current = Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromUri(MODELS_PATH),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_PATH),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_PATH),
    ]).then(() => {
      setModelsLoaded(true)
    }).catch(() => {
      toast('Face recognition models could not be loaded', 'error')
    }).finally(() => {
      setModelsLoading(false)
      modelsLoadPromise.current = null
    })
    return modelsLoadPromise.current
  }, [modelsLoaded, toast])

  // ── Geolocation ───────────────────────────────────────────────────────────────

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      toast('Geolocation is not supported by your browser', 'error')
      return
    }
    setGeoStatus('loading')
    setGeoFenceError(false)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        setGeoStatus('ok')
      },
      (err: GeolocationPositionError) => {
        setGeoStatus(err.code === 1 ? 'permission-denied' : 'denied')
        toast('Location access denied — please allow location in your device settings', 'error')
      },
    )
  }, [toast])

  // ── Camera ────────────────────────────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    setFaceMatchStatus('idle')
    try {
      // getUserMedia must come before any await — iOS Safari drops the gesture context otherwise
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      streamRef.current = stream
      setCameraActive(true)
      await loadModels()
    } catch {
      toast('Camera access denied', 'error')
    }
  }, [loadModels, toast])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCameraActive(false)
  }, [])

  const stopCheckInScan = useCallback(() => {
    if (autoScanRef.current) {
      clearInterval(autoScanRef.current)
      autoScanRef.current = null
    }
    isScanningRef.current = false
    setScanStatus('idle')
  }, [])

  useEffect(() => () => { stopCamera(); stopCheckInScan() }, [stopCamera, stopCheckInScan])

  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [cameraActive])

  // Auto-open camera for first-time registration
  useEffect(() => {
    if (asTab) return
    if (didAutoEnroll.current || faceEnrolled) return
    didAutoEnroll.current = true
    startCamera()
  }, [asTab, faceEnrolled, startCamera])

  // Auto-request location + camera for check-in
  useEffect(() => {
    if (didAutoCheckIn.current || !faceEnrolled || loadingToday) return
    if (today?.status === 'CHECKED_IN' || today?.status === 'CHECKED_OUT') return
    didAutoCheckIn.current = true
    getLocation()
    if (!asTab) startCamera()
  }, [asTab, faceEnrolled, loadingToday, today?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Face descriptor (live capture — used by check-in manual fallback and verify) ──

  const captureFaceDescriptor = useCallback(async (): Promise<number[] | undefined> => {
    if (!videoRef.current || !modelsLoaded) return undefined
    const detection = await faceapi
      .detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options())
      .withFaceLandmarks()
      .withFaceDescriptor()
    if (!detection) {
      toast('No face detected — please ensure your face is clearly visible', 'error')
      return undefined
    }
    return Array.from(detection.descriptor)
  }, [modelsLoaded, toast])

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const checkInMut = useMutation({
    mutationFn: async (descriptor?: number[]) => {
      const faceDescriptor = descriptor ?? await captureFaceDescriptor()
      if (!faceDescriptor) throw new Error('No face detected')
      return attendanceApi.checkIn({
        clinicId: selectedClinicId,
        latitude: location!.lat,
        longitude: location!.lon,
        faceDescriptor,
      })
    },
    onSuccess: (data: AttendanceResponse) => {
      setFaceMatchStatus('matched')
      qc.setQueryData(['attendance', 'today'], data)
      qc.invalidateQueries({ queryKey: ['attendance'] })
      toast('Checked in successfully', 'success')
      stopCamera()
      stopCheckInScan()
      setReCheckIn(false)
    },
    onError: (err) => {
      setFaceMatchStatus('no-match')
      setScanStatus('idle')
      toast(getApiError(err, 'Check-in failed'), 'error')
    },
  })

  const checkOutMut = useMutation({
    mutationFn: async () => attendanceApi.checkOut({
      latitude: location?.lat,
      longitude: location?.lon,
    }),
    onSuccess: (data: AttendanceResponse) => {
      qc.setQueryData(['attendance', 'today'], data)
      qc.invalidateQueries({ queryKey: ['attendance'] })
      toast('Checked out successfully', 'success')
    },
    onError: (err) => toast(getApiError(err, 'Check-out failed'), 'error'),
  })

  const verifyMut = useMutation({
    mutationFn: async () => {
      const descriptor = cameraActive ? await captureFaceDescriptor() : undefined
      return attendanceApi.verify({
        latitude: location?.lat,
        longitude: location?.lon,
        faceDescriptor: descriptor,
      })
    },
    onSuccess: (data: AttendanceResponse) => {
      qc.setQueryData(['attendance', 'today'], data)
      qc.invalidateQueries({ queryKey: ['attendance'] })
      setFaceMatchStatus(data.faceVerified ? 'matched' : 'no-match')
      if (!data.geoVerified) {
        setGeoFenceError(true)
        setGeoStatus('idle')
        setLocation(null)
        if (data.faceVerified) toast('Face verified — location check failed', 'info')
        return
      }
      if (!data.faceVerified) return
      toast('Verification complete', 'success')
      setShowVerifyForm(false)
      stopCamera()
    },
    onError: (err) => {
      setFaceMatchStatus('no-match')
      toast(getApiError(err, 'Verification failed'), 'error')
    },
  })

  const enrollMut = useMutation({
    mutationFn: async () => {
      if (!capturedDescriptor) throw new Error('No face detected')
      return attendanceApi.enrollFace({ faceDescriptor: capturedDescriptor })
    },
    onSuccess: async () => {
      toast('Face registered successfully', 'success')
      stopCamera()
      await refreshUser()  // faceEnrolled → true → useEffect sets enrollMode → false
    },
    onError: (err) => toast(getApiError(err, 'Face registration failed'), 'error'),
  })

  // ── Auto-scan: check-in only ──────────────────────────────────────────────────
  // Runs only when face is enrolled and not in enroll mode.
  // Fires check-in automatically once face + location are both ready.

  useEffect(() => {
    const canDetect = cameraActive && faceEnrolled && !enrollMode && modelsLoaded
      && today?.status !== 'CHECKED_IN'
    if (!canDetect || autoScanRef.current) return

    isScanningRef.current = true
    setScanStatus('scanning')

    autoScanRef.current = setInterval(async () => {
      if (!isScanningRef.current || !videoRef.current) return
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options())
        .withFaceLandmarks()
        .withFaceDescriptor()
      if (detection && isScanningRef.current) {
        setScanStatus('detected')
        if (geoStatusRef.current === 'ok' && locationRef.current) {
          isScanningRef.current = false
          clearInterval(autoScanRef.current!)
          autoScanRef.current = null
          setFaceMatchStatus('checking')
          checkInMut.mutate(Array.from(detection.descriptor))
        }
        // face found but location not ready — keep scanning
      } else {
        setScanStatus('scanning')
      }
    }, 1500)

    return () => stopCheckInScan()
  }, [cameraActive, faceEnrolled, enrollMode, today?.status, modelsLoaded, stopCheckInScan]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Enrollment scan ───────────────────────────────────────────────────────────
  // Runs only in enroll mode. Detects once, stores descriptor, stops.
  // Save button is enabled only after descriptor is captured.

  useEffect(() => {
    if (!enrollMode || !cameraActive || !modelsLoaded) {
      if (enrollScanRef.current) {
        clearInterval(enrollScanRef.current)
        enrollScanRef.current = null
      }
      isEnrollScanRef.current = false
      return
    }
    if (enrollScanRef.current) return

    setEnrollScanStatus('scanning')
    isEnrollScanRef.current = true

    enrollScanRef.current = setInterval(async () => {
      if (!isEnrollScanRef.current || !videoRef.current) return
      const detection = await faceapi
        .detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options())
        .withFaceLandmarks()
        .withFaceDescriptor()
      if (detection && isEnrollScanRef.current) {
        isEnrollScanRef.current = false
        clearInterval(enrollScanRef.current!)
        enrollScanRef.current = null
        setCapturedDescriptor(Array.from(detection.descriptor))
        setEnrollScanStatus('detected')
      }
    }, 1500)

    return () => {
      if (enrollScanRef.current) {
        clearInterval(enrollScanRef.current)
        enrollScanRef.current = null
      }
      isEnrollScanRef.current = false
      setEnrollScanStatus('idle')
      setCapturedDescriptor(null)
    }
  }, [enrollMode, cameraActive, modelsLoaded]) // eslint-disable-line react-hooks/exhaustive-deps

  if (loadingToday) return <PageLoader />

  const checkedIn  = today?.status === 'CHECKED_IN'
  const checkedOut = today?.status === 'CHECKED_OUT'
  const isWorking  = checkInMut.isPending || checkOutMut.isPending || enrollMut.isPending || verifyMut.isPending
  const needsVerification = checkedIn && today && (!today.geoVerified || !today.faceVerified)
  const canCheckIn = geoStatus === 'ok' && cameraActive && !!selectedClinicId

  // ── Face guide SVG overlay ────────────────────────────────────────────────────

  const activeScan = enrollMode ? enrollScanStatus : scanStatus
  const ovalColor =
    faceMatchStatus === 'matched'  ? '#86efac' :
    faceMatchStatus === 'no-match' ? '#f87171' :
    faceMatchStatus === 'checking' ? '#fbbf24' :
    activeScan === 'detected'      ? '#4ade80' :
    'rgba(255,255,255,0.6)'
  const ovalDashed = activeScan !== 'detected' && faceMatchStatus === 'idle'

  const FaceGuideOverlay = (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <mask id="face-oval-mask">
          <rect width="400" height="300" fill="white" />
          <ellipse cx="200" cy="145" rx="86" ry="116" fill="black" />
        </mask>
      </defs>
      <rect width="400" height="300" fill="rgba(0,0,0,0.4)" mask="url(#face-oval-mask)" />
      <ellipse
        cx="200" cy="145" rx="86" ry="116"
        fill="none"
        stroke={ovalColor}
        strokeWidth="2.5"
        strokeDasharray={ovalDashed ? '10 5' : undefined}
      />
      {ovalDashed && (
        <text x="200" y="284" textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize="10" fontWeight="500">
          Position your face in the oval
        </text>
      )}
    </svg>
  )

  // ── Shared camera view ─────────────────────────────────────────────────────────
  // Used by both the action card and the fix-verification card.
  // `mode` controls badge label interpretation and what's shown below the video.

  function CameraView({ mode }: { mode: 'enroll' | 'checkin' | 'verify' }) {
    const displayScan = mode === 'enroll' ? enrollScanStatus : scanStatus

    return (
      <div>
        <p className="text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: colors.text.dim }}>
          {mode === 'enroll' ? 'Position your face in the camera' : 'Face verification'}
        </p>
        {!cameraActive ? (
          <Button variant="secondary" onClick={startCamera} loading={modelsLoading}>
            <Camera size={15} />
            {modelsLoading ? 'Loading face models…' : 'Open Camera'}
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="relative rounded-xl overflow-hidden bg-black" style={{ aspectRatio: '4/3', maxHeight: 280 }}>
              <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
              {FaceGuideOverlay}
              <div
                className="absolute bottom-2 right-2 rounded-lg px-2 py-1 text-xs font-medium flex items-center gap-1"
                style={{ background: 'rgba(0,0,0,0.6)', color: cameraBadgeColor(faceMatchStatus, displayScan) }}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${cameraBadgeDot(faceMatchStatus, displayScan)}`} />
                {cameraBadgeLabel(faceMatchStatus, displayScan, mode === 'enroll')}
              </div>
            </div>

            {/* Enroll: face captured confirmation */}
            {mode === 'enroll' && enrollScanStatus === 'detected' && (
              <div
                className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm"
                style={{ background: successAlpha(0.1), border: `1px solid ${successAlpha(0.3)}` }}
              >
                <CheckCircle size={14} style={{ color: colors.status.success, flexShrink: 0 }} />
                <span style={{ color: colors.text.primary }}>
                  Face captured — click <strong>Save</strong> to Register
                </span>
              </div>
            )}

            {/* Check-in / verify: face not recognised */}
            {mode !== 'enroll' && faceMatchStatus === 'no-match' && (
              <div
                className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm"
                style={{ background: dangerAlpha(0.08), border: `1px solid ${dangerAlpha(0.2)}` }}
              >
                <AlertTriangle size={14} style={{ color: colors.status.error, flexShrink: 0, marginTop: 1 }} />
                <div className="flex flex-col gap-1.5">
                  <span style={{ color: colors.text.primary }}>
                    Face not recognised. Ensure your face is well-lit and clearly visible.
                  </span>
                  {mode === 'checkin' && (
                    <button
                      onClick={() => { setFaceMatchStatus('checking'); checkInMut.mutate(undefined) }}
                      className="text-xs font-semibold text-left underline"
                      style={{ color: colors.accent }}
                    >
                      Try again
                    </button>
                  )}
                  {mode === 'verify' && (
                    <span className="text-xs" style={{ color: colors.text.muted }}>
                      Then tap <em>Verify Now</em> again.
                    </span>
                  )}
                </div>
              </div>
            )}

            <button onClick={stopCamera} className="text-xs" style={{ color: colors.text.muted }}>
              Close camera
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={asTab ? 'max-w-2xl space-y-6' : 'p-4 md:p-6 lg:p-8 max-w-2xl mx-auto space-y-6'}>

      {/* ── Header ── */}
      {!asTab && (
        <div>
          <h1 className="text-lg md:text-xl font-bold" style={{ color: colors.text.heading }}>
            Attendance
          </h1>
          <p className="text-sm mt-1" style={{ color: colors.text.muted }}>
            {new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      )}

      {/* ── Today's status card ── */}
      {today && (
        <Card>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: colors.text.dim }}>
                Today at {today.clinicName}
              </p>
              <div className="flex items-center gap-4 flex-wrap">
                <span className="flex items-center gap-1.5 text-sm" style={{ color: colors.text.primary }}>
                  <LogIn size={14} />
                  In: {formatTime(today.checkInTime)}
                </span>
                {today.checkOutTime && (
                  <span className="flex items-center gap-1.5 text-sm" style={{ color: colors.text.primary }}>
                    <LogOut size={14} />
                    Out: {formatTime(today.checkOutTime)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <VerifyBadge ok={today.geoVerified}  label="Location" />
              <VerifyBadge ok={today.faceVerified} label="Face" />
            </div>
          </div>

          {needsVerification && !showVerifyForm && (
            <div
              className="flex items-center justify-between gap-3 mt-3 rounded-xl px-3 py-2.5"
              style={{ background: warningAlpha(0.1) }}
            >
              <div className="flex items-center gap-2 text-sm" style={{ color: colors.text.primary }}>
                <AlertTriangle size={15} style={{ color: colors.status.warning, flexShrink: 0 }} />
                <span>Verification incomplete — fix it now to complete your attendance.</span>
              </div>
              <button
                onClick={() => setShowVerifyForm(true)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg flex-shrink-0 whitespace-nowrap"
                style={{ background: warningAlpha(0.2), color: colors.status.warning }}
              >
                <RefreshCw size={12} />
                Fix
              </button>
            </div>
          )}
        </Card>
      )}

      {/* ── Fix Verification card ── */}
      {needsVerification && showVerifyForm && (
        <Card>
          <h2 className="text-base font-semibold mb-4" style={{ color: colors.text.heading }}>
            Fix Verification
          </h2>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: colors.text.dim }}>
                Step 1 — Location
              </p>
              <button
                onClick={getLocation}
                disabled={geoStatus === 'ok' || geoStatus === 'loading'}
                className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all min-h-[44px]"
                style={geoStatus === 'ok'
                  ? { background: successAlpha(0.1), color: colors.status.success }
                  : (geoStatus === 'denied' || geoStatus === 'permission-denied')
                  ? { background: dangerAlpha(0.08), color: colors.status.error, border: `1px solid ${dangerAlpha(0.3)}` }
                  : { background: warningAlpha(0.08), color: colors.text.primary, border: `1px solid ${colors.text.dim}` }
                }
              >
                <MapPin size={15} />
                {geoStatus === 'loading'           && 'Getting location…'}
                {geoStatus === 'ok'                && 'Location captured'}
                {geoStatus === 'denied'            && 'Retry location access'}
                {geoStatus === 'permission-denied' && 'Location access denied'}
                {geoStatus === 'idle'              && (geoFenceError ? 'Retry location' : 'Allow location access')}
              </button>
              {geoStatus === 'permission-denied' && (
                <p className="text-xs mt-2" style={{ color: colors.text.muted }}>
                  Location permission was blocked. On iPhone, go to{' '}
                  <strong style={{ color: colors.text.primary }}>Settings → Safari (or your browser) → Location</strong>{' '}
                  and set it to Allow. On Android, tap the lock icon in your browser address bar.
                </p>
              )}
              {geoFenceError && (
                <div
                  className="flex items-start gap-2 mt-2 rounded-xl px-3 py-2.5 text-sm"
                  style={{ background: dangerAlpha(0.08), border: `1px solid ${dangerAlpha(0.2)}` }}
                >
                  <AlertTriangle size={15} style={{ color: colors.status.error, flexShrink: 0, marginTop: 1 }} />
                  <span style={{ color: colors.text.primary }}>
                    You're outside the clinic's geo-fence. Please move closer to the clinic and try again.
                  </span>
                </div>
              )}
            </div>

            <CameraView mode="verify" />

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                onClick={() => { setFaceMatchStatus('checking'); verifyMut.mutate() }}
                loading={verifyMut.isPending}
                disabled={!geoStatus || geoStatus === 'loading'}
              >
                <RefreshCw size={15} />
                Verify Now
              </Button>
              <Button variant="secondary" onClick={() => {
                setShowVerifyForm(false)
                stopCamera()
                setGeoStatus('idle')
                setLocation(null)
                setGeoFenceError(false)
              }}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* ── Action card: Register / Check In / Check Out ── */}
      {(!checkedOut || reCheckIn || enrollMode) && !showVerifyForm && (
        <Card>
          <h2 className="text-base font-semibold mb-4" style={{ color: colors.text.heading }}>
            {enrollMode ? 'Register Face' : checkedIn ? 'Check Out' : 'Check In'}
          </h2>

          {/* First-time registration notice */}
          {enrollMode && !faceEnrolled && (
            <div
              className="flex items-start gap-2.5 rounded-xl px-3 py-2.5 mb-4 text-sm"
              style={{ background: warningAlpha(0.1), color: colors.text.primary }}
            >
              <AlertTriangle size={16} style={{ color: colors.status.warning, flexShrink: 0, marginTop: 1 }} />
              <span>
                <span className="font-semibold">Face not registered.</span>{' '}
                Position your face in the camera and tap <em>Save</em> to complete setup. You only need to do this once.
              </span>
            </div>
          )}

          <div className="space-y-4">

            {/* Clinic selector — check-in only */}
            {!checkedIn && !enrollMode && (
              <Select
                label="Clinic"
                value={selectedClinicId}
                onChange={e => setSelectedClinicId(e.target.value)}
                options={clinicOptions}
              />
            )}

            {/* Location — check-in only */}
            {!enrollMode && !checkedIn && (
              <div>
                <p className="text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: colors.text.dim }}>
                  Location
                </p>
                {geoStatus === 'ok' ? (
                  <div className="flex items-center gap-2 text-sm" style={{ color: colors.status.success }}>
                    <CheckCircle size={14} />
                    Location captured
                  </div>
                ) : geoStatus === 'loading' ? (
                  <div className="flex items-center gap-2 text-sm" style={{ color: colors.text.muted }}>
                    <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
                    Getting location…
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={getLocation}
                      className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all min-h-[44px]"
                      style={(geoStatus === 'denied' || geoStatus === 'permission-denied')
                        ? { background: dangerAlpha(0.08), color: colors.status.error, border: `1px solid ${dangerAlpha(0.3)}` }
                        : { background: warningAlpha(0.08), color: colors.text.primary, border: `1px solid ${colors.text.dim}` }
                      }
                    >
                      <MapPin size={15} />
                      {geoStatus === 'permission-denied' ? 'Location access denied' :
                       geoStatus === 'denied' ? 'Location denied — tap to retry' : 'Allow location access'}
                    </button>
                    {geoStatus === 'permission-denied' && (
                      <p className="text-xs" style={{ color: colors.text.muted }}>
                        Location permission was blocked. On iPhone, go to{' '}
                        <strong style={{ color: colors.text.primary }}>Settings → Safari (or your browser) → Location</strong>{' '}
                        and set it to Allow. On Android, tap the lock icon in your browser address bar.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Camera — enroll and check-in; not check-out */}
            {(enrollMode || !checkedIn) && (
              <CameraView mode={enrollMode ? 'enroll' : 'checkin'} />
            )}

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              {enrollMode ? (
                <>
                  <Button
                    onClick={() => enrollMut.mutate()}
                    loading={isWorking}
                    disabled={enrollScanStatus !== 'detected'}
                  >
                    <UserCheck size={15} />
                    Save
                  </Button>
                  <Button variant="secondary" onClick={() => { setEnrollMode(false); stopCamera() }}>
                    Cancel
                  </Button>
                </>
              ) : checkedIn ? (
                <Button onClick={() => checkOutMut.mutate()} loading={isWorking}>
                  <LogOut size={15} />
                  Check Out
                </Button>
              ) : faceMatchStatus === 'checking' || checkInMut.isPending ? (
                <div className="flex items-center gap-2 text-sm" style={{ color: colors.status.success }}>
                  <span className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
                  Matching face…
                </div>
              ) : scanStatus === 'detected' ? (
                <div className="flex items-center gap-2 text-sm" style={{ color: colors.status.success }}>
                  <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                  {geoStatus === 'ok' ? 'Face detected — submitting…' : 'Face detected — waiting for location…'}
                </div>
              ) : scanStatus === 'scanning' ? (
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2 text-sm" style={{ color: colors.text.muted }}>
                    <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                    Detecting face…
                  </div>
                  {canCheckIn && (
                    <button
                      onClick={() => { stopCheckInScan(); checkInMut.mutate(undefined) }}
                      disabled={isWorking}
                      className="text-xs underline"
                      style={{ color: colors.text.muted }}
                    >
                      check in manually
                    </button>
                  )}
                </div>
              ) : (
                <Button
                  onClick={() => checkInMut.mutate(undefined)}
                  loading={isWorking}
                  disabled={!canCheckIn}
                >
                  <LogIn size={15} />
                  Check In
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* ── Done for today — only when not in enroll mode ── */}
      {checkedOut && !reCheckIn && !enrollMode && (
        <Card>
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <CheckCircle size={40} style={{ color: colors.status.success }} />
            <p className="font-semibold" style={{ color: colors.text.heading }}>You're done for today</p>
            <p className="text-sm" style={{ color: colors.text.muted }}>
              Checked in at {formatTime(today?.checkInTime ?? null)} · Checked out at {formatTime(today?.checkOutTime ?? null)}
            </p>
            <button
              className="text-sm underline mt-1"
              style={{ color: colors.accent }}
              onClick={() => {
                didAutoCheckIn.current = false
                setReCheckIn(true)
                getLocation()
                startCamera()
              }}
            >
              Check in again
            </button>
          </div>
        </Card>
      )}

      {/* ── Re-register link ── */}
      {!enrollMode && faceEnrolled && (
        <p className="text-xs text-center" style={{ color: colors.text.muted }}>
          <button
            onClick={() => { setEnrollMode(true); startCamera() }}
            className="underline font-medium"
            style={{ color: colors.accent }}
          >
            Re-register face
          </button>
        </p>
      )}

      <RecentHistory />
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}

function RecentHistory() {
  const { data: records = [], isLoading } = useQuery({
    queryKey: ['attendance', 'my'],
    queryFn: () => attendanceApi.listMine(),
  })

  if (isLoading || records.length === 0) return null

  const recent = records.slice(0, 7)

  return (
    <Card>
      <h2 className="text-base font-semibold mb-4" style={{ color: colors.text.heading }}>
        Recent History
      </h2>

      <div className="flex flex-col gap-2 md:hidden">
        {recent.map(r => (
          <div key={r.id} className="flex items-center justify-between py-2" style={{ borderBottom: `1px solid ${colors.text.dim}20` }}>
            <div>
              <p className="text-sm font-medium" style={{ color: colors.text.primary }}>
                {new Date(r.attendanceDate).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
              </p>
              <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>
                <Clock size={10} className="inline mr-1" />
                {formatTime(r.checkInTime)} → {formatTime(r.checkOutTime)}
              </p>
            </div>
            <div className="flex flex-col gap-1 items-end">
              <VerifyBadge ok={r.geoVerified}  label="Geo" />
              <VerifyBadge ok={r.faceVerified} label="Face" />
            </div>
          </div>
        ))}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: colors.text.dim }}>
              <th className="text-left py-2 font-medium text-xs uppercase tracking-wider">Date</th>
              <th className="text-left py-2 font-medium text-xs uppercase tracking-wider">Clinic</th>
              <th className="text-left py-2 font-medium text-xs uppercase tracking-wider">Check In</th>
              <th className="text-left py-2 font-medium text-xs uppercase tracking-wider">Check Out</th>
              <th className="text-left py-2 font-medium text-xs uppercase tracking-wider">Verification</th>
            </tr>
          </thead>
          <tbody>
            {recent.map(r => (
              <tr key={r.id} style={{ borderTop: `1px solid ${colors.text.dim}20` }}>
                <td className="py-2.5 pr-4" style={{ color: colors.text.primary }}>
                  {new Date(r.attendanceDate).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                </td>
                <td className="py-2.5 pr-4" style={{ color: colors.text.muted }}>{r.clinicName}</td>
                <td className="py-2.5 pr-4" style={{ color: colors.text.primary }}>{formatTime(r.checkInTime)}</td>
                <td className="py-2.5 pr-4" style={{ color: colors.text.primary }}>{formatTime(r.checkOutTime)}</td>
                <td className="py-2.5">
                  <div className="flex gap-1.5">
                    <VerifyBadge ok={r.geoVerified}  label="Geo" />
                    <VerifyBadge ok={r.faceVerified} label="Face" />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
