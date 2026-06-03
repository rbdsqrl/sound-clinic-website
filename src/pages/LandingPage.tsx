import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  Phone, Mail, MapPin, Clock, ChevronRight,
  Baby, Brain, Activity, Waves, Mic2, Stethoscope,
  Award, Star, Users, ArrowRight, CheckCircle2,
} from 'lucide-react'
import { colors, gradient, shadow, accentAlpha, ctaAlpha, border, surface, LOGO_SRC } from '../theme'
import { inquiriesApi } from '../api/inquiries'
import { publicApi } from '../api/public'
import type { PreferredTime } from '../types'

// ── Data ──────────────────────────────────────────────────────────────────────

const SERVICES = [
  {
    icon: Baby,
    title: 'Pediatric Speech-Language Therapy',
    desc: 'Early identification and intervention for children with speech, language, and communication delays to support developmental milestones.',
    color: '#F28C8C',
    colorRaw: '242,140,140',
  },
  {
    icon: Brain,
    title: 'Sensory Integration Therapy',
    desc: 'Helping children process and respond to sensory information more effectively through structured therapeutic activities.',
    color: '#9864DC',
    colorRaw: '152,100,220',
  },
  {
    icon: Activity,
    title: 'Stroke Rehabilitation Therapy',
    desc: 'Specialised speech and language rehabilitation for adults recovering from stroke, restoring communication and swallowing function.',
    color: '#4FB6B2',
    colorRaw: '79,182,178',
  },
  {
    icon: Waves,
    title: 'Swallowing Disorder Therapy',
    desc: 'Expert assessment and treatment of dysphagia — swallowing difficulties — across all age groups using evidence-based techniques.',
    color: '#5A9FD4',
    colorRaw: '90,159,212',
  },
  {
    icon: Mic2,
    title: 'AVT for Cochlear Implant',
    desc: 'Auditory-Verbal Therapy to help cochlear implant recipients develop listening and spoken language skills to their full potential.',
    color: '#52B86A',
    colorRaw: '82,184,106',
  },
  {
    icon: Stethoscope,
    title: 'Cochlear Implant Clinic',
    desc: 'Comprehensive cochlear implant mapping, programming, and long-term auditory rehabilitation services under one roof.',
    color: '#E0A840',
    colorRaw: '224,168,64',
  },
]

const BRANDS = ['GN Resound', 'Starkey', 'Phonak', 'Oticon', 'Widex', 'Cochlear']

const STATS = [
  { value: '13+', label: 'Years of Experience' },
  { value: '6',   label: 'Specialist Services' },
  { value: '6',   label: 'Hearing Aid Brands' },
]

// ── Subcomponents ─────────────────────────────────────────────────────────────

function Navbar() {
  const { isAuthenticated } = useAuth()

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 py-3 sm:px-10"
      style={{
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(16px)',
        borderBottom: `1px solid rgba(43,128,200,0.10)`,
      }}
    >
      {/* Logo + name */}
      <div className="flex items-center gap-4">
        <img src={LOGO_SRC} alt="SimpleHearing" className="h-14 w-auto" />
        <div>
          <span className="text-xl font-bold tracking-tight" style={{ color: colors.text.heading }}>
            Simple Hearing & Speech Care
          </span>
          <div className="text-[10px] tracking-widest uppercase mt-0.5" style={{ color: colors.accent }}>
            Pune's Specialist Audiology Clinic
          </div>
        </div>
      </div>

      {/* Auth button */}
      <Link
        to={isAuthenticated ? '/dashboard' : '/login'}
        className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all"
        style={{
          background: gradient.buttonCta,
          color: '#fff',
          boxShadow: shadow.buttonCta,
        }}
      >
        {isAuthenticated ? 'Dashboard' : 'Sign In'} <ArrowRight size={14} />
      </Link>
    </header>
  )
}

