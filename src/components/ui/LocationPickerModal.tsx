import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import markerIconUrl from 'leaflet/dist/images/marker-icon.png'
import markerIconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import markerShadowUrl from 'leaflet/dist/images/marker-shadow.png'
import { useState, useEffect, useCallback, useRef } from 'react'
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet'
import { Search, MapPin } from 'lucide-react'
import { Modal } from './Modal'
import { Button } from './Button'
import { colors, border } from '../../theme'

// Fix broken default marker icons in Vite builds
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIconUrl,
  iconRetinaUrl: markerIconRetinaUrl,
  shadowUrl: markerShadowUrl,
})

interface NominatimResult {
  place_id: number
  display_name: string
  lat: string
  lon: string
}

interface LocationPickerModalProps {
  open: boolean
  onClose: () => void
  initialLat?: number
  initialLng?: number
  onConfirm: (lat: number, lng: number) => void
}

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

function FlyToLocation({ target }: { target: [number, number] | null }) {
  const map = useMap()
  const prevRef = useRef<[number, number] | null>(null)
  useEffect(() => {
    if (
      target &&
      (prevRef.current?.[0] !== target[0] || prevRef.current?.[1] !== target[1])
    ) {
      map.setView(target, 15)
      prevRef.current = target
    }
  }, [target, map])
  return null
}

export function LocationPickerModal({
  open,
  onClose,
  initialLat,
  initialLng,
  onConfirm,
}: LocationPickerModalProps) {
  const defaultCenter: [number, number] = [
    initialLat ?? 20.5937,
    initialLng ?? 78.9629,
  ]

  const [position, setPosition] = useState<[number, number] | null>(
    initialLat != null && initialLng != null ? [initialLat, initialLng] : null
  )
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(
    initialLat != null && initialLng != null ? [initialLat, initialLng] : null
  )
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<NominatimResult[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (!open) return
    const pos =
      initialLat != null && initialLng != null
        ? ([initialLat, initialLng] as [number, number])
        : null
    setPosition(pos)
    setFlyTarget(pos)
    setSearch('')
    setResults([])
  }, [open, initialLat, initialLng])

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5`,
        { headers: { 'Accept-Language': 'en' } }
      )
      const data: NominatimResult[] = await res.json()
      setResults(data)
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  const handleSearchChange = (value: string) => {
    setSearch(value)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(value), 500)
  }

  const pickResult = (r: NominatimResult) => {
    const lat = parseFloat(r.lat)
    const lng = parseFloat(r.lon)
    setPosition([lat, lng])
    setFlyTarget([lat, lng])
    setResults([])
    setSearch(r.display_name)
  }

  const handleMapClick = (lat: number, lng: number) => {
    setPosition([lat, lng])
    setResults([])
  }

  const handleConfirm = () => {
    if (position) {
      onConfirm(position[0], position[1])
      onClose()
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Pick Location" size="lg">
      {/* Address search */}
      <div className="relative mb-3">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: colors.text.dim }}
        />
        <input
          className="form-input pl-9 w-full"
          placeholder="Search for an address…"
          value={search}
          onChange={e => handleSearchChange(e.target.value)}
          autoComplete="off"
        />
        {searching && (
          <span
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
            style={{ color: colors.text.dim }}
          >
            Searching…
          </span>
        )}

        {/* Nominatim results dropdown */}
        {results.length > 0 && (
          <ul
            className="absolute top-full left-0 right-0 z-[2000] mt-1 rounded-xl overflow-hidden shadow-lg text-sm"
            style={{
              background: 'var(--surface-card)',
              border: `1px solid ${border.divider}`,
            }}
          >
            {results.map(r => (
              <li key={r.place_id}>
                <button
                  type="button"
                  className="w-full text-left px-4 py-2.5 transition-colors"
                  style={{ color: colors.text.primary }}
                  onMouseEnter={e => {
                    ;(e.currentTarget as HTMLElement).style.background =
                      'rgba(var(--color-accent-raw),0.07)'
                  }}
                  onMouseLeave={e => {
                    ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                  }}
                  onClick={() => pickResult(r)}
                >
                  {r.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Map */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ height: 360, border: `1px solid ${border.divider}` }}
      >
        {open && (
          <MapContainer
            center={defaultCenter}
            zoom={position ? 14 : 5}
            style={{ height: '100%', width: '100%' }}
          >
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            />
            <MapClickHandler onMapClick={handleMapClick} />
            <FlyToLocation target={flyTarget} />
            {position && <Marker position={position} />}
          </MapContainer>
        )}
      </div>

      {/* Coordinates + confirm */}
      <div className="mt-4 flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs flex items-center gap-1" style={{ color: colors.text.dim }}>
          {position ? (
            <>
              <MapPin size={12} />
              {position[0].toFixed(6)}, {position[1].toFixed(6)}
            </>
          ) : (
            'Click the map or search above to pick a location'
          )}
        </p>
        <Button type="button" onClick={handleConfirm} disabled={!position}>
          Confirm Location
        </Button>
      </div>
    </Modal>
  )
}
