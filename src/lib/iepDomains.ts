import { useQuery } from '@tanstack/react-query'
import { iepApi } from '../api/iep'
import type { IEPGoalDomain } from '../types'

/** The built-in IEP goal domains. An organisation can add its own on top of these (see useCustomDomains). */
export const BUILT_IN_DOMAINS: { value: Exclude<IEPGoalDomain, 'CUSTOM'>; label: string }[] = [
  { value: 'AUDITORY',  label: 'Auditory Processing'     },
  { value: 'SPEECH',    label: 'Speech Production'       },
  { value: 'LANGUAGE',  label: 'Language'                },
  { value: 'SENSORY',   label: 'Sensory Processing'      },
  { value: 'MOTOR',     label: 'Motor Skills'            },
  { value: 'SOCIAL',    label: 'Social Communication'    },
  { value: 'COGNITIVE', label: 'Cognitive Skills'        },
  { value: 'LITERACY',  label: 'Literacy'                },
  { value: 'ADAPTIVE',  label: 'Adaptive / Daily Living' },
]

/** The Domain dropdown's value for "type a new custom domain". */
export const NEW_DOMAIN = '__new__'
const CUSTOM_PREFIX = 'custom:'

/** Display name of a goal's domain — the custom name for a custom domain, else the built-in label. */
export function domainLabel(domain: string | null | undefined, customDomain?: string | null): string {
  if (!domain) return ''
  if (domain === 'CUSTOM') return customDomain || 'Custom'
  return BUILT_IN_DOMAINS.find(d => d.value === domain)?.label ?? domain
}

/** The Domain dropdown value that represents an existing goal's domain (for pre-filling an edit form). */
export function domainToFormValue(domain: string, customDomain?: string | null): string {
  return domain === 'CUSTOM' && customDomain ? `${CUSTOM_PREFIX}${customDomain}` : domain
}

/**
 * Turns the Domain dropdown's value (and the typed name, if "add a custom domain" was chosen) into what the
 * API takes: a built-in domain, or CUSTOM plus its name.
 */
export function resolveDomainValue(value: string, typedName?: string): { domain: IEPGoalDomain; customDomain?: string } {
  if (value === NEW_DOMAIN) return { domain: 'CUSTOM', customDomain: (typedName ?? '').trim() }
  if (value.startsWith(CUSTOM_PREFIX)) return { domain: 'CUSTOM', customDomain: value.slice(CUSTOM_PREFIX.length) }
  return { domain: value as IEPGoalDomain }
}

/** Dropdown options: built-in domains, then the organisation's custom ones, then "add a custom domain". */
export function domainOptions(customNames: string[]) {
  return [
    { group: 'Domains', options: BUILT_IN_DOMAINS.map(d => ({ value: d.value as string, label: d.label })) },
    ...(customNames.length > 0
      ? [{ group: 'Your custom domains', options: customNames.map(n => ({ value: `${CUSTOM_PREFIX}${n}`, label: n })) }]
      : []),
    { group: 'Not in the list?', options: [{ value: NEW_DOMAIN, label: '+ Add a custom domain…' }] },
  ]
}

/** The organisation's custom IEP domain names. */
export function useCustomDomains() {
  const query = useQuery({
    queryKey: ['iep-custom-domains'],
    queryFn: iepApi.customDomains,
    staleTime: 5 * 60 * 1000,
  })
  return { ...query, names: (query.data ?? []).map(d => d.name) }
}
