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
import { useFaceScan } from '../../hooks/useFaceScan'
import type { FaceMatchStatus } from '../../hooks/useFaceScan'
import { getApiError } from '../../lib/apiError'
import { colors, successAlpha, dangerAlpha, warningAlpha } from '../../theme'
import { CameraView } from './CameraView'
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

function ReadinessPill({ ok, icon, label }: { ok: boolean; icon: React.ReactNode; label: string }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium"
      style={{
        background: ok ? successAlpha(0.1) : `${colors.text.dim}18`,
        color: ok ? colors.status.success : colors.text.muted,
      }}
    >
      {ok ? <CheckCircle size={11} /> : icon}
      {label}
    </span>
  )
}

export default function AttendancePage({ asTab = false }: { asTab?: boolean }) {
  const { user, refreshUser } = useAuth()
  const { toasts, toast, dismiss } = useToast()
  const qc = useQueryClient()

  const videoRef          = useRef<HTMLVideoElement | null>(null)
  const canvasRef         = useRef<HTMLCanvasElement>(null)
  const streamRef         = useRef<MediaStream | null>(null)
  const modelsLoadPromise = useRef<Promise<void> | null>(null)
  const didAutoEnroll     = useRef(false)
  const didAutoCheckIn    = useRef(false)

  const [selectedClinicId, setSelectedClinicId] = useState('')
  const [cameraActive, setCameraActive]         = useState(false)
  const [modelsLoaded, setModelsLoaded]         = useState(false)
  const [modelsLoading, setModelsLoading]       = useState(false)
  const [geoStatus, setGeoStatus]               = useState<'idle' | 'loading' | 'ok' | 'denied' | 'permission-denied'>('idle')
  const [location, setLocation]                 = useState<{ lat: number; lon: number } | null>(null)
  const [geoFenceError, setGeoFenceError]       = useState(false)
  const [enrollMode, setEnrollMode]             = useState(false)
  const [showVerifyForm, setShowVerifyForm]     = useState(false)
  const [reCheckIn, setReCheckIn]               = useState(false)
  const [faceMatchStatus, setFaceMatchStatus]   = useState<FaceMatchStatus>('idle')
  const [showForceCheckIn, setShowForceCheckIn] = useState(false)

  const faceEnrolled = user?.faceEnrolled ?? false

  useEffect(() => { refreshUser() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setEnrollMode(!faceEnrolled)
  }, [faceEnrolled])

  // ── Data queries ──────────────────────────────────────────────────────────────

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
    setShowForceCheckIn(false)
  }, [])

  // Callback ref: sets srcObject immediately whenever the <video> node mounts or remounts.
  const setVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node
    if (node && streamRef.current) {
      node.srcObject = streamRef.current
    }
  }, [])

  useEffect(() => () => { stopCamera() }, [stopCamera])

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') stopCamera()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [stopCamera])

  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [cameraActive])

  useEffect(() => {
    if (asTab) return
    if (didAutoEnroll.current || faceEnrolled) return
    didAutoEnroll.current = true
    startCamera()
  }, [asTab, faceEnrolled, startCamera])

  useEffect(() => {
    if (didAutoCheckIn.current || !faceEnrolled || loadingToday) return
    if (today?.status === 'CHECKED_IN' || today?.status === 'CHECKED_OUT') return
    didAutoCheckIn.current = true
    getLocation()
    if (!asTab) startCamera()
  }, [asTab, faceEnrolled, loadingToday, today?.status]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Face scans — one hook per mode ───────────────────────────────────────────
  // Hooks must appear before any conditional early returns.

  const checkedIn = today?.status === 'CHECKED_IN'

  const checkInScan = useFaceScan(
    cameraActive && faceEnrolled && !enrollMode && modelsLoaded && !checkedIn,
    videoRef,
  )
  const enrollScan = useFaceScan(
    enrollMode && cameraActive && modelsLoaded,
    videoRef,
    { oneShot: true },
  )
  const verifyScan = useFaceScan(
    showVerifyForm && cameraActive && modelsLoaded,
    videoRef,
  )

  // Reset faceMatchStatus when a face is re-detected after a failed match
  useEffect(() => {
    if (faceMatchStatus === 'no-match' &&
        (checkInScan.scanStatus === 'detected' || verifyScan.scanStatus === 'detected')) {
      setFaceMatchStatus('idle')
    }
  }, [checkInScan.scanStatus, verifyScan.scanStatus, faceMatchStatus])

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const checkInMut = useMutation({
    mutationFn: async (force: boolean) => {
      if (!checkInScan.descriptor) throw new Error('No face detected')
      return attendanceApi.checkIn({
        clinicId: selectedClinicId,
        latitude: location!.lat,
        longitude: location!.lon,
        faceDescriptor: checkInScan.descriptor,
        forceCheckIn: force,
      })
    },
    onSuccess: (data: AttendanceResponse) => {
      qc.setQueryData(['attendance', 'today'], data)
      qc.invalidateQueries({ queryKey: ['attendance'] })
      if (data.faceOverride) {
        setFaceMatchStatus('no-match')
        toast('Checked in — face not matched. Your manager has been notified.', 'info')
      } else {
        setFaceMatchStatus('matched')
        toast('Checked in successfully', 'success')
      }
      stopCamera()
      setReCheckIn(false)
    },
    onError: (err) => {
      const msg = getApiError(err, '')
      if (msg === 'FACE_MISMATCH') {
        setFaceMatchStatus('no-match')
        setShowForceCheckIn(true)
      } else {
        setFaceMatchStatus('no-match')
        toast(getApiError(err, 'Check-in failed'), 'error')
      }
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
    mutationFn: async () => attendanceApi.verify({
      latitude: location?.lat,
      longitude: location?.lon,
      faceDescriptor: verifyScan.descriptor ?? undefined,
    }),
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
      if (!enrollScan.descriptor) throw new Error('No face detected')
      return attendanceApi.enrollFace({ faceDescriptor: enrollScan.descriptor })
    },
    onSuccess: async () => {
      toast('Face registered successfully', 'success')
      stopCamera()
      await refreshUser()
    },
    onError: (err) => toast(getApiError(err, 'Face registration failed'), 'error'),
  })

  if (loadingToday) return <PageLoader />

  const checkedOut = today?.status === 'CHECKED_OUT'
  const isWorking  = checkInMut.isPending || checkOutMut.isPending || enrollMut.isPending
  const needsVerification = checkedIn && today && (!today.geoVerified || !today.faceVerified)
  const checkInReady = !!checkInScan.descriptor && geoStatus === 'ok' && !!selectedClinicId

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

            <CameraView
              mode="verify"
              scanStatus={verifyScan.scanStatus}
              hasCaptured={!!verifyScan.descriptor}
              faceMatchStatus={faceMatchStatus}
              cameraActive={cameraActive}
              modelsLoading={modelsLoading}
              videoRef={setVideoRef}
              canvasRef={canvasRef}
              onOpenCamera={startCamera}
              onClose={stopCamera}
            />

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                onClick={() => { setFaceMatchStatus('checking'); verifyMut.mutate() }}
                loading={verifyMut.isPending}
                disabled={!verifyScan.descriptor || geoStatus === 'loading'}
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
                setFaceMatchStatus('idle')
                verifyMut.reset()
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
            {!checkedIn && !enrollMode && (
              <Select
                label="Clinic"
                value={selectedClinicId}
                onChange={e => setSelectedClinicId(e.target.value)}
                options={clinicOptions}
              />
            )}

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

            {(enrollMode || !checkedIn) && (
              <CameraView
                mode={enrollMode ? 'enroll' : 'checkin'}
                scanStatus={enrollMode ? enrollScan.scanStatus : checkInScan.scanStatus}
                hasCaptured={enrollMode ? enrollScan.scanStatus === 'detected' : !!checkInScan.descriptor}
                faceMatchStatus={faceMatchStatus}
                cameraActive={cameraActive}
                modelsLoading={modelsLoading}
                videoRef={setVideoRef}
                canvasRef={canvasRef}
                onOpenCamera={startCamera}
                onClose={stopCamera}
                faceEnrolled={faceEnrolled}
                onReRegister={() => setEnrollMode(true)}
              />
            )}

            <div className="flex flex-col gap-3 pt-2">
              {enrollMode ? (
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={() => enrollMut.mutate()}
                    loading={isWorking}
                    disabled={enrollScan.scanStatus !== 'detected'}
                  >
                    <UserCheck size={15} />
                    Save
                  </Button>
                  <Button variant="secondary" onClick={() => { setEnrollMode(false); stopCamera() }}>
                    Cancel
                  </Button>
                </div>
              ) : checkedIn ? (
                <Button onClick={() => checkOutMut.mutate()} loading={isWorking}>
                  <LogOut size={15} />
                  Check Out
                </Button>
              ) : checkInMut.isPending || faceMatchStatus === 'checking' ? (
                <div className="flex items-center gap-2 text-sm" style={{ color: colors.text.muted }}>
                  <span className="h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
                  Verifying face…
                </div>
              ) : showForceCheckIn ? (
                <div className="space-y-3">
                  <div
                    className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm"
                    style={{ background: warningAlpha(0.1), border: `1px solid ${warningAlpha(0.3)}` }}
                  >
                    <AlertTriangle size={14} style={{ color: colors.status.warning, flexShrink: 0, marginTop: 1 }} />
                    <span style={{ color: colors.text.primary }}>
                      Your face was not recognised. You can still check in — your manager will be notified to review.
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      onClick={() => { setFaceMatchStatus('checking'); checkInMut.mutate(true) }}
                      loading={isWorking}
                    >
                      <LogIn size={15} />
                      Check in anyway
                    </Button>
                    <Button variant="secondary" onClick={() => { setShowForceCheckIn(false); setFaceMatchStatus('idle') }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : faceMatchStatus === 'no-match' ? (
                <div
                  className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm"
                  style={{ background: warningAlpha(0.08), border: `1px solid ${warningAlpha(0.2)}` }}
                >
                  <AlertTriangle size={14} style={{ color: colors.status.warning, flexShrink: 0, marginTop: 1 }} />
                  <span style={{ color: colors.text.primary }}>
                    Checked in — face not matched. Your manager has been notified to review.
                  </span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <ReadinessPill ok={geoStatus === 'ok'} icon={<MapPin size={11} />} label="Location" />
                    <ReadinessPill ok={!!checkInScan.descriptor} icon={<Camera size={11} />} label="Face" />
                  </div>
                  <Button
                    onClick={() => { setFaceMatchStatus('checking'); checkInMut.mutate(false) }}
                    loading={isWorking}
                    disabled={!checkInReady}
                  >
                    <LogIn size={15} />
                    Check In
                  </Button>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* ── Done for today ── */}
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
