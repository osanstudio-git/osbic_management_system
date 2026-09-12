import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { BranchProvider } from './contexts/BranchContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './contexts/ThemeContext';
import { Eye, EyeOff } from 'lucide-react';
import { useAdminSettings } from './hooks/admin/useAdminSettings';
import ThemeToggle from './components/ThemeToggle';
import { supabase } from './lib/supabase';
import { NetworkStatusBanner } from './components/shared/NetworkStatusBanner';


import ProtectedRoute from './components/auth/ProtectedRoute';

// Layouts
import AdminLayout from './layouts/AdminLayout';
import EmployeeLayout from './layouts/EmployeeLayout';
import ClientLayout from './layouts/ClientLayout';

// Pages
import Dashboard from './pages/admin/Dashboard';
import Employees from './pages/admin/Employees';
import EmployeeDetail from './pages/admin/EmployeeDetail';
import ServicesList from './pages/admin/Services';
import ServiceForm from './pages/admin/ServiceForm';
import Clients from './pages/admin/Clients';
import ClientDetail from './pages/admin/ClientDetail';
import ClientsHub from './pages/employee/Clients';
import ClientHistoryView from './pages/employee/ClientHistory';
import EmployeeDashboard from './pages/employee/Dashboard';
import EmployeeNotifications from './pages/employee/Notifications';
import EmployeeInvoices from './pages/employee/Invoices';
import InvoiceBuilder from './pages/employee/InvoiceBuilder';
import QuotationBuilder from './pages/employee/QuotationBuilder';
import Jobs from './pages/admin/Jobs';
import JobDetail from './pages/shared/JobDetail';
import Notifications from './pages/admin/Notifications';
import SLAApprovals from './pages/admin/SLAApprovals';
import Finance from './pages/admin/Finance';
import Audit from './pages/admin/Audit';
import AdminMessages from './pages/admin/Messages';
import Settings from './pages/admin/Settings';
import AdminLeads from './pages/admin/AdminLeads';
import MyJobs from './pages/employee/MyJobs';
import EmployeeProfile from './pages/employee/Profile';
import EmployeeRequests from './pages/employee/Requests';
import ClientLogin from './pages/auth/ClientLogin';
import ClientDashboard from './pages/client/Dashboard';
import ClientJobDetail from './pages/client/ClientJobDetail';
import UnifiedWorkspace from './pages/employee/UnifiedWorkspace';
import EmployeeMessages from './pages/employee/Messages';
import EmployeeReports from './pages/employee/Reports';
import EmployeeLeads from './pages/employee/Leads';
import PackageGroupDetail from './pages/employee/PackageGroupDetail';
import ClientProfile from './pages/client/Profile';
import ClientMessages from './pages/client/Messages';
import PackagesList from './pages/admin/Packages';
import PackageForm from './pages/admin/PackageForm';
import ServicesCatalog from './pages/client/ServicesCatalog';
import ClientHistory from './pages/client/History';
import ClientDocuments from './pages/client/Documents';
import ClientPayments from './pages/client/Payments';
import ClientNotifications from './pages/client/Notifications';
import MyTasks from './pages/employee/MyTasks';
import ProQueue from './pages/employee/ProQueue';
import AccountsDashboard from './pages/employee/AccountsDashboard';
import BranchTeam from './pages/employee/BranchTeam';
import BranchApprovals from './pages/employee/BranchApprovals';




// i18n
import './i18n/config';

// Placeholder Pages
const DashboardPlaceholder = ({ title }: { title: string }) => (
  <div className="p-8">
    <h1 className="text-3xl mb-4">{title}</h1>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-card p-6 rounded-2xl border border-border h-40 flex items-center justify-center">
          <p className="text-muted-foreground">Module {i} Statistics</p>
        </div>
      ))}
    </div>
  </div>
);

