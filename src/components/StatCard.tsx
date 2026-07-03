import type { LucideIcon } from 'lucide-react'

interface Props {
  title: string
  value: string | number
  icon: LucideIcon
  color?: string
  subtitle?: string
}

export default function StatCard({ title, value, icon: Icon, color = 'var(--primary)', subtitle }: Props) {
  return (
    <div className="stat-card" style={{ '--card-accent': color } as React.CSSProperties}>
      <div className="stat-card-icon">
        <Icon size={24} />
      </div>
      <div className="stat-card-content">
        <span className="stat-card-title">{title}</span>
        <span className="stat-card-value">{value}</span>
        {subtitle && <span className="stat-card-subtitle">{subtitle}</span>}
      </div>
    </div>
  )
}
