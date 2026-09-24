import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useSession } from './api/session'
import { DashboardPage } from './pages/DashboardPage'
import { BoardPage } from './pages/BoardPage'

function App() {
  const session = useSession()
  const queryClient = useQueryClient()

  // Nothing loaded for one user may be shown after they sign out or their session ends.
  useEffect(() => {
    if (session.status === 'signedOut') queryClient.clear()
  }, [session.status, queryClient])

  return (
    <Routes>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/boards/:boardId" element={<BoardPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
