import { useRef, useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import * as faceapi from 'face-api.js'
import { LogIn, LogOut, CheckCircle2, Camera, MapPin, Clock, UserCheck, AlertTriangle } from 'lucide-react'
import { attendanceApi } from '../../api/attendance'
import { clinicsApi } from '../../api/clinics'
import { useAuth } from '../../contexts/AuthContext'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Select } from '../../components/ui/Select'
import { useToast } from '../../hooks/useToast'
import { ToastContainer } from '../../components/ui/Toast'
import { colors, styles, accentAlpha, successAlpha, dangerAlpha, warningAlpha } from '../../theme'
import type { AttendanceResponse } from '../../types'

const MODELS_PATH = '/models'

function formatTime(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export default function AttendanceWidget() {
  const { user, refreshUser } = useAuth()
  const { toasts, toast, dismiss } = useToast()
  const qc = useQueryClient()

  const faceEnrolled = user?.faceEnrolled ?? false
  const [enrollMode, setEnrollMode]   = useState(false)
  const [open, setOpen]               = useState(false)
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [modelsLoading, setModelsLoading] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)
  const [geoStatus, setGeoStatus]     = useState<'idle' | 'loading' | 'ok' | 'denied'>('idle')
  const [location, setLocation]       = useState<{ lat: number; lon: number } | null>(null)
  const [selectedClinicId, setSelectedClinicId] = useState('')

  const videoRef          = useRef<HTMLVideoElement>(null)
  const streamRef         = useRef<MediaStream | null>(null)
  const modelsLoadPromise = useRef<Promise<void> | null>(null)

  const { data: today, isLoading } = useQuery({
    queryKey: ['attendance', 'today'],
    queryFn: () => attendanceApi.today(),
  })

  const { data: clinics = [] } = useQuery({
    queryKey: ['clinics'],
    queryFn: () => clinicsApi.list(),
    enabled: open,
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

  // ── Models ────────────────────────────────────────────────────────────────

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

  // ── Geolocation ───────────────────────────────────────────────────────────

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) return
    setGeoStatus('loading')
    navigator.geolocation.getCurrentPosition(
      pos => { setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }); setGeoStatus('ok') },
      () => { setGeoStatus('denied'); toast('Location denied — geo-fence check skipped', 'info') },
    )
  }, [toast])

  // ── Camera ────────────────────────────────────────────────────────────────

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

  const closeModal = useCallback(() => {
    stopCamera()
    setOpen(false)
    setGeoStatus('idle')
    setLocation(null)
    setEnrollMode(false)
  }, [stopCamera])

  useEffect(() => () => stopCamera(), [stopCamera])

  useEffect(() => {
    if (cameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [cameraActive])

  useEffect(() => {
    if (open && enrollMode && !cameraActive) {
      startCamera()
    }
  }, [open, enrollMode, cameraActive, startCamera])

  // ── Face descriptor ───────────────────────────────────────────────────────

  const captureFaceDescriptor = useCallback(async (): Promise<number[] | undefined> => {
    if (!videoRef.current || !modelsLoaded) return undefined
    const detection = await faceapi
      .detectSingleFace(videoRef.current, new faceapi.SsdMobilenetv1Options())
      .withFaceLandmarks()
      .withFaceDescriptor()
    if (!detection) {
      toast('No face detected — ensure your face is clearly visible', 'error')
      return undefined
    }
    return Array.from(detection.descriptor)
  }, [modelsLoaded, toast])

  // ── Mutations ─────────────────────────────────────────────────────────────

  const checkInMut = useMutation({
    mutationFn: async () => {
      const descriptor = await captureFaceDescriptor()
      if (!descriptor) throw new Error('No face detected')
      return attendanceApi.checkIn({
        clinicId: selectedClinicId,
        latitude: location!.lat,
        longitude: location!.lon,
        faceDescriptor: descriptor,
      })
    },
    onSuccess: (data: AttendanceResponse) => {
      qc.setQueryData(['attendance', 'today'], data)
      qc.invalidateQueries({ queryKey: ['attendance'] })
      toast('Checked in successfully', 'success')
      closeModal()
    },
    onError: (err: any) => toast(err?.response?.data?.message ?? err?.message ?? 'Check-in failed', 'error'),
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
      closeModal()
    },
    onError: (err: any) => toast(err?.response?.data?.message ?? 'Check-out failed', 'error'),
  })

  const enrollMut = useMutation({
    mutationFn: async () => {
      const descriptor = await captureFaceDescriptor()
      if (!descriptor) throw new Error('No face detected')
      return attendanceApi.enrollFace({ faceDescriptor: descriptor })
    },
    onSuccess: async () => {
      toast('Face enrolled successfully', 'success')
      setEnrollMode(false)
      stopCamera()
      await refreshUser()
    },
    onError: () => toast('Face enrollment failed', 'error'),
  })


  if (isLoading) return null

  const checkedIn  = today?.status === 'CHECKED_IN'
  const checkedOut = today?.status === 'CHECKED_OUT'
  const isWorking  = checkInMut.isPending || checkOutMut.isPending || enrollMut.isPending

  // ── Status banner ─────────────────────────────────────────────────────────

  return (
    <>
      <div
        className="flex items-center justify-between gap-3 rounded-xl px-4 py-3"
        style={{
          background: checkedOut
            ? successAlpha(0.08)
            : checkedIn
            ? accentAlpha(0.08)
            : dangerAlpha(0.06),
          border: `1px solid ${checkedOut ? successAlpha(0.2) : checkedIn ? accentAlpha(0.15) : dangerAlpha(0.15)}`,
        }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {checkedOut ? (
            <CheckCircle2 size={16} style={{ color: colors.status.success, flexShrink: 0 }} />
          ) : checkedIn ? (
            <Clock size={16} style={{ color: colors.accent, flexShrink: 0 }} />
          ) : (
            <LogIn size={16} style={{ color: colors.status.error, flexShrink: 0 }} />
          )}

          <div className="min-w-0">
            {checkedOut && (
              <p className="text-sm font-medium truncate" style={{ color: colors.status.success }}>
                Done for today · {today.clinicName}
              </p>
            )}
            {checkedIn && (
              <p className="text-sm font-medium truncate" style={{ color: colors.accent }}>
                Checked in at {formatTime(today.checkInTime)} · {today.clinicName}
              </p>
            )}
            {!today && (
              <p className="text-sm font-medium" style={{ color: colors.status.error }}>
                Not checked in yet
              </p>
            )}
          </div>

          {(checkedIn || checkedOut) && (
            <div className="hidden sm:flex items-center gap-2 flex-shrink-0 ml-1">
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{
                  background: today!.geoVerified ? successAlpha(0.15) : dangerAlpha(0.1),
                  color: today!.geoVerified ? colors.status.success : colors.status.error,
                }}
              >
                {today!.geoVerified ? '✓' : '✗'} Geo
              </span>
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{
                  background: today!.faceVerified ? successAlpha(0.15) : dangerAlpha(0.1),
                  color: today!.faceVerified ? colors.status.success : colors.status.error,
                }}
              >
                {today!.faceVerified ? '✓' : '✗'} Face
              </span>
            </div>
          )}
        </div>

        {!checkedOut && (
          <button
            onClick={() => { setOpen(true); if (!faceEnrolled) { setEnrollMode(true) } }}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg flex-shrink-0 transition-opacity hover:opacity-75 min-h-[32px]"
            style={checkedIn
              ? { background: accentAlpha(0.12), color: colors.accent }
              : { background: dangerAlpha(0.1), color: colors.status.error }
            }
          >
            {checkedIn ? <><LogOut size={12} /> Check Out</> : <><LogIn size={12} /> Check In</>}
          </button>
        )}
      </div>

      {/* ── Modal ── */}
      <Modal
        open={open}
        onClose={closeModal}
        title={enrollMode ? 'Enroll Face' : checkedIn ? 'Check Out' : 'Check In'}
      >
        <div className="space-y-4">

          {/* Not-enrolled banner */}
          {enrollMode && !faceEnrolled && (
            <div
              className="flex items-start gap-2.5 rounded-xl px-3 py-2.5 text-sm"
              style={{ background: warningAlpha(0.1), color: colors.text.primary }}
            >
              <AlertTriangle size={15} style={{ color: colors.status.warning, flexShrink: 0, marginTop: 1 }} />
              <span>
                <span className="font-semibold">Face not enrolled.</span> Position your face in the camera and tap <em>Save Face</em>. One-time setup.
              </span>
            </div>
          )}

          {/* Enroll mode — camera only */}
          {enrollMode ? (
            <div>
              <p className="form-label">Position your face in the camera</p>
              {!cameraActive ? (
                <Button variant="secondary" onClick={startCamera} loading={modelsLoading}>
                  <Camera size={14} />
                  {modelsLoading ? 'Loading models…' : 'Open Camera'}
                </Button>
              ) : (
                <div className="space-y-2">
                  <div className="relative rounded-xl overflow-hidden bg-black" style={{ aspectRatio: '4/3', maxHeight: 240 }}>
                    <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                    <div
                      className="absolute bottom-2 right-2 rounded-lg px-2 py-0.5 text-xs font-medium flex items-center gap-1"
                      style={{ background: 'rgba(0,0,0,0.6)', color: '#4ade80' }}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                      Live
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Clinic selector (check-in only) */}
              {!checkedIn && (
                <Select
                  label="Clinic"
                  value={selectedClinicId}
                  onChange={e => setSelectedClinicId(e.target.value)}
                  options={clinicOptions}
                />
              )}

              {/* Step 1 — Location */}
              <div>
                <p className="form-label">Location</p>
                <button
                  onClick={getLocation}
                  disabled={geoStatus === 'ok' || geoStatus === 'loading'}
                  className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-all min-h-[40px] disabled:opacity-60"
                  style={geoStatus === 'ok'
                    ? { background: successAlpha(0.1), color: colors.status.success }
                    : geoStatus === 'denied'
                    ? { background: dangerAlpha(0.08), color: colors.status.error, border: `1px solid ${dangerAlpha(0.3)}` }
                    : { background: accentAlpha(0.07), color: colors.text.primary, border: `1px solid ${accentAlpha(0.15)}` }
                  }
                >
                  <MapPin size={14} />
                  {geoStatus === 'loading' && 'Getting location…'}
                  {geoStatus === 'ok'      && 'Location captured'}
                  {geoStatus === 'denied'  && 'Location denied — tap to retry'}
                  {geoStatus === 'idle'    && 'Allow location access'}
                </button>
              </div>

              {/* Step 2 — Camera */}
              <div>
                <p className="form-label">Face verification</p>
                {!cameraActive ? (
                  <Button variant="secondary" onClick={startCamera} loading={modelsLoading}>
                    <Camera size={14} />
                    {modelsLoading ? 'Loading models…' : 'Open Camera'}
                  </Button>
                ) : (
                  <div className="space-y-2">
                    <div className="relative rounded-xl overflow-hidden bg-black" style={{ aspectRatio: '4/3', maxHeight: 240 }}>
                      <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                      <div
                        className="absolute bottom-2 right-2 rounded-lg px-2 py-0.5 text-xs font-medium flex items-center gap-1"
                        style={{ background: 'rgba(0,0,0,0.6)', color: '#4ade80' }}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                        Live
                      </div>
                    </div>
                    <button onClick={stopCamera} className="text-xs" style={{ color: colors.text.muted }}>
                      Close camera
                    </button>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            {enrollMode ? (
              <>
                <Button onClick={() => enrollMut.mutate()} loading={isWorking} disabled={!cameraActive}>
                  <UserCheck size={14} /> Save Face
                </Button>
                <Button variant="secondary" onClick={closeModal}>Cancel</Button>
              </>
            ) : checkedIn ? (
              <Button onClick={() => checkOutMut.mutate()} loading={isWorking}>
                <LogOut size={14} /> Check Out
              </Button>
            ) : (
              <Button onClick={() => checkInMut.mutate()} loading={isWorking} disabled={!selectedClinicId || geoStatus !== 'ok' || !cameraActive}>
                <LogIn size={14} /> Check In
              </Button>
            )}
            {!enrollMode && <Button variant="secondary" onClick={closeModal}>Cancel</Button>}
          </div>
        </div>
      </Modal>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </>
  )
}
