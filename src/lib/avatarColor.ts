function nameHash(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return hash
}

/**
 * Deterministic per-person avatar color, derived from their name.
 *
 * Same formula everywhere a person's initials appear in a colored circle
 * (Cases/Members cards, Sidebar user avatar, therapist/parent lists,
 * calendar therapist columns, leave/availability rows) so the same person
 * always gets the same color across the app.
 */
export function getAvatarColorStyles(name: string, isDarkMode = false): { background: string; color: string } {
  const hash = nameHash(name)
  const hue = Math.abs(hash) % 360

  const saturation = 70
  const lightness = isDarkMode
    ? 65 + (Math.abs(hash) % 15) // 65% - 80%
    : 35 + (Math.abs(hash) % 15) // 35% - 50%

  const background = `hsl(${hue}, ${saturation}%, ${lightness}%)`
  const color = lightness > 60 ? '#111827' : '#FFFFFF'

  return { background, color }
}

/**
 * Soft translucent chip style (background + text + left accent) sharing the same
 * hue as `getAvatarColorStyles` for that name — so a therapist's calendar events
 * read as "their color", matching their avatar, instead of an unrelated palette.
 */
export function getAvatarChipStyle(name: string, isDarkMode = false): { background: string; color: string; borderLeft: string } {
  const hash = nameHash(name)
  const hue = Math.abs(hash) % 360
  const saturation = 70
  const textLightness = isDarkMode ? 72 : 40

  const color = `hsl(${hue}, ${saturation}%, ${textLightness}%)`
  const background = `hsla(${hue}, ${saturation}%, ${textLightness}%, ${isDarkMode ? 0.18 : 0.12})`

  return { background, color, borderLeft: `3px solid ${color}` }
}
