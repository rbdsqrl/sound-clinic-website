export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const s = { sm: 'h-4 w-4 border-2', md: 'h-8 w-8 border-4', lg: 'h-12 w-12 border-4' }[size]
  return (
    <div className={`${s} animate-spin rounded-full border-primary-200 border-t-primary-600`} />
  )
}

export function PageLoader() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Spinner size="lg" />
    </div>
  )
}