const LoginPage = () => {
  const { devLogin, isDevMode, signIn, user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'login' | 'forgot_email' | 'forgot_otp' | 'set_password'>('login');
  const [otpCode, setOtpCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const { logo } = useAdminSettings();

  useEffect(() => {
    // Auto-redirect if already logged in
    if (!authLoading && user && role) {
      const path = role === 'admin' ? '/admin' : role === 'employee' ? '/employee' : '/portal';
      navigate(path, { replace: true });
    }
  }, [user, role, authLoading, navigate]);

  const handleDevLogin = (role: 'admin' | 'employee' | 'client') => {
    if (devLogin) {
      devLogin(role);
      const path = role === 'admin' ? '/admin' : role === 'employee' ? '/employee' : '/portal';
      navigate(path, { replace: true });
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: signInError, role: userRole } = await signIn(email, password);
    setLoading(false);
    if (signInError) {
      setError('Invalid email or password. Please try again.');
      return;
    }
    
    // Redirect based on precise role
    const path = userRole === 'admin' ? '/admin' : userRole === 'employee' ? '/employee' : '/portal';
    navigate(path, { replace: true });
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // Send standard password recovery email.
    // Ensure Supabase reset password email template is configured to use {{ .Token }} instead of link.
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);
    
    if (error) {
      setError(error.message);
    } else {
      setView('forgot_otp');
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: otpCode,
      type: 'recovery'
    });
    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setView('set_password');
    }
  };

  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });
    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setView('login');
      setPassword('');
      alert('Password updated successfully. Please log in.');
    }
  };

  if (authLoading) return null;

  return (
    <div className="h-screen w-full flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute top-8 right-8 z-50">
        <ThemeToggle />
      </div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center font-bold text-primary text-3xl mx-auto mb-4 shadow-[0_0_40px_rgba(var(--primary),0.15)] overflow-hidden">
            {logo ? (
              <img src={logo} alt="Logo" className="w-full h-full object-cover" />
            ) : (
              "O"
            )}
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-widest uppercase" style={{ fontFamily: 'Syne, sans-serif' }}>OSBIC CONNECT</h1>
          <p className="text-muted-foreground text-sm mt-2">Service Lifecycle Management Platform</p>
        </div>
        <div className="bg-card border border-border rounded-3xl p-8 shadow-2xl">
          {isDevMode && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-[1px] flex-1 bg-border" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary px-3 py-1 bg-primary/10 rounded-full border border-primary/20">Dev Mode — Quick Access</span>
                <div className="h-[1px] flex-1 bg-border" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <button onClick={() => handleDevLogin('admin')} className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-all active:scale-95">
                  <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center text-primary text-sm font-bold">A</div>
                  <span className="text-[11px] font-bold text-primary">Admin</span>
                </button>
                <button onClick={() => handleDevLogin('employee')} className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20 transition-all active:scale-95">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400 text-sm font-bold">E</div>
                  <span className="text-[11px] font-bold text-blue-400">Employee</span>
                </button>
                <button onClick={() => handleDevLogin('client')} className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 transition-all active:scale-95">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center text-emerald-400 text-sm font-bold">C</div>
                  <span className="text-[11px] font-bold text-emerald-400">Client</span>
                </button>
              </div>
              <div className="h-[1px] bg-border my-6" />
            </div>
          )}
          {view === 'login' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Username / Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-muted/50 border border-border text-foreground p-3 rounded-xl outline-none focus:border-primary transition-all placeholder:text-muted-foreground/50"
                  placeholder="Enter your username or email"
                  required
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Password</label>
                  <button type="button" onClick={() => setView('forgot_email')} className="text-xs text-primary hover:underline font-bold">
                    Forgot Password?
                  </button>
                </div>
                <div className="relative group">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-muted/50 border border-border text-foreground p-3 rounded-xl outline-none focus:border-primary transition-all placeholder:text-muted-foreground/50 pr-12"
                    placeholder="••••••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-primary transition-colors focus:outline-none"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              {error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 text-destructive text-sm font-medium">
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary text-primary-foreground font-bold p-3 rounded-xl mt-2 hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
              >
                {loading ? (
                  <><span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> Signing in...</>
                ) : 'Sign In'}
              </button>
            </form>
          )}

          {view === 'forgot_email' && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="mb-6 text-center">
                <h3 className="text-xl font-syne font-bold text-foreground mb-2">Reset Password</h3>
                <p className="text-xs text-muted-foreground">Enter your email and we will send you an 8-digit verification code.</p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-muted/50 border border-border text-foreground p-3 rounded-xl outline-none focus:border-primary transition-all"
                  placeholder="Enter your email"
                  required
                />
              </div>
              {error && <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 text-destructive text-sm font-medium">{error}</div>}
              <button
                type="submit"
                disabled={loading || !email}
                className="w-full bg-primary text-primary-foreground font-bold p-3 rounded-xl hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send Verification Code'}
              </button>
              <button type="button" onClick={() => setView('login')} className="w-full text-xs text-muted-foreground hover:text-foreground mt-4">
                Back to Login
              </button>
            </form>
          )}

          {view === 'forgot_otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="mb-6 text-center">
                <h3 className="text-xl font-syne font-bold text-foreground mb-2">Enter Verification Code</h3>
                <p className="text-xs text-muted-foreground">We sent an 8-digit code to <span className="text-primary font-bold">{email}</span></p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">8-Digit Code</label>
                <input
                  type="text"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="w-full bg-muted/50 border border-border text-foreground p-3 rounded-xl text-center tracking-[0.5em] font-mono text-xl outline-none focus:border-primary transition-all"
                  placeholder="------"
                  maxLength={8}
                  required
                />
              </div>
              {error && <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 text-destructive text-sm font-medium">{error}</div>}
              <button
                type="submit"
                disabled={loading || otpCode.length < 6}
                className="w-full bg-primary text-primary-foreground font-bold p-3 rounded-xl hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify Code'}
              </button>
              <button type="button" onClick={() => setView('login')} className="w-full text-xs text-muted-foreground hover:text-foreground mt-4">
                Back to Login
              </button>
            </form>
          )}

          {view === 'set_password' && (
            <form onSubmit={handleSetNewPassword} className="space-y-4">
              <div className="mb-6 text-center">
                <h3 className="text-xl font-syne font-bold text-foreground mb-2">Set New Password</h3>
                <p className="text-xs text-muted-foreground">Code verified successfully. Please choose a new secure password.</p>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">New Password</label>
                <div className="relative group">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-muted/50 border border-border text-foreground p-3 rounded-xl outline-none focus:border-primary transition-all pr-12"
                    placeholder="Min 6 characters"
                    minLength={6}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-muted-foreground hover:text-primary transition-colors focus:outline-none"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              {error && <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 text-destructive text-sm font-medium">{error}</div>}
              <button
                type="submit"
                disabled={loading || !newPassword}
                className="w-full bg-primary text-primary-foreground font-bold p-3 rounded-xl hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50"
              >
                {loading ? 'Updating...' : 'Update Password & Login'}
              </button>
            </form>
          )}
        </div>
        <p className="text-center text-muted-foreground text-xs mt-6">Client portal? <a href="/portal/login" className="text-primary hover:underline">Access here →</a></p>
      </div>
    </div>
  );
};


