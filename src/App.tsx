import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useSession } from './api/session'
import { useUserRealtime } from './features/session/useUserRealtime'
import { useApplyPreferences } from './features/preferences/usePreferences'
import { DashboardPage } from './pages/DashboardPage'
import { BoardPage } from './pages/BoardPage'
import { AboutPage } from './site/AboutPage'
import { FaqPage } from './site/FaqPage'
import { SupportPage } from './site/SupportPage'
import { PrivacyPage } from './site/legal/PrivacyPage'
import { TermsPage } from './site/legal/TermsPage'

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
      <Route path="/boards/:boardId" element={<BoardPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/faq" element={<FaqPage />} />
      <Route path="/support" element={<SupportPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App
