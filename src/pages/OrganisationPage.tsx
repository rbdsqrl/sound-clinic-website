import { useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { Building2, CalendarOff, FileUp, Pencil, Plus, Trash2, X } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { organisationApi } from '../api/organisation'
import { publicHolidaysApi } from '../api/publicHolidays'
import { Card, CardHeader } from '../components/ui/Card'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { PageLoader } from '../components/ui/Spinner'
import { ToastContainer } from '../components/ui/Toast'
import { useToast } from '../hooks/useToast'
import { useAuth } from '../contexts/AuthContext'
import { colors, border, accentAlpha } from '../theme'
import type { UpdateOrganisationRequest, CreatePublicHolidayRequest } from '../types'

// ── CSV parser ─────────────────────────────────────────────────────────────────
function parseCsv(text: string): { holidayDate: string; name: string }[] {
  const rows = text.trim().split(/\r?\n/).filter(Boolean)
  const results: { holidayDate: string; name: string }[] = []
  for (const row of rows) {
    // Support comma or semicolon separators; handle quoted fields
    const parts = row.split(/,|;/).map(p => p.trim().replace(/^"|"$/g, ''))
    const [col0, ...rest] = parts
    const name = rest.join(',').trim()
    // Skip header row
    if (/^date$/i.test(col0)) continue
    // Validate YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(col0)) continue
    if (!name) continue
    results.push({ holidayDate: col0, name })
  }
  return results
}

// ── CSV preview row ────────────────────────────────────────────────────────────
type CsvRow = { holidayDate: string; name: string; error?: string }

export default function OrganisationPage() {
  const [editing, setEditing] = useState(false)
  const [addingHoliday, setAddingHoliday] = useState(false)
  const [holidayDate, setHolidayDate] = useState('')
  const [holidayName, setHolidayName] = useState('')
  const [csvRows, setCsvRows] = useState<CsvRow[] | null>(null)
  const [csvUploading, setCsvUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { toasts, toast, dismiss } = useToast()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const canManageHolidays = user?.role === 'BUSINESS_OWNER' || user?.role === 'ADMIN'

  const { data: org, isLoading } = useQuery({
    queryKey: ['organisation'],
    queryFn: organisationApi.get,
  })

  const { data: holidays = [] } = useQuery({
    queryKey: ['public-holidays'],
    queryFn: publicHolidaysApi.list,
  })

  const createHolidayMutation = useMutation({
    mutationFn: (data: CreatePublicHolidayRequest) => publicHolidaysApi.create(data),
    onSuccess: (h) => {
      queryClient.invalidateQueries({ queryKey: ['public-holidays'] })
      const msg = h.sessionsAffected > 0
        ? `Holiday added — ${h.sessionsAffected} session${h.sessionsAffected !== 1 ? 's' : ''} flagged for rescheduling`
        : 'Holiday added'
      toast(msg, 'success')
      setAddingHoliday(false)
      setHolidayDate('')
      setHolidayName('')
    },
    onError: () => toast('Failed to add holiday', 'error'),
  })

  const deleteHolidayMutation = useMutation({
    mutationFn: publicHolidaysApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['public-holidays'] })
      toast('Holiday removed', 'success')
    },
    onError: () => toast('Failed to remove holiday', 'error'),
  })

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<UpdateOrganisationRequest>()

  const mutation = useMutation({
    mutationFn: organisationApi.update,
    onSuccess: (updated) => {
      queryClient.setQueryData(['organisation'], updated)
      toast('Organisation updated', 'success')
      setEditing(false)
    },
    onError: () => toast('Failed to update organisation', 'error'),
  })

  const startEdit = () => {
    if (org) reset({ name: org.name, contactEmail: org.contactEmail ?? '', contactPhone: org.contactPhone ?? '', address: org.address ?? '', logoUrl: org.logoUrl ?? '', timezone: org.timezone })
    setEditing(true)
  }

  // ── CSV handlers ─────────────────────────────────────────────────────────────

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const parsed = parseCsv(text)
      if (parsed.length === 0) {
        toast('No valid rows found. Expected format: date (YYYY-MM-DD), name', 'error')
        return
      }
      setCsvRows(parsed)
    }
    reader.readAsText(file)
    // Reset so same file can be re-selected
    e.target.value = ''
  }

  const handleCsvImport = async () => {
    if (!csvRows) return
    setCsvUploading(true)
    let added = 0, skipped = 0, totalAffected = 0
    for (const row of csvRows) {
      try {
        const result = await publicHolidaysApi.create({ holidayDate: row.holidayDate, name: row.name })
        added++
        totalAffected += result.sessionsAffected
      } catch {
        skipped++
      }
    }
    queryClient.invalidateQueries({ queryKey: ['public-holidays'] })
    const parts = [`${added} holiday${added !== 1 ? 's' : ''} added`]
    if (totalAffected > 0) parts.push(`${totalAffected} session${totalAffected !== 1 ? 's' : ''} flagged`)
    if (skipped > 0) parts.push(`${skipped} skipped (duplicates)`)
    toast(parts.join(' · '), added > 0 ? 'success' : 'error')
    setCsvRows(null)
    setCsvUploading(false)
  }

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: colors.text.heading }}>Organisation</h1>
        <p className="mt-1 text-sm" style={{ color: colors.text.muted }}>Your organisation profile and settings</p>
      </div>

      <Card>
        <CardHeader
          title="Profile"
          subtitle="Manage your organisation's details"
          action={!editing ? (
            <Button variant="secondary" size="sm" onClick={startEdit}>
              <Pencil size={14} /> Edit
            </Button>
          ) : undefined}
        />

        {!editing ? (
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              ['Name', org?.name],
              ['Slug', org?.slug],
              ['Email', org?.contactEmail],
              ['Phone', org?.contactPhone],
              ['Timezone', org?.timezone],
              ['Address', org?.address],
            ].map(([label, value]) => (
              <div key={label as string}>
                <dt className="text-xs font-medium uppercase tracking-wider" style={{ color: colors.text.dim }}>{label}</dt>
                <dd className="mt-1 text-sm" style={{ color: colors.text.primary }}>{value || <span style={{ color: colors.text.dim }}>—</span>}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input label="Name" error={errors.name?.message} {...register('name')} />
              <Input label="Contact Email" type="email" {...register('contactEmail')} />
              <Input label="Contact Phone" {...register('contactPhone')} />
              <Input label="Timezone" {...register('timezone')} />
            </div>
            <Input label="Address" {...register('address')} />
            <Input label="Logo URL" type="url" {...register('logoUrl')} />
            <div className="flex gap-3">
              <Button type="submit" loading={isSubmitting || mutation.isPending}>Save changes</Button>
              <Button type="button" variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </form>
        )}
      </Card>

      {/* Org ID + Slug info */}
      <Card>
        <CardHeader title="Deployment Info" />
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider" style={{ color: colors.text.dim }}>Organisation ID</dt>
            <dd className="mt-1 font-mono text-xs break-all" style={{ color: colors.text.muted }}>{org?.id}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider" style={{ color: colors.text.dim }}>Slug</dt>
            <dd className="mt-1 font-mono text-sm" style={{ color: colors.text.muted }}>{org?.slug}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wider" style={{ color: colors.text.dim }}>Status</dt>
            <dd className="mt-1">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${org?.isActive ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {org?.isActive ? 'Active' : 'Inactive'}
              </span>
            </dd>
          </div>
        </dl>
      </Card>

      {/* Public Holidays */}
      <Card>
        <CardHeader
          title="Public Holidays"
          subtitle="Sessions scheduled on these dates are flagged for rescheduling"
          action={canManageHolidays ? (
            <div className="flex items-center gap-2">
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleFileChange}
              />
              <Button variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                <FileUp size={14} /> Upload CSV
              </Button>
              <Button variant="secondary" size="sm" onClick={() => { setAddingHoliday(v => !v) }}>
                <Plus size={14} /> Add Holiday
              </Button>
            </div>
          ) : undefined}
        />

        {/* CSV format hint */}
        {canManageHolidays && (
          <p className="text-xs mb-4" style={{ color: colors.text.dim }}>
            CSV format: <code className="font-mono">date,name</code> — one row per holiday, date as <code className="font-mono">YYYY-MM-DD</code>. Header row optional. Duplicates are skipped.
          </p>
        )}

        {/* CSV preview before import */}
        {csvRows && (
          <div className="mb-4 rounded-xl overflow-hidden" style={{ border: `1px solid ${border.divider}` }}>
            <div className="flex items-center justify-between px-4 py-2.5"
              style={{ background: accentAlpha(0.06), borderBottom: `1px solid ${border.divider}` }}>
              <p className="text-sm font-medium" style={{ color: colors.text.primary }}>
                {csvRows.length} holiday{csvRows.length !== 1 ? 's' : ''} ready to import
              </p>
              <button onClick={() => setCsvRows(null)} style={{ color: colors.text.dim }}>
                <X size={16} />
              </button>
            </div>
            <div className="max-h-60 overflow-y-auto">
              {csvRows.map((row, i) => (
                <div key={i} className="flex items-center gap-4 px-4 py-2.5 text-sm"
                  style={{ borderBottom: i < csvRows.length - 1 ? `1px solid ${border.divider}` : undefined }}>
                  <span className="font-mono text-xs w-28 flex-shrink-0" style={{ color: colors.text.muted }}>
                    {format(parseISO(row.holidayDate), 'd MMM yyyy')}
                  </span>
                  <span style={{ color: colors.text.primary }}>{row.name}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 px-4 py-3" style={{ borderTop: `1px solid ${border.divider}` }}>
              <Button variant="secondary" size="sm" onClick={() => setCsvRows(null)}>Cancel</Button>
              <Button size="sm" loading={csvUploading} onClick={handleCsvImport}>
                Import {csvRows.length} holiday{csvRows.length !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        )}

        {/* Single-add inline form */}
        {addingHoliday && (
          <div className="mb-4 p-4 rounded-xl flex flex-col sm:flex-row gap-3 items-end"
            style={{ background: accentAlpha(0.04), border: `1px solid ${border.divider}` }}>
            <Input
              label="Date"
              type="date"
              value={holidayDate}
              onChange={e => setHolidayDate(e.target.value)}
            />
            <div className="flex-1">
              <Input
                label="Holiday name"
                placeholder="e.g. Republic Day"
                value={holidayName}
                onChange={e => setHolidayName(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!holidayDate || !holidayName.trim()}
                loading={createHolidayMutation.isPending}
                onClick={() => createHolidayMutation.mutate({ holidayDate, name: holidayName.trim() })}
              >
                Add
              </Button>
              <Button size="sm" variant="secondary" onClick={() => { setAddingHoliday(false); setHolidayDate(''); setHolidayName('') }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {holidays.length === 0 ? (
          <div className="flex items-center gap-3 py-6 justify-center">
            <CalendarOff size={20} style={{ color: colors.text.dim }} />
            <p className="text-sm" style={{ color: colors.text.muted }}>No public holidays defined yet</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: border.divider }}>
            {holidays.map(h => (
              <div key={h.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium" style={{ color: colors.text.primary }}>{h.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: colors.text.muted }}>
                    {format(parseISO(h.holidayDate), 'EEEE, d MMMM yyyy')}
                  </p>
                </div>
                {canManageHolidays && (
                  <button
                    onClick={() => deleteHolidayMutation.mutate(h.id)}
                    className="p-2 rounded-lg transition-colors"
                    style={{ color: colors.text.dim }}
                    title="Remove holiday"
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  )
}
