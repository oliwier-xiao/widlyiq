import type { ReactNode } from 'react'

type PanelProps = {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  footer?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}

/** Panels tile edge to edge on 1px seams; the grid around them paints the seam, panels never draw borders or shadows. */
export function Panel({ title, subtitle, actions, footer, children, className = '', bodyClassName = '' }: PanelProps) {
  return (
    <section className={`flex min-w-0 flex-col bg-paper ${className}`}>
      <header className="flex items-start justify-between gap-4 px-5 pb-3 pt-4">
        <div className="min-w-0">
          <h2 className="t-panel text-ink">{title}</h2>
          {subtitle && <p className="t-meta mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </header>
      <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
      {footer && <footer className="t-meta px-5 pb-4 pt-3">{footer}</footer>}
    </section>
  )
}

export function SeamGrid({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`grid gap-px bg-seam ${className}`}>{children}</div>
}
