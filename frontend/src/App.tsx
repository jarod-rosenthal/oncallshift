import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminRoute } from './components/AdminRoute';
import { AppLayout } from './components/AppLayout';

// Eagerly loaded pages (critical for initial user experience)
import { Landing } from './pages/Landing';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Demo } from './pages/Demo';

// Lazy loaded pages - Core app functionality
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const Incidents = lazy(() => import('./pages/Incidents').then(m => ({ default: m.Incidents })));
const IncidentDetail = lazy(() => import('./pages/IncidentDetail').then(m => ({ default: m.IncidentDetail })));
const Schedules = lazy(() => import('./pages/Schedules').then(m => ({ default: m.Schedules })));
const ScheduleDetail = lazy(() => import('./pages/ScheduleDetail').then(m => ({ default: m.ScheduleDetail })));
const EscalationPolicies = lazy(() => import('./pages/EscalationPolicies').then(m => ({ default: m.EscalationPolicies })));
const Availability = lazy(() => import('./pages/Availability').then(m => ({ default: m.Availability })));
const NotificationPreferences = lazy(() => import('./pages/NotificationPreferences').then(m => ({ default: m.NotificationPreferences })));
const Profile = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const Analytics = lazy(() => import('./pages/Analytics').then(m => ({ default: m.Analytics })));

// Lazy loaded pages - Admin functionality
const AdminUsers = lazy(() => import('./pages/AdminUsers').then(m => ({ default: m.AdminUsers })));
const AdminServices = lazy(() => import('./pages/AdminServices').then(m => ({ default: m.AdminServices })));
const AdminRunbooks = lazy(() => import('./pages/AdminRunbooks').then(m => ({ default: m.AdminRunbooks })));
const RoutingRules = lazy(() => import('./pages/RoutingRules').then(m => ({ default: m.RoutingRules })));
const Integrations = lazy(() => import('./pages/Integrations').then(m => ({ default: m.Integrations })));
const Teams = lazy(() => import('./pages/Teams').then(m => ({ default: m.Teams })));
const TeamDetail = lazy(() => import('./pages/TeamDetail').then(m => ({ default: m.TeamDetail })));
const BusinessServices = lazy(() => import('./pages/BusinessServices').then(m => ({ default: m.BusinessServices })));
const StatusPages = lazy(() => import('./pages/StatusPages').then(m => ({ default: m.StatusPages })));
const PublicStatusPage = lazy(() => import('./pages/PublicStatusPage').then(m => ({ default: m.PublicStatusPage })));
const ServiceDependencies = lazy(() => import('./pages/ServiceDependencies').then(m => ({ default: m.ServiceDependencies })));
const ServiceConfiguration = lazy(() => import('./pages/ServiceConfiguration').then(m => ({ default: m.ServiceConfiguration })));
const StatusPageAdmin = lazy(() => import('./pages/StatusPageAdmin').then(m => ({ default: m.StatusPageAdmin })));
const Workflows = lazy(() => import('./pages/Workflows').then(m => ({ default: m.Workflows })));
const Reports = lazy(() => import('./pages/Reports').then(m => ({ default: m.Reports })));
const Postmortems = lazy(() => import('./pages/Postmortems').then(m => ({ default: m.Postmortems })));
const Tags = lazy(() => import('./pages/Tags').then(m => ({ default: m.Tags })));
const CloudCredentials = lazy(() => import('./pages/CloudCredentials').then(m => ({ default: m.CloudCredentials })));
const Account = lazy(() => import('./pages/Account').then(m => ({ default: m.Account })));
const SetupWizard = lazy(() => import('./pages/SetupWizard').then(m => ({ default: m.SetupWizard })));
const ImportWizard = lazy(() => import('./pages/ImportWizard').then(m => ({ default: m.ImportWizard })));
const SemanticImportPage = lazy(() => import('./features/semanticImport/SemanticImportPage').then(m => ({ default: m.SemanticImportPage })));

