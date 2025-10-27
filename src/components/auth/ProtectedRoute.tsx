import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export const ProtectedRoute = () => {
  const { user, guest, loading } = useAuth();
  const location = useLocation();

  if (loading) return null; // or a spinner
  if (!user && !guest) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }
  return <Outlet />;
};
