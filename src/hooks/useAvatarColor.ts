import { useTheme } from '../contexts/ThemeContext'
import { getAvatarColorStyles } from '../lib/avatarColor'

/** Name-derived `{ background, color }` for the current theme — see `getAvatarColorStyles`. */
export function useAvatarColor(name: string): { background: string; color: string } {
  const { theme } = useTheme()
  return getAvatarColorStyles(name, theme === 'dark')
}
