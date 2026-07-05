// @ts-ignore
import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw, X } from 'lucide-react'

export default function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(_r: any) {
      // Setup periodic update check if needed
    },
    onRegisterError(error: any) {
      console.error('SW registration error', error)
    },
  })

  if (!needRefresh) return null

  return (
    <div className="update-banner">
      <div className="update-banner-content">
        <div>
          <strong style={{ display: 'block', fontSize: '0.95rem' }}>Update Available! 🚀</strong>
          <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)' }}>
            A new version of Scheward is ready.
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            className="btn btn-primary btn-sm"
            onClick={() => updateServiceWorker(true)}
            style={{ padding: '6px 12px' }}
          >
            <RefreshCw size={14} style={{ marginRight: '4px' }} /> Update
          </button>
          <button 
            className="btn-icon" 
            onClick={() => setNeedRefresh(false)}
            style={{ color: 'rgba(255,255,255,0.7)', background: 'transparent', marginLeft: '4px' }}
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
