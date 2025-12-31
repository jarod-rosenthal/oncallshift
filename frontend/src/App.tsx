import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Demo } from './pages/Demo';
import { Dashboard } from './pages/Dashboard';
import { Incidents } from './pages/Incidents';
import { IncidentDetail } from './pages/IncidentDetail';
import { Schedules } from './pages/Schedules';
import { ScheduleDetail } from './pages/ScheduleDetail';
import { EscalationPolicies } from './pages/EscalationPolicies';
import { Availability } from './pages/Availability';
import { Profile } from './pages/Profile';
import { AdminUsers } from './pages/AdminUsers';
import { AdminServices } from './pages/AdminServices';
import { AdminRunbooks } from './pages/AdminRunbooks';
import { RoutingRules } from './pages/RoutingRules';
import { Integrations } from './pages/Integrations';
import { Teams } from './pages/Teams';
import { BusinessServices } from './pages/BusinessServices';
import { ServiceDependencies } from './pages/ServiceDependencies';
import { Tags } from './pages/Tags';
import { TeamDetail } from './pages/TeamDetail';
import { Analytics } from './pages/Analytics';
import { Account } from './pages/Account';
import { SetupWizard } from './pages/SetupWizard';
import { ImportWizard } from './pages/ImportWizard';
import { Pricing } from './pages/Pricing';
import { MigrateFromOpsgenie } from './pages/MigrateFromOpsgenie';
import { MigrateFromPagerDuty } from './pages/MigrateFromPagerDuty';
import { PagerDutyAlternative } from './pages/PagerDutyAlternative';
import { OpsgenieAlternative } from './pages/OpsgenieAlternative';
import { ProductOnCallScheduling } from './pages/ProductOnCallScheduling';
import { ProductIncidentManagement } from './pages/ProductIncidentManagement';
import { ProductAIDiagnosis } from './pages/ProductAIDiagnosis';
import { ProductIntegrations } from './pages/ProductIntegrations';
import { ProductMobileApp } from './pages/ProductMobileApp';
import { ProductEscalationPolicies } from './pages/ProductEscalationPolicies';
import { Contact } from './pages/Contact';
import { About } from './pages/About';
import { Privacy } from './pages/Privacy';
import { Terms } from './pages/Terms';
import { Blog } from './pages/Blog';
import { Security } from './pages/Security';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminRoute } from './components/AdminRoute';
import { AppLayout } from './components/AppLayout';

// Wrapper component for protected routes with layout
function ProtectedWithLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppLayout>{children}</AppLayout>
    </ProtectedRoute>
  );
}

// Wrapper component for admin routes with layout
function AdminWithLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminRoute>
      <AppLayout>{children}</AppLayout>
    </AdminRoute>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/demo" element={<Demo />} />
        <Route path="/pricing" element={<Pricing />} />
        <Route path="/migrate/from-opsgenie" element={<MigrateFromOpsgenie />} />
        <Route path="/migrate/from-pagerduty" element={<MigrateFromPagerDuty />} />
        <Route path="/alternatives/pagerduty" element={<PagerDutyAlternative />} />
        <Route path="/alternatives/opsgenie" element={<OpsgenieAlternative />} />
        <Route path="/product/on-call-scheduling" element={<ProductOnCallScheduling />} />
        <Route path="/product/incident-management" element={<ProductIncidentManagement />} />
        <Route path="/product/ai-diagnosis" element={<ProductAIDiagnosis />} />
        <Route path="/product/integrations" element={<ProductIntegrations />} />
        <Route path="/product/mobile-app" element={<ProductMobileApp />} />
        <Route path="/product/escalation-policies" element={<ProductEscalationPolicies />} />
        <Route path="/company/contact" element={<Contact />} />
        <Route path="/company/about" element={<About />} />
        <Route path="/legal/privacy" element={<Privacy />} />
        <Route path="/legal/terms" element={<Terms />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/company/security" element={<Security />} />

        {/* Setup wizard (admin only, no sidebar) */}
        <Route
          path="/setup"
          element={
            <AdminRoute>
              <SetupWizard />
            </AdminRoute>
          }
        />

        {/* Import wizard (admin only, no sidebar) */}
        <Route
          path="/import"
          element={
            <AdminRoute>
              <ImportWizard />
            </AdminRoute>
          }
        />

        {/* Protected routes with sidebar layout */}
        <Route
          path="/dashboard"
          element={
            <ProtectedWithLayout>
              <Dashboard />
            </ProtectedWithLayout>
          }
        />
        <Route
          path="/incidents"
          element={
            <ProtectedWithLayout>
              <Incidents />
            </ProtectedWithLayout>
          }
        />
        <Route
          path="/incidents/:id"
          element={
            <ProtectedWithLayout>
              <IncidentDetail />
            </ProtectedWithLayout>
          }
        />
        <Route
          path="/schedules"
          element={
            <ProtectedWithLayout>
              <Schedules />
            </ProtectedWithLayout>
          }
        />
        <Route
          path="/schedules/:id"
          element={
            <ProtectedWithLayout>
              <ScheduleDetail />
            </ProtectedWithLayout>
          }
        />
        <Route
          path="/escalation-policies"
          element={
            <ProtectedWithLayout>
              <EscalationPolicies />
            </ProtectedWithLayout>
          }
        />
        <Route
          path="/availability"
          element={
            <ProtectedWithLayout>
              <Availability />
            </ProtectedWithLayout>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedWithLayout>
              <Profile />
            </ProtectedWithLayout>
          }
        />
        <Route
          path="/analytics"
          element={
            <ProtectedWithLayout>
              <Analytics />
            </ProtectedWithLayout>
          }
        />

        {/* Admin routes with sidebar layout */}
        <Route
          path="/services"
          element={
            <AdminWithLayout>
              <AdminServices />
            </AdminWithLayout>
          }
        />
        <Route
          path="/runbooks"
          element={
            <AdminWithLayout>
              <AdminRunbooks />
            </AdminWithLayout>
          }
        />
        <Route
          path="/routing-rules"
          element={
            <AdminWithLayout>
              <RoutingRules />
            </AdminWithLayout>
          }
        />
        <Route
          path="/people/users"
          element={
            <AdminWithLayout>
              <AdminUsers />
            </AdminWithLayout>
          }
        />
        <Route
          path="/people/teams"
          element={
            <ProtectedWithLayout>
              <Teams />
            </ProtectedWithLayout>
          }
        />
        <Route
          path="/teams/:id"
          element={
            <ProtectedWithLayout>
              <TeamDetail />
            </ProtectedWithLayout>
          }
        />
        <Route
          path="/integrations"
          element={
            <AdminWithLayout>
              <Integrations />
            </AdminWithLayout>
          }
        />
        <Route
          path="/business-services"
          element={
            <AdminWithLayout>
              <BusinessServices />
            </AdminWithLayout>
          }
        />
        <Route
          path="/service-dependencies"
          element={
            <AdminWithLayout>
              <ServiceDependencies />
            </AdminWithLayout>
          }
        />
        <Route
          path="/tags"
          element={
            <AdminWithLayout>
              <Tags />
            </AdminWithLayout>
          }
        />
        <Route
          path="/settings/account"
          element={
            <AdminWithLayout>
              <Account />
            </AdminWithLayout>
          }
        />

        {/* Legacy redirects for old URLs */}
        <Route path="/admin/users" element={<Navigate to="/people/users" replace />} />
        <Route path="/admin/services" element={<Navigate to="/services" replace />} />
        <Route path="/admin/runbooks" element={<Navigate to="/runbooks" replace />} />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
