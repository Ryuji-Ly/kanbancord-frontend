import { lazy, Suspense, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useSession } from './api/session'
import { useUserRealtime } from './features/session/useUserRealtime'
import { useApplyPreferences } from './features/preferences/usePreferences'
import { DashboardPage } from './pages/DashboardPage'
import { PUBLIC_ROUTES } from './site/publicRoutes'

// The board page brings drag and drop, the Markdown editor and the task panel: loaded only when a
// board is opened, so the dashboard and the public pages start faster.
const BoardPage = lazy(() => import('./pages/BoardPage').then((module) => ({ default: module.BoardPage })))

function App() {
  const session = useSession()
  const queryClient = useQueryClient()
  useUserRealtime()
  useApplyPreferences()

  // Nothing loaded for one user may be shown after they sign out or their session ends.
  useEffect(() => {
    if (session.status === 'signedOut') queryClient.clear()
  }, [session.status, queryClient])

  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route
        path="/boards/:boardId"
        element={
          <Suspense fallback={null}>
            <BoardPage />
          </Suspense>
        }
      />
      {PUBLIC_ROUTES.map((route) => (
        <Route key={route.path} path={route.path} element={route.element} />
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
