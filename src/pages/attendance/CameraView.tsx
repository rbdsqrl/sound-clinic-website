import { type RefObject } from 'react'
import { Camera, CheckCircle, AlertTriangle } from 'lucide-react'
import { Button } from '../../components/ui/Button'
import { colors, successAlpha, dangerAlpha } from '../../theme'
import type { ScanStatus, FaceMatchStatus } from '../../hooks/useFaceScan'

interface CameraViewProps {
  mode: 'enroll' | 'checkin' | 'verify'
  scanStatus: ScanStatus
  hasCaptured: boolean
  faceMatchStatus: FaceMatchStatus
  cameraActive: boolean
  modelsLoading: boolean
  videoRef: (node: HTMLVideoElement | null) => void
  canvasRef: RefObject<HTMLCanvasElement>
  onOpenCamera: () => void
  onClose: () => void
  faceEnrolled?: boolean
  onReRegister?: () => void
}

function cameraBadgeColor(faceMatch: FaceMatchStatus, scan: ScanStatus, hasCaptured: boolean) {
  if (faceMatch === 'matched')  return '#86efac'
  if (faceMatch === 'no-match') return '#f87171'
  if (faceMatch === 'checking') return '#fbbf24'
  if (hasCaptured || scan === 'detected') return '#86efac'
  if (scan === 'scanning')      return '#fbbf24'
  return '#4ade80'
}

function cameraBadgeDot(faceMatch: FaceMatchStatus, scan: ScanStatus, hasCaptured: boolean) {
  if (faceMatch === 'matched')  return 'bg-green-400'
  if (faceMatch === 'no-match') return 'bg-red-400'
  if (faceMatch === 'checking') return 'bg-yellow-400 animate-pulse'
  if (hasCaptured || scan === 'detected') return 'bg-green-400'
  if (scan === 'scanning')      return 'bg-yellow-400 animate-pulse'
  return 'bg-green-300'
}

function cameraBadgeLabel(faceMatch: FaceMatchStatus, scan: ScanStatus, hasCaptured: boolean) {
  if (faceMatch === 'matched')  return 'Face matched'
  if (faceMatch === 'no-match') return 'Face not recognised'
  if (faceMatch === 'checking') return 'Matching…'
  if (hasCaptured)              return 'Face captured'
  if (scan === 'detected')      return 'Face detected'
  if (scan === 'scanning')      return 'Detecting…'
  return 'Live'
}

export function CameraView({
  mode,
  scanStatus,
  hasCaptured,
  faceMatchStatus,
  cameraActive,
  modelsLoading,
  videoRef,
  canvasRef,
  onOpenCamera,
  onClose,
  faceEnrolled,
  onReRegister,
}: CameraViewProps) {
  const isEnroll  = mode === 'enroll'
  const isCheckin = mode === 'checkin'

  const ovalColor =
    faceMatchStatus === 'matched'  ? '#86efac' :
    faceMatchStatus === 'no-match' ? '#f87171' :
    faceMatchStatus === 'checking' ? '#fbbf24' :
    hasCaptured                    ? '#4ade80' :
    'rgba(255,255,255,0.6)'
  const ovalDashed = !hasCaptured && faceMatchStatus === 'idle'

  return (
    <div>
      <p className="text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: colors.text.dim }}>
        {isEnroll ? 'Position your face in the camera' : 'Face verification'}
      </p>
      {!cameraActive ? (
        <Button variant="secondary" onClick={onOpenCamera} loading={modelsLoading}>
          <Camera size={15} />
          {modelsLoading ? 'Loading face models…' : 'Open Camera'}
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="relative rounded-xl overflow-hidden bg-black" style={{ aspectRatio: '4/3', maxHeight: 280 }}>
            <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
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
            <div
              className="absolute bottom-2 right-2 rounded-lg px-2 py-1 text-xs font-medium flex items-center gap-1"
              style={{ background: 'rgba(0,0,0,0.6)', color: cameraBadgeColor(faceMatchStatus, scanStatus, hasCaptured) }}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${cameraBadgeDot(faceMatchStatus, scanStatus, hasCaptured)}`} />
              {cameraBadgeLabel(faceMatchStatus, scanStatus, hasCaptured)}
            </div>
          </div>

          {/* Enroll: face captured confirmation */}
          {isEnroll && hasCaptured && (
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

          {/* Verify: face not recognised */}
          {mode === 'verify' && faceMatchStatus === 'no-match' && (
            <div
              className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-sm"
              style={{ background: dangerAlpha(0.08), border: `1px solid ${dangerAlpha(0.2)}` }}
            >
              <AlertTriangle size={14} style={{ color: colors.status.error, flexShrink: 0, marginTop: 1 }} />
              <span style={{ color: colors.text.primary }}>
                Face not recognised. Ensure your face is well-lit and clearly visible, then tap <em>Verify Now</em> again.
              </span>
            </div>
          )}

          <div className="flex items-center justify-between">
            <button onClick={onClose} className="text-xs" style={{ color: colors.text.muted }}>
              Close camera
            </button>
            {isCheckin && faceEnrolled && onReRegister && (
              <button onClick={onReRegister} className="text-xs underline" style={{ color: colors.text.muted }}>
                Re-register face
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
