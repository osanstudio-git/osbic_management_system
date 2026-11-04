import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('admin' | 'employee' | 'client')[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, loading, role } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#0A0F1E]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-[#D4AF37]/20 border-t-[#D4AF37] animate-spin" />
          <p className="text-[#475569] text-sm font-medium">Authenticating...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    const isPortalPath = location.pathname.startsWith('/portal');
    return <Navigate to={isPortalPath ? "/portal/login" : "/login"} state={{ from: location }} replace />;
  }

  // Strict role verification: If route requires specific roles, ensure role is verified
  if (allowedRoles && allowedRoles.length > 0) {
    // If route requires admin, non-admins must NEVER hang on /admin — redirect immediately to /employee
    if (allowedRoles.includes('admin') && role !== 'admin') {
      const redirectPath = role === 'client' ? '/portal' : '/employee';
      return <Navigate to={redirectPath} replace />;
    }

    // If role is still loading or resolving, do not let user pass through
    if (!role) {
      return (
        <div className="flex h-screen w-full items-center justify-center bg-[#0A0F1E]">
          <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full border-2 border-[#D4AF37]/20 border-t-[#D4AF37] animate-spin" />
            <p className="text-[#475569] text-sm font-medium">Loading workspace...</p>
          </div>
        </div>
      );
    }

    if (!allowedRoles.includes(role)) {
      // Kick to their correct restricted portal
      const redirectPath = role === 'admin' ? '/admin' : role === 'client' ? '/portal' : '/employee';
      return <Navigate to={redirectPath} replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
