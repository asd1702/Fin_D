import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import ProtectedRoute from './components/auth/ProtectedRoute'
import { useAuthStore } from './store/useAuthStore'
import Login from './pages/Login/Login'
import Dashboard from './pages/Dashboard/Dashboard'
import CompanyDetail from './pages/Company/CompanyDetail'
import Market from './pages/Market/Market'
import Asset from './pages/Asset/Asset'
import Statistic from './pages/Statistic/Statistic'
import Community from './pages/Community/Community'
import Alerts from './pages/Alerts/Alerts'
import Settings from './pages/Settings/Settings'

function App() {
  const { checkAuth } = useAuthStore()

  // 앱 시작 시 인증 상태 확인
  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
      }}
    >
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/company" element={<CompanyDetail />} />
                  <Route path="/company/:ticker" element={<CompanyDetail />} />
                  <Route path="/market" element={<Market />} />
                  <Route path="/asset" element={<Asset />} />
                  <Route path="/statistic" element={<Statistic />} />
                  <Route path="/community" element={<Community />} />
                  <Route path="/alerts" element={<Alerts />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App

