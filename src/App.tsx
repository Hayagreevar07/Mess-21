import { useEffect, useState, lazy, Suspense } from 'react'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { Toaster } from 'react-hot-toast'
import { Capacitor } from '@capacitor/core'
import { StatusBar, Style } from '@capacitor/status-bar'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Loader from './components/Loader'
import OfflineBoundary from './components/OfflineBoundary'
import WakeupOverlay from './components/WakeupOverlay'
import { LocalNotifications } from '@capacitor/local-notifications'

// Create a query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes cache
      refetchOnWindowFocus: false,
    },
  },
})

// Lazy-load pages for faster initial load
const LoginPage = lazy(() => import('./pages/LoginPage'))
const SetupPage = lazy(() => import('./pages/SetupPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const MenuPage = lazy(() => import('./pages/MenuPage'))
const MealLogPage = lazy(() => import('./pages/MealLogPage'))
const ExpensePage = lazy(() => import('./pages/ExpensePage'))
const BillsPage = lazy(() => import('./pages/BillsPage'))
const BudgetPage = lazy(() => import('./pages/BudgetPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const QueriesPage = lazy(() => import('./pages/QueriesPage'))
const MembersPage = lazy(() => import('./pages/MembersPage'))
const TransactionsPage = lazy(() => import('./pages/TransactionsPage'))
const TasksPage = lazy(() => import('./pages/TasksPage'))
const MessagesPage = lazy(() => import('./pages/MessagesPage'))
const NotesPage = lazy(() => import('./pages/NotesPage'))

function PageLoader() {
  return (
    <div className="page-loader" style={{ minHeight: '60vh' }}>
      <Loader />
    </div>
  )
}

function App() {
  const [isWakeupActive, setIsWakeupActive] = useState(false)

  // Initialize native platform features
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      StatusBar.setBackgroundColor({ color: '#0a0a0f' })
      StatusBar.setStyle({ style: Style.Dark })

      // Listen for local notifications
      LocalNotifications.addListener('localNotificationActionPerformed', (notificationAction) => {
        const extra = notificationAction.notification.extra
        if (extra && extra.isWakeupAlarm) {
          setIsWakeupActive(true)
        }
      })
    }
  }, [])

  return (
    <HashRouter>
      <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {isWakeupActive && <WakeupOverlay onDismiss={() => setIsWakeupActive(false)} targetScore={5} />}
        <OfflineBoundary>
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#1a1a2e',
              color: '#f0f0f5',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '12px',
              fontSize: '0.9rem',
              fontFamily: 'Inter, sans-serif',
              boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            },
            success: {
              iconTheme: { primary: '#10b981', secondary: '#f0f0f5' },
            },
            error: {
              iconTheme: { primary: '#ef4444', secondary: '#f0f0f5' },
            },
          }}
        />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/setup" element={<SetupPage />} />
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/menu" element={<MenuPage />} />
              <Route path="/meals" element={<MealLogPage />} />
              <Route path="/expenses" element={<ExpensePage />} />
              <Route path="/bills" element={<BillsPage />} />
              <Route path="/budget" element={<BudgetPage />} />
              <Route path="/queries" element={<QueriesPage />} />
              <Route path="/members" element={<MembersPage />} />
              <Route path="/transactions" element={<TransactionsPage />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/messages" element={<MessagesPage />} />
              <Route path="/notes" element={<NotesPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
        </OfflineBoundary>
      </AuthProvider>
      </QueryClientProvider>
    </HashRouter>
  )
}

export default App