// ─── Resilient QueryClient ────────────────────────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Only fetch when the browser is online
      networkMode: 'online',
      // Retry up to 3 times with exponential back-off (1s, 2s, 4s)
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      // Keep data fresh for 2 min, cached for 10 min
      staleTime: 2 * 60 * 1000,
      gcTime:   10 * 60 * 1000,
    },
    mutations: {
      // Queue mutations when offline — they will auto-resume when reconnected
      networkMode: 'online',
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 4000),
      onError: async (error: any) => {
        // Auto-refresh session on 401 Unauthorized
        if (error?.status === 401 || error?.message?.includes('JWT')) {
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (!refreshError) {
            // Session refreshed — caller can retry
            console.info('[Auth] Session refreshed after 401.');
          }
        }
      },
    },
  },
});

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BranchProvider>
        <BrowserRouter>
          {/* ── Network status banner (all portals) ── */}
          <NetworkStatusBanner />
          <Toaster 
            position="top-right" 
            containerStyle={{ zIndex: 999999 }}
          />
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/" element={<Navigate to="/admin" replace />} />

            {/* Admin Portal */}
            <Route path="/admin" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="employees" element={<Employees />} />
              <Route path="employees/:id" element={<EmployeeDetail />} />
              <Route path="clients" element={<Clients />} />
              <Route path="clients/:id" element={<ClientDetail />} />
              <Route path="services" element={<ServicesList />} />
              <Route path="services/new" element={<ServiceForm />} />
              <Route path="services/:id" element={<ServiceForm />} />
              <Route path="packages" element={<PackagesList />} />
              <Route path="packages/new" element={<PackageForm />} />
              <Route path="packages/:id" element={<PackageForm />} />
              <Route path="jobs" element={<Jobs />} />
              <Route path="jobs/:id" element={<JobDetail />} />
              <Route path="approvals" element={<SLAApprovals />} />
              <Route path="finance" element={<Finance />} />
              <Route path="messages" element={<AdminMessages />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="audit" element={<Audit />} />
              <Route path="settings" element={<Settings />} />
              <Route path="leads" element={<AdminLeads />} />
            </Route>

            {/* Employee Portal */}
            <Route path="/employee" element={
              <ProtectedRoute allowedRoles={['employee']}>
                <EmployeeLayout />
              </ProtectedRoute>
            }>
              <Route index element={<EmployeeDashboard />} />
              <Route path="tasks" element={<UnifiedWorkspace filterType="tasks" />} />
              <Route path="clients" element={<UnifiedWorkspace filterType="clients" />} />
              <Route path="pipeline" element={<UnifiedWorkspace filterType="pipeline" />} />
              <Route path="messages" element={<EmployeeMessages />} />
              <Route path="notifications" element={<EmployeeNotifications />} />
              <Route path="profile" element={<EmployeeProfile />} />
              <Route path="reports" element={<EmployeeReports />} />
              <Route path="invoices" element={<EmployeeInvoices />} />
              <Route path="invoices/:id" element={<InvoiceBuilder />} />
              <Route path="quotations/:id" element={<QuotationBuilder />} />
              <Route path="leads" element={<EmployeeLeads />} />
              <Route path="packages/groups/:id" element={<PackageGroupDetail />} />
              <Route path="my-tasks" element={<MyTasks />} />
              <Route path="pro-queue" element={<ProQueue />} />
              <Route path="accounts" element={<AccountsDashboard />} />
              <Route path="team" element={<BranchTeam />} />
              <Route path="approvals" element={<BranchApprovals />} />
            </Route>

            {/* Client Portal */}
            <Route path="/portal/login" element={<ClientLogin />} />
            <Route path="/portal" element={
              <ProtectedRoute allowedRoles={['client']}>
                <ClientLayout />
              </ProtectedRoute>
            }>
              <Route index element={<ClientDashboard />} />
              <Route path="dashboard" element={<ClientDashboard />} />
              <Route path="jobs/:id" element={<ClientJobDetail />} />
              <Route path="profile" element={<ClientProfile />} />
              <Route path="messages" element={<ClientMessages />} />
              <Route path="services" element={<ServicesCatalog />} />
              <Route path="history" element={<ClientHistory />} />
              <Route path="documents" element={<ClientDocuments />} />
              <Route path="payments" element={<ClientPayments />} />
              <Route path="notifications" element={<ClientNotifications />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
        </BranchProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);
}

export default App;
