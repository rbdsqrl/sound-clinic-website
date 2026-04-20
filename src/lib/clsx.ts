type ClassValue = string | undefined | null | false

export function clsx(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(' ')
}
