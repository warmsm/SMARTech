import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { Navigation } from "@/app/components/Navigation";
import { HomePage } from "@/app/pages/HomePage";
import { PubMatsPage } from "@/app/pages/PubMatsPage";
import { CaptionsPage } from "@/app/pages/CaptionsPage";
import { LoginPage } from "@/app/pages/LoginPage";
import { ProtectedRoute } from "@/app/components/ProtectedRoute";
import { PostsProvider } from "@/contexts/PostsContext";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AccountAccessPage } from "@/app/pages/AccountAccessPage";
import { ForgotPasswordPage } from "@/app/pages/ForgotPasswordPage";
import { HandoffRequestPage } from "@/app/pages/HandoffRequestPage";
import { RequestApprovalPage } from "@/app/pages/RequestApprovalPage";
import { ResetPasswordPage } from "@/app/pages/ResetPasswordPage";
import { AdminPage } from "@/app/pages/AdminPage";
import { ReviewApprovedPostsPage } from "@/app/pages/ReviewApprovedPostsPage";
import { ReviewAppealsPage } from "@/app/pages/ReviewAppealsPage";
import { CreateAccountRequestPage } from "@/app/pages/CreateAccountRequestPage";
import { AccessRequestsProvider } from "@/contexts/AccessRequestsContext";
import { HelpButton } from "@/app/components/HelpButton";
import { SmarTechLogo } from "@/app/components/SmarTechLogo";

/**
 * Shared layout for authenticated pages to keep AppRoutes clean
 */
function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { currentOffice } = useAuth();
  const isCentral = currentOffice === "Central NYC";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navigation />
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
      <HelpButton isCentral={isCentral} />
      <SmarTechLogo />
    </div>
  );
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/account-access" element={<AccountAccessPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/handoff-request" element={<HandoffRequestPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/create-account-request" element={<CreateAccountRequestPage />} />

      {/* Protected Dashboard Routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <HomePage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/pubmats"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <PubMatsPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/captions"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <CaptionsPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/request-approval"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <RequestApprovalPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <AdminPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/review-approved"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <ReviewApprovedPostsPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/review-appeals"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <ReviewAppealsPage />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PostsProvider>
        <AccessRequestsProvider>
          <Router>
            <AppRoutes />
          </Router>
        </AccessRequestsProvider>
      </PostsProvider>
    </AuthProvider>
  );
}