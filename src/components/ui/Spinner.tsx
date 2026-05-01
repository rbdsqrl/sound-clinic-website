export function Spinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dims = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-10 w-10' }[size]
  return (
    <div
      className={`${dims} animate-spin rounded-full`}
      style={{ border: '2px solid rgba(0,180,216,0.15)', borderTopColor: '#00b4d8' }}
    />
  )
}

export function PageLoader() {
  return (
    <div className="flex h-64 items-center justify-center">
      <Spinner size="lg" />
    </div>
  )
}