function Hero() {
  return (
    <section
      className="relative flex min-h-screen items-center justify-center overflow-hidden px-6 pt-20"
      style={{
        background: `linear-gradient(180deg, #E8EEF6 0%, #EDF2FA 100%)`,
      }}
    >
      {/* Decorative circles — positioned well inside the section; very low opacity */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-48 left-1/2 -translate-x-1/2 h-96 w-[700px] rounded-full"
          style={{ background: 'rgba(79,182,178,0.07)', filter: 'blur(80px)' }}
        />
        <div
          className="absolute top-1/2 -right-32 h-72 w-72 rounded-full"
          style={{ background: 'rgba(167,216,240,0.08)', filter: 'blur(60px)' }}
        />
        <div
          className="absolute bottom-24 left-1/4 h-48 w-48 rounded-full"
          style={{ background: 'rgba(242,140,140,0.05)', filter: 'blur(50px)' }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        {/* Badge */}
        <span
          className="mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-widest"
          style={{
            background: accentAlpha(0.10),
            color: colors.accent,
            border: `1px solid ${accentAlpha(0.20)}`,
          }}
        >
          <Award size={12} /> Pune's Specialist Audiology Clinic
        </span>

        <h1
          className="mt-4 text-4xl font-bold leading-tight sm:text-5xl lg:text-6xl"
          style={{ color: colors.text.heading }}
        >
          A Seamless Journey to{' '}
          <span style={{ color: colors.accent }}>Better Hearing!</span>
        </h1>

        <p
          className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed"
          style={{ color: colors.text.muted }}
        >
          Expert audiology and speech therapy services led by Dr. Suravi Dash — Senior Audiologist,
          AVT Specialist and Cochlear Implant Expert with over 13 years of experience.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <a
            href="tel:+917666773596"
            className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-semibold transition-all"
            style={{
              background: gradient.buttonCta,
              color: '#fff',
              boxShadow: shadow.buttonCta,
            }}
          >
            <Phone size={16} /> Call +91 76667 73596
          </a>
          <a
            href="#services"
            className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-semibold transition-all"
            style={{
              background: accentAlpha(0.10),
              color: colors.accent,
              border: `1px solid ${accentAlpha(0.22)}`,
            }}
          >
            Our Services <ChevronRight size={16} />
          </a>
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-3 gap-4 sm:gap-8">
          {STATS.map(({ value, label }) => (
            <div
              key={label}
              className="rounded-2xl p-4 sm:p-6"
              style={{
                background: 'rgba(255,255,255,0.80)',
                border: `1px solid rgba(79,182,178,0.15)`,
                boxShadow: '0 2px 16px rgba(79,182,178,0.08)',
                backdropFilter: 'blur(8px)',
              }}
            >
              <p className="text-2xl font-bold sm:text-3xl" style={{ color: colors.accent }}>{value}</p>
              <p className="mt-1 text-xs sm:text-sm" style={{ color: colors.text.muted }}>{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Services() {
  return (
    <section id="services" className="px-6 py-20 sm:px-10" style={{ background: '#FFFFFF' }}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 text-center">
          <span
            className="inline-block rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-widest"
            style={{ background: accentAlpha(0.10), color: colors.accent }}
          >
            What We Offer
          </span>
          <h2 className="mt-4 text-3xl font-bold sm:text-4xl" style={{ color: colors.text.heading }}>
            Specialist Services
          </h2>
          <p className="mt-3 text-base" style={{ color: colors.text.muted }}>
            Comprehensive hearing and speech care tailored to every stage of life.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map(({ icon: Icon, title, desc, color, colorRaw }) => (
            <div
              key={title}
              className="group rounded-2xl p-6 transition-all"
              style={{
                background: '#FFFFFF',
                border: `1px solid rgba(0,0,0,0.07)`,
                boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 32px rgba(${colorRaw},0.15), 0 2px 8px rgba(0,0,0,0.06)`
                ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
                ;(e.currentTarget as HTMLElement).style.borderColor = `rgba(${colorRaw},0.30)`
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 12px rgba(0,0,0,0.05)'
                ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
                ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,0,0,0.07)'
              }}
            >
              <div
                className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl"
                style={{ background: `rgba(${colorRaw}, 0.12)`, color }}
              >
                <Icon size={24} />
              </div>
              <h3 className="font-semibold leading-snug" style={{ color: colors.text.primary }}>{title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: colors.text.muted }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function About() {
  return (
    <section
      className="px-6 py-20 sm:px-10"
      style={{ background: 'linear-gradient(135deg, #FFF7F4 0%, #F5F0FF 100%)' }}
    >
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col items-center gap-10 lg:flex-row lg:gap-16">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <div
              className="flex h-44 w-44 items-center justify-center rounded-3xl text-6xl font-bold shadow-lg"
              style={{
                background: 'linear-gradient(135deg, #F4EDFF 0%, #EBF4FF 100%)',
                border: '2px solid rgba(152,100,220,0.20)',
                color: '#9864DC',
              }}
            >
              SD
            </div>
          </div>

          {/* Content */}
          <div className="text-center lg:text-left">
            <span
              className="inline-block rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-widest"
              style={{
                background: 'rgba(152,100,220,0.10)',
                color: '#7A4DB8',
                border: '1px solid rgba(152,100,220,0.18)',
              }}
            >
              Meet the Expert
            </span>
            <h2 className="mt-4 text-3xl font-bold sm:text-4xl" style={{ color: '#2A2040' }}>
              Dr. Suravi Dash
            </h2>
            <p className="mt-1.5 font-medium" style={{ color: '#7A4DB8' }}>
              Sr. Audiologist &amp; Speech Therapist · AVT Specialist · Cochlear Implant Expert
            </p>
            <p className="mt-4 text-base leading-relaxed" style={{ color: '#5A4E6A' }}>
              With over 13 years of experience across leading hospitals and organisations in major Indian cities,
              Dr. Dash provides comprehensive audiological management programmes, diagnostic evaluations,
              and rehabilitative services — combining clinical precision with genuine compassion.
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-3 lg:justify-start">
              {['13+ Years Experience', 'AVT Specialist', 'Cochlear Implant Expert', 'Diagnostic Audiologist'].map(tag => (
                <span
                  key={tag}
                  className="rounded-full px-4 py-1.5 text-xs font-semibold"
                  style={{
                    background: 'rgba(152,100,220,0.09)',
                    color: '#6E40A8',
                    border: '1px solid rgba(152,100,220,0.22)',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Brands() {
  return (
    <section className="px-6 py-16 sm:px-10" style={{ background: '#FFFFFF' }}>
      <div className="mx-auto max-w-4xl text-center">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: colors.text.dim }}>
          Authorised Hearing Aid Brands
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
          {BRANDS.map(brand => (
            <div
              key={brand}
              className="rounded-xl px-5 py-2.5 text-sm font-semibold"
              style={{
                background: 'rgba(79,182,178,0.06)',
                border: '1px solid rgba(79,182,178,0.15)',
                color: colors.text.primary,
              }}
            >
              {brand}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Contact() {
  return (
    <section
      id="contact"
      className="px-6 py-20 sm:px-10"
      style={{ background: 'rgba(79,182,178,0.04)' }}
    >
      <div className="mx-auto max-w-5xl">
        <div className="mb-12 text-center">
          <span
            className="inline-block rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-widest"
            style={{ background: accentAlpha(0.10), color: colors.accent }}
          >
            Find Us
          </span>
          <h2 className="mt-4 text-3xl font-bold sm:text-4xl" style={{ color: colors.text.heading }}>
            Get in Touch
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: Phone,
              label: 'Phone',
              value: '+91 76667 73596',
              href: 'tel:+917666773596',
              colorRaw: '79,182,178',
              color: '#4FB6B2',
            },
            {
              icon: Mail,
              label: 'Email',
              value: 'info@simplehearing\nandspeechcare.com',
              href: 'mailto:info@simplehearingandspeechcare.com',
              colorRaw: '90,159,212',
              color: '#5A9FD4',
            },
            {
              icon: MapPin,
              label: 'Location',
              value: 'Westwood Estates,\nWakad, Pune',
              href: 'https://maps.google.com/?q=Westwood+Estates+Wakad+Pune',
              colorRaw: '242,140,140',
              color: '#F28C8C',
            },
            {
              icon: Clock,
              label: 'Hours',
              value: 'Mon–Sat: 9 AM – 9 PM\nSunday: Closed',
              href: null,
              colorRaw: '224,168,64',
              color: '#E0A840',
            },
          ].map(({ icon: Icon, label, value, href, colorRaw, color }) => (
            <div
              key={label}
              className="rounded-2xl p-6 flex flex-col gap-3 min-w-0"
              style={{
                background: '#FFFFFF',
                border: '1px solid rgba(0,0,0,0.07)',
                boxShadow: '0 2px 12px rgba(0,0,0,0.04)',
              }}
            >
              <div
                className="flex h-10 w-10 items-center justify-center rounded-xl flex-shrink-0"
                style={{ background: `rgba(${colorRaw},0.12)`, color }}
              >
                <Icon size={20} />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: colors.text.dim }}>{label}</p>
                {href ? (
                  <a
                    href={href}
                    target={href.startsWith('http') ? '_blank' : undefined}
                    rel="noreferrer"
                    className="mt-1 block text-sm font-medium leading-snug transition-colors whitespace-pre-line break-words"
                    style={{ color: colors.text.primary }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = color}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = colors.text.primary}
                  >
                    {value}
                  </a>
                ) : (
                  <p className="mt-1 text-sm font-medium leading-snug whitespace-pre-line" style={{ color: colors.text.primary }}>
                    {value}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Footer() {
  const { isAuthenticated } = useAuth()

  return (
    <footer
      className="px-6 py-8 sm:px-10"
      style={{
        background: colors.text.heading,
        borderTop: `1px solid rgba(255,255,255,0.06)`,
      }}
    >
      <div className="mx-auto max-w-6xl flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-3">
          <img src={LOGO_SRC} alt="SimpleHearing" className="h-8 w-auto" />
          <span className="text-sm font-semibold text-white opacity-90">Simple Hearing & Speech Care</span>
        </div>

        <p className="text-xs text-center" style={{ color: 'rgba(255,255,255,0.40)' }}>
          © {new Date().getFullYear()} Simple Hearing & Speech Care. All rights reserved.
        </p>

        <Link
          to={isAuthenticated ? '/dashboard' : '/login'}
          className="text-xs font-medium transition-colors"
          style={{ color: 'rgba(255,255,255,0.50)' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#4FB6B2'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.50)'}
        >
          {isAuthenticated ? 'Go to Dashboard →' : 'Staff Sign In →'}
        </Link>
      </div>
    </footer>
  )
}

// ── Inquiry / Book a Consultation form ────────────────────────────────────────

function InquiryForm() {
  const [name, setName]   = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [reason, setReason] = useState('')
  const [time, setTime]   = useState<PreferredTime | ''>('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [orgId, setOrgId] = useState<string | undefined>()

  useEffect(() => {
    publicApi.getOrg().then(org => { if (org) setOrgId(org.id) }).catch(() => {})
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !phone.trim()) return
    setLoading(true)
    setError('')
    try {
      await inquiriesApi.submit({
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim(),
        reason: reason.trim() || undefined,
        preferredTime: time || undefined,
        orgId,
      })
      setSubmitted(true)
    } catch {
      setError('Something went wrong. Please try calling us directly.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section id="book" className="px-6 py-20 sm:px-10" style={{ background: '#FFFFFF' }}>
      <div className="mx-auto max-w-2xl">
        <div className="mb-10 text-center">
          <span
            className="inline-block rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-widest"
            style={{ background: accentAlpha(0.10), color: colors.accent }}
          >
            Book a Consultation
          </span>
          <h2 className="mt-4 text-3xl font-bold sm:text-4xl" style={{ color: colors.text.heading }}>
            Start Your Journey
          </h2>
          <p className="mt-3 text-base" style={{ color: colors.text.muted }}>
            Fill in the form and our team will reach out to schedule your first appointment.
          </p>
        </div>

        {submitted ? (
          <div
            className="flex flex-col items-center gap-4 rounded-2xl p-10 text-center"
            style={{ background: 'rgba(43,128,200,0.06)', border: '1px solid rgba(43,128,200,0.15)' }}
          >
            <CheckCircle2 size={40} style={{ color: colors.accent }} />
            <h3 className="text-xl font-bold" style={{ color: colors.text.heading }}>Thank you, {name}!</h3>
            <p className="text-base" style={{ color: colors.text.muted }}>
              We've received your inquiry and will contact you on <strong>{phone}</strong> shortly.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl p-8 space-y-5"
            style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.08)', boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}
          >
            {error && (
              <div className="rounded-lg px-4 py-3 text-sm" style={{ background: 'rgba(217,96,96,0.08)', border: '1px solid rgba(217,96,96,0.20)', color: '#D96060' }}>
                {error}
              </div>
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#4A6A7A' }}>
                  Full Name <span style={{ color: '#D96060' }}>*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                  placeholder="Parent / Guardian name"
                  className="block w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-all"
                  style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.12)', color: '#374B5F' }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#2B80C8')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: '#4A6A7A' }}>
                  Phone <span style={{ color: '#D96060' }}>*</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  required
                  placeholder="+91 XXXXX XXXXX"
                  className="block w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-all"
                  style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.12)', color: '#374B5F' }}
                  onFocus={e => (e.currentTarget.style.borderColor = '#2B80C8')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)')}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#4A6A7A' }}>Email (optional)</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@email.com"
                className="block w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-all"
                style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.12)', color: '#374B5F' }}
                onFocus={e => (e.currentTarget.style.borderColor = '#2B80C8')}
                onBlur={e => (e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#4A6A7A' }}>Reason / Concern (optional)</label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                rows={3}
                placeholder="e.g. My child has speech delay, looking for hearing assessment…"
                className="block w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-all resize-none"
                style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,0.12)', color: '#374B5F' }}
                onFocus={e => (e.currentTarget.style.borderColor = '#2B80C8')}
                onBlur={e => (e.currentTarget.style.borderColor = 'rgba(0,0,0,0.12)')}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: '#4A6A7A' }}>Preferred Appointment Time (optional)</label>
              <div className="flex gap-3">
                {(['MORNING', 'AFTERNOON', 'EVENING'] as PreferredTime[]).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTime(time === t ? '' : t)}
                    className="flex-1 rounded-xl py-2 text-sm font-medium transition-all"
                    style={
                      time === t
                        ? { background: 'rgba(43,128,200,0.12)', color: '#2B80C8', border: '1px solid rgba(43,128,200,0.30)' }
                        : { background: '#F5F7FA', color: '#6B8499', border: '1px solid rgba(0,0,0,0.08)' }
                    }
                  >
                    {t.charAt(0) + t.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !name.trim() || !phone.trim()}
              className="w-full rounded-xl py-3.5 text-sm font-semibold transition-all disabled:opacity-50"
              style={{ background: gradient.buttonCta, color: '#fff', boxShadow: shadow.buttonCta }}
            >
              {loading ? 'Sending…' : 'Request a Consultation'}
            </button>
          </form>
        )}
      </div>
    </section>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="force-light" style={{ fontFamily: 'Inter, sans-serif', background: '#FFFFFF' }}>
      <Navbar />
      <Hero />
      <Services />
      <About />
      <Brands />
      <Contact />
      <InquiryForm />
      <Footer />
    </div>
  )
}
