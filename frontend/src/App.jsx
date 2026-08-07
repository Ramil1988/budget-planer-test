import { useEffect, useRef } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { Box, Flex } from '@chakra-ui/react'
import { useAuth } from './contexts/AuthContext'
import { supabase } from './lib/supabaseClient'
import { generateDueRecurringTransactions } from './lib/recurringAutoAdd'
import Header from './components/Header'
import Footer from './components/Footer'
import ProtectedRoute from './components/ProtectedRoute'
import Home from './pages/Home'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import ImportTransactions from './pages/ImportTransactions'
import CategoryManager from './pages/CategoryManager'
import Transactions from './pages/Transactions'
import AddTransaction from './pages/AddTransaction'
import Budget from './pages/Budget'
import RecurringPayments from './pages/RecurringPayments'
import Reports from './pages/Reports'
import AssetsLiabilities from './pages/AssetsLiabilities'
import Settings from './pages/Settings'
import SettingsTabs from './components/SettingsTabs'

function App() {
  const { user } = useAuth()
  const autoAddRunFor = useRef(null)

  // Recurring payments marked "add automatically" record themselves once their date
  // arrives. Runs once per session — generation is idempotent, so a missed run just
  // catches up the next time the app is opened.
  useEffect(() => {
    if (!user || autoAddRunFor.current === user.id) return
    autoAddRunFor.current = user.id
    generateDueRecurringTransactions(supabase, user.id)
      .catch(err => console.error('Recurring auto-add failed:', err))
  }, [user])

  return (
    <Flex direction="column" minH="100vh" overflowX="hidden" w="100%">
      <Header />
      <Box as="main" flex="1" w="100%" overflowX="hidden">
        <Routes>
        {/* Public routes */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Protected routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        {/* Settings group — each tab keeps its own URL */}
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <SettingsTabs />
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/import"
          element={
            <ProtectedRoute>
              <SettingsTabs />
              <ImportTransactions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/categories"
          element={
            <ProtectedRoute>
              <SettingsTabs />
              <CategoryManager />
            </ProtectedRoute>
          }
        />
        <Route
          path="/transactions"
          element={
            <ProtectedRoute>
              <Transactions />
            </ProtectedRoute>
          }
        />
        <Route
          path="/add-transaction"
          element={
            <ProtectedRoute>
              <AddTransaction />
            </ProtectedRoute>
          }
        />
        <Route
          path="/budget"
          element={
            <ProtectedRoute>
              <Budget />
            </ProtectedRoute>
          }
        />
        <Route
          path="/recurring"
          element={
            <ProtectedRoute>
              <RecurringPayments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute>
              <Reports />
            </ProtectedRoute>
          }
        />
        <Route
          path="/assets-liabilities"
          element={
            <ProtectedRoute>
              <AssetsLiabilities />
            </ProtectedRoute>
          }
        />

        {/* Redirect /report to /reports */}
        <Route path="/report" element={<Navigate to="/reports" replace />} />

        {/* Catch-all route - redirect unknown routes to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Box>
      <Footer />
    </Flex>
  )
}

export default App
