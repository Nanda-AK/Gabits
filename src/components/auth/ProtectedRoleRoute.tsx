import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getProfile } from "@/services/profile";

export const ProtectedRoleRoute: React.FC<{ roles: Array<'student'|'parent'|'teacher'|'principal'> }>
  = ({ roles }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (loading) return;
      if (!user) { setAllowed(false); return; }
      const p = await getProfile(user.id);
      const role = (p?.role as any) || 'student';
      if (!cancelled) setAllowed(roles.includes(role));
    })();
    return () => { cancelled = true; };
  }, [user?.id, loading, roles.join('|')]);

  if (loading || allowed === null) return null;
  if (!user) return <Navigate to="/" state={{ from: location }} replace />;
  if (!allowed) return <Navigate to="/" replace />;
  return <Outlet />;
};
