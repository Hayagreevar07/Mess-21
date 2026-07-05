import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

interface ChartData {
  date: string
  amount: number
}

interface Props {
  data: ChartData[]
  title: string
}

export default function DashboardChart({ data, title }: Props) {
  return (
    <div className="glass-card" style={{ padding: '20px', marginBottom: '24px' }}>
      <h3 style={{ marginBottom: '16px', fontSize: '1.1rem', color: 'var(--text-primary)' }}>
        {title}
      </h3>
      <div style={{ width: '100%', height: 250 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
            <XAxis 
              dataKey="date" 
              stroke="rgba(255,255,255,0.4)" 
              fontSize={12} 
              tickMargin={10} 
              axisLine={false} 
              tickLine={false} 
            />
            <YAxis 
              stroke="rgba(255,255,255,0.4)" 
              fontSize={12} 
              axisLine={false} 
              tickLine={false} 
              tickFormatter={(value) => `₹${value}`}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'rgba(18,18,26,0.9)', 
                border: '1px solid var(--border)',
                borderRadius: '8px',
                color: '#fff'
              }} 
              itemStyle={{ color: '#10b981', fontWeight: 600 }}
              labelStyle={{ color: 'var(--text-muted)', marginBottom: '4px' }}
            />
            <Area
              type="monotone"
              dataKey="amount"
              name="Meals"
              stroke="#10b981"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorAmount)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
