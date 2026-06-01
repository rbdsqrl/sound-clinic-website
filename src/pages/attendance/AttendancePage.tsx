import { useRef, useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as faceapi from 'face-api.js'
import { Camera, MapPin, CheckCircle, XCircle, Clock, LogIn, LogOut, UserCheck, AlertTriangle } from 'lucide-react'
import { attendanceApi } from '../../api/attendance'
import { clinicsApi } from '../../api/clinics'
import { useAuth } from '../../contexts/AuthContext'
import { Select } from '../../components/ui/Select'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { PageLoader } from '../../components/ui/Spinner'
import { ToastContainer } from '../../components/ui/Toast'
import { useToast } from '../../hooks/useToast'
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

export default function AttendancePage() {
  const { user } = useAuth()
  const { toasts, toast, dismiss } = useToast()
  const qc = useQueryClient()

  const videoRef          = useRef<HTMLVideoElement>(null)
  const canvasRef         = useRef<HTMLCanvasElement>(null)
  const streamRef         = useRef<MediaStream | null>(null)
  const modelsLoadPromise = useRef<Promise<void> | null>(null)
  const didAutoEnroll     = useRef(false)

  const [faceEnrolled, setFaceEnrolled]         = useState(user?.faceEnrolled ?? false)
  const [selectedClinicId, setSelectedClinicId] = useState('')
  const [cameraActive, setCameraActive]         = useState(false)
  const [modelsLoaded, setModelsLoaded]         = useState(false)
  const [modelsLoading, setModelsLoading]       = useState(false)
  const [geoStatus, setGeoStatus]               = useState<'idle' | 'loading' | 'ok' | 'denied'>('idle')
  const [location, setLocation]                 = useState<{ lat: number; lon: number } | null>(null)
  const [enrollMode, setEnrollMode]             = useState(!( user?.faceEnrolled ?? false))

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

  // ── Load face-api.js models ───────────────────────────────────────────────────

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
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude })
        setGeoStatus('ok')
      },
      () => {
        setGeoStatus('denied')
        toast('Location access denied — geo-fence verification will be skipped', 'info')
      },
    )
  }, [toast])

  // ── Camera ────────────────────────────────────────────────────────────────────

  const startCamera = useCallback(async () => {
    await loadModels()
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
      streamRef.current = stream
      setCameraActive(true)
    } catch {
      toast('Camera access denied', 'error')
    }
  }, [loadModels, toast])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCameraActive(false)
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [cameraActive])

  // Auto-open camera for enrollment if face not yet registered
  useEffect(() => {
    if (didAutoEnroll.current || faceEnrolled) return
    didAutoEnroll.current = true
    startCamera()
  }, [faceEnrolled, startCamera])

  // ── Capture face descriptor ───────────────────────────────────────────────────

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
    mutationFn: async () => {
      const descriptor = cameraActive ? await captureFaceDescriptor() : undefined
      return attendanceApi.checkIn({
        clinicId: selectedClinicId,
        latitude: location?.lat,
        longitude: location?.lon,
        faceDescriptor: descriptor,
      })
    },
    onSuccess: (data: AttendanceResponse) => {
      qc.setQueryData(['attendance', 'today'], data)
      qc.invalidateQueries({ queryKey: ['attendance'] })
      toast('Checked in successfully', 'success')
      stopCamera()
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Check-in failed'
      toast(msg, 'error')
    },
  })

  const checkOutMut = useMutation({
    mutationFn: async () => {
      const descriptor = cameraActive ? await captureFaceDescriptor() : undefined
      return attendanceApi.checkOut({
        latitude: location?.lat,
        longitude: location?.lon,
        faceDescriptor: descriptor,
      })
    },
    onSuccess: (data: AttendanceResponse) => {
      qc.setQueryData(['attendance', 'today'], data)
      qc.invalidateQueries({ queryKey: ['attendance'] })
      toast('Checked out successfully', 'success')
      stopCamera()
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? 'Check-out failed'
      toast(msg, 'error')
    },
  })

  const enrollMut = useMutation({
    mutationFn: async () => {
      const descriptor = await captureFaceDescriptor()
      if (!descriptor) throw new Error('No face detected')
      return attendanceApi.enrollFace({ faceDescriptor: descriptor })
    },
    onSuccess: () => {
      toast('Face enrolled successfully', 'success')
      setFaceEnrolled(true)
      setEnrollMode(false)
      stopCamera()
    },
    onError: () => toast('Face enrollment failed', 'error'),
  })

  if (loadingToday) return <PageLoader />

  const checkedIn  = today?.status === 'CHECKED_IN'
  const checkedOut = today?.status === 'CHECKED_OUT'
  const isWorking  = checkInMut.isPending || checkOutMut.isPending || enrollMut.isPending

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-2xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div>
        <h1 className="text-lg md:text-xl font-bold" style={{ color: colors.text.heading }}>
          Attendance
        </h1>
        <p className="text-sm mt-1" style={{ color: colors.text.muted }}>
          {new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

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
        </Card>
      )}

      {/* ── Action card ── */}
      {!checkedOut && (
        <Card>
          <h2 className="text-base font-semibold mb-4" style={{ color: colors.text.heading }}>
            {enrollMode ? 'Enroll Face' : checkedIn ? 'Check Out' : 'Check In'}
          </h2>

          {!faceEnrolled && enrollMode && (
            <div
              className="flex items-start gap-2.5 rounded-xl px-3 py-2.5 mb-4 text-sm"
              style={{ background: warningAlpha(0.1), color: colors.text.primary }}
            >
              <AlertTriangle size={16} style={{ color: colors.status.warning, flexShrink: 0, marginTop: 1 }} />
              <span>
                <span className="font-semibold">Face not enrolled.</span> Position your face in the camera and tap <em>Save Face</em> to complete setup. You only need to do this once.
              </span>
            </div>
          )}

          <div className="space-y-4">

            {/* Clinic selector — only for check-in */}
            {!checkedIn && !enrollMode && (
              <Select
                label="Clinic"
                value={selectedClinicId}
                onChange={e => setSelectedClinicId(e.target.value)}
                options={clinicOptions}
              />
            )}

            {/* Step 1: Location */}
            {!enrollMode && (
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
                    : { background: warningAlpha(0.08), color: colors.text.primary, border: `1px solid ${colors.text.dim}` }
                  }
                >
                  <MapPin size={15} />
                  {geoStatus === 'loading' && 'Getting location…'}
                  {geoStatus === 'ok'      && 'Location captured'}
                  {geoStatus === 'denied'  && 'Location denied — try again'}
                  {geoStatus === 'idle'    && 'Allow location access'}
                </button>
              </div>
            )}

            {/* Step 2: Camera / Face */}
            <div>
              <p className="text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: colors.text.dim }}>
                {enrollMode ? 'Position your face in the camera' : 'Step 2 — Face verification'}
              </p>

              {!cameraActive ? (
                <Button
                  variant="secondary"
                  onClick={startCamera}
                  loading={modelsLoading}
                >
                  <Camera size={15} />
                  {modelsLoading ? 'Loading face models…' : 'Open Camera'}
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="relative rounded-xl overflow-hidden bg-black" style={{ aspectRatio: '4/3', maxHeight: 280 }}>
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
                    <div
                      className="absolute bottom-2 right-2 rounded-lg px-2 py-1 text-xs font-medium flex items-center gap-1"
                      style={{ background: 'rgba(0,0,0,0.6)', color: '#4ade80' }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                      Live
                    </div>
                  </div>
                  <button
                    onClick={stopCamera}
                    className="text-xs"
                    style={{ color: colors.text.muted }}
                  >
                    Close camera
                  </button>
                </div>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              {enrollMode ? (
                <>
                  <Button
                    onClick={() => enrollMut.mutate()}
                    loading={isWorking}
                    disabled={!cameraActive}
                  >
                    <UserCheck size={15} />
                    Save Face
                  </Button>
                  <Button variant="secondary" onClick={() => { setEnrollMode(false); stopCamera() }}>
                    Cancel
                  </Button>
                </>
              ) : checkedIn ? (
                <Button
                  onClick={() => checkOutMut.mutate()}
                  loading={isWorking}
                >
                  <LogOut size={15} />
                  Check Out
                </Button>
              ) : (
                <Button
                  onClick={() => checkInMut.mutate()}
                  loading={isWorking}
                  disabled={!selectedClinicId}
                >
                  <LogIn size={15} />
                  Check In
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* ── Checked out done state ── */}
      {checkedOut && (
        <Card>
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <CheckCircle size={40} style={{ color: colors.status.success }} />
            <p className="font-semibold" style={{ color: colors.text.heading }}>You're done for today</p>
            <p className="text-sm" style={{ color: colors.text.muted }}>
              Checked in at {formatTime(today?.checkInTime ?? null)} · Checked out at {formatTime(today?.checkOutTime ?? null)}
            </p>
          </div>
        </Card>
      )}

      {/* ── Re-enroll shortcut (only shown after already enrolled) ── */}
      {!enrollMode && !checkedIn && !checkedOut && faceEnrolled && (
        <p className="text-xs text-center" style={{ color: colors.text.muted }}>
          <button
            onClick={() => { setEnrollMode(true); startCamera() }}
            className="underline font-medium"
            style={{ color: colors.accent }}
          >
            Re-enroll face
          </button>
        </p>
      )}

      {/* ── Recent history ── */}
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

  if (isLoading) return null
  if (records.length === 0) return null

  const recent = records.slice(0, 7)

  return (
    <Card>
      <h2 className="text-base font-semibold mb-4" style={{ color: colors.text.heading }}>
        Recent History
      </h2>

      {/* Mobile card list */}
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

      {/* Desktop table */}
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
