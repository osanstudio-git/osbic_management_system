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

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    // Kick to their correct restricted portal
    const redirectPath = role === 'admin' ? '/admin' : role === 'employee' ? '/employee' : '/portal';
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
