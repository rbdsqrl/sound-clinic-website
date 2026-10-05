import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { evidenceApi } from '../../api/evidence'
import { Card, CardHeader } from '../ui/Card'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'
import { useToast } from '../../hooks/useToast'
import { getApiError } from '../../lib/apiError'
import { colors } from '../../theme'

/**
 * The organisation's rules for IEP goal video evidence: how many videos a goal needs before it can
 * be completed, and the size and length limits on each video. Therapists who can't upload can
 * still complete a goal by recording why — that shows up in the evidence report.
 */
export function EvidenceSettingsCard({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient()
  const { toast } = useToast()
  const { data } = useQuery({ queryKey: ['evidence-settings'], queryFn: evidenceApi.getSettings })

  const [videosRequired, setVideosRequired] = useState('1')
  const [maxMb, setMaxMb] = useState('50')
  const [maxSeconds, setMaxSeconds] = useState('120')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!data) return
    setVideosRequired(String(data.videosRequired))
    setMaxMb(String(data.maxVideoMb))
    setMaxSeconds(String(data.maxVideoSeconds))
  }, [data])

  const saveMut = useMutation({
    mutationFn: () => evidenceApi.updateSettings({
      videosRequired: Number(videosRequired), maxVideoMb: Number(maxMb), maxVideoSeconds: Number(maxSeconds),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['evidence-settings'] }); setError(null); toast('Evidence settings saved', 'success') },
    onError: (err) => setError(getApiError(err, 'Could not save the settings')),
  })

  const required = Number(videosRequired)
  const dirty = !!data && (required !== data.videosRequired || Number(maxMb) !== data.maxVideoMb || Number(maxSeconds) !== data.maxVideoSeconds)
  const valid = Number.isInteger(required) && required >= 0 && required <= 10
    && Number(maxMb) >= 1 && Number(maxMb) <= 100 && Number(maxSeconds) >= 5 && Number(maxSeconds) <= 900

  return (
    <Card>
      <CardHeader
        title="Goal Video Evidence"
        subtitle="How many videos an IEP goal needs before it can be marked completed, and the limits on each video"
      />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Input label="Videos required per goal" type="number" min={0} max={10} value={videosRequired}
          disabled={!canEdit} onChange={e => setVideosRequired(e.target.value)} />
        <Input label="Largest video (MB)" type="number" min={1} max={100} value={maxMb}
          disabled={!canEdit} onChange={e => setMaxMb(e.target.value)} />
        <Input label="Longest video (seconds)" type="number" min={5} max={900} value={maxSeconds}
          disabled={!canEdit} onChange={e => setMaxSeconds(e.target.value)} />
      </div>
      <p className="text-xs mt-3" style={{ color: colors.text.dim }}>
        {required === 0
          ? 'Video evidence is optional — goals can be completed without one.'
          : `Each goal needs ${required} video${required === 1 ? '' : 's'} to be completed. A therapist who can't upload can still complete the goal by recording the reason — it appears in the evidence report. The upload ceiling is 100 MB.`}
        {' '}The length limit is checked on the therapist's device before upload.
      </p>
      {error && <p className="text-sm mt-3" style={{ color: colors.status.danger }}>{error}</p>}
      {canEdit && (
        <div className="flex justify-end mt-4">
          <Button onClick={() => { setError(null); saveMut.mutate() }} disabled={!dirty || !valid} loading={saveMut.isPending}>Save</Button>
        </div>
      )}
    </Card>
  )
}
