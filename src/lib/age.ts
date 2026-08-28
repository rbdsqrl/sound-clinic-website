import { differenceInMonths } from 'date-fns'

/** "3 months" / "2 years" / "4y 6m" from a "YYYY-MM-DD" date of birth. */
export function calcAge(dob: string): string {
  const totalMonths = differenceInMonths(new Date(), new Date(dob))
  const years  = Math.floor(totalMonths / 12)
  const months = totalMonths % 12
  if (years === 0) return `${months} month${months !== 1 ? 's' : ''}`
  if (months === 0) return `${years} year${years !== 1 ? 's' : ''}`
  return `${years}y ${months}m`
}