// Lazy loaded pages - Marketing/public pages
const Pricing = lazy(() => import('./pages/Pricing').then(m => ({ default: m.Pricing })));
const MigrateFromOpsgenie = lazy(() => import('./pages/MigrateFromOpsgenie').then(m => ({ default: m.MigrateFromOpsgenie })));
const MigrateFromPagerDuty = lazy(() => import('./pages/MigrateFromPagerDuty').then(m => ({ default: m.MigrateFromPagerDuty })));
const PagerDutyAlternative = lazy(() => import('./pages/PagerDutyAlternative').then(m => ({ default: m.PagerDutyAlternative })));
const OpsgenieAlternative = lazy(() => import('./pages/OpsgenieAlternative').then(m => ({ default: m.OpsgenieAlternative })));
const ProductOnCallScheduling = lazy(() => import('./pages/ProductOnCallScheduling').then(m => ({ default: m.ProductOnCallScheduling })));
const ProductIncidentManagement = lazy(() => import('./pages/ProductIncidentManagement').then(m => ({ default: m.ProductIncidentManagement })));
const ProductAIDiagnosis = lazy(() => import('./pages/ProductAIDiagnosis').then(m => ({ default: m.ProductAIDiagnosis })));
const ProductIntegrations = lazy(() => import('./pages/ProductIntegrations').then(m => ({ default: m.ProductIntegrations })));
const ProductMobileApp = lazy(() => import('./pages/ProductMobileApp').then(m => ({ default: m.ProductMobileApp })));
const ProductEscalationPolicies = lazy(() => import('./pages/ProductEscalationPolicies').then(m => ({ default: m.ProductEscalationPolicies })));
const Contact = lazy(() => import('./pages/Contact').then(m => ({ default: m.Contact })));
const About = lazy(() => import('./pages/About').then(m => ({ default: m.About })));
const WhyOnCallShift = lazy(() => import('./pages/WhyOnCallShift').then(m => ({ default: m.WhyOnCallShift })));
const ForSmallTeams = lazy(() => import('./pages/ForSmallTeams').then(m => ({ default: m.ForSmallTeams })));
const Privacy = lazy(() => import('./pages/Privacy').then(m => ({ default: m.Privacy })));
const Terms = lazy(() => import('./pages/Terms').then(m => ({ default: m.Terms })));
const Blog = lazy(() => import('./pages/Blog').then(m => ({ default: m.Blog })));
const Security = lazy(() => import('./pages/Security').then(m => ({ default: m.Security })));

// Documentation and Help pages
const DocsHome = lazy(() => import('./pages/docs/DocsHome').then(m => ({ default: m.DocsHome })));
const DocsQuickStart = lazy(() => import('./pages/docs/DocsQuickStart').then(m => ({ default: m.DocsQuickStart })));
const DocsComingSoon = lazy(() => import('./pages/docs/DocsComingSoon').then(m => ({ default: m.DocsComingSoon })));
const HelpHome = lazy(() => import('./pages/help/HelpHome').then(m => ({ default: m.HelpHome })));
const HelpFirstSteps = lazy(() => import('./pages/help/HelpFirstSteps').then(m => ({ default: m.HelpFirstSteps })));
const HelpComingSoon = lazy(() => import('./pages/help/HelpComingSoon').then(m => ({ default: m.HelpComingSoon })));

// Loading fallback component for lazy-loaded pages
const PageLoader = () => (
  <div className="flex items-center justify-center h-screen bg-slate-50">
    <div className="flex flex-col items-center gap-3">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <span className="text-sm text-slate-500">Loading...</span>
    </div>
  </div>
);

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
    <>
      <ToastProvider />
      <Router>
        <Suspense fallback={<PageLoader />}>
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
        <Route path="/why-oncallshift" element={<WhyOnCallShift />} />
        <Route path="/for-small-teams" element={<ForSmallTeams />} />
        <Route path="/legal/privacy" element={<Privacy />} />
        <Route path="/legal/terms" element={<Terms />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/company/security" element={<Security />} />

        {/* Documentation routes */}
        <Route path="/docs" element={<DocsHome />} />
        <Route path="/docs/getting-started/quick-start" element={<DocsQuickStart />} />
        <Route path="/docs/*" element={<DocsComingSoon />} />

        {/* Help Center routes */}
        <Route path="/help" element={<HelpHome />} />
        <Route path="/help/getting-started/first-steps" element={<HelpFirstSteps />} />
        <Route path="/help/*" element={<HelpComingSoon />} />

        {/* Public status pages */}
        <Route path="/status/:slug" element={<PublicStatusPage />} />

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
          path="/notification-preferences"
          element={
            <ProtectedWithLayout>
              <NotificationPreferences />
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
          path="/services/:id/config"
          element={
            <AdminWithLayout>
              <ServiceConfiguration />
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
          path="/workflows"
          element={
            <AdminWithLayout>
              <Workflows />
            </AdminWithLayout>
          }
        />
        <Route
          path="/reports"
          element={
            <AdminWithLayout>
              <Reports />
            </AdminWithLayout>
          }
        />
        <Route
          path="/postmortems"
          element={
            <ProtectedWithLayout>
              <Postmortems />
            </ProtectedWithLayout>
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
          path="/settings/cloud-credentials"
          element={
            <AdminWithLayout>
              <CloudCredentials />
            </AdminWithLayout>
          }
        />
        <Route
          path="/settings/semantic-import"
          element={
            <AdminWithLayout>
              <SemanticImportPage />
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
          path="/status-pages"
          element={
            <AdminWithLayout>
              <StatusPages />
            </AdminWithLayout>
          }
        />
        <Route
          path="/status-pages/admin"
          element={
            <AdminWithLayout>
              <StatusPageAdmin />
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
        </Suspense>
      </Router>
    </>
  );
}

export default App;
