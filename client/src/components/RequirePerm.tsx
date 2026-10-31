import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import Forbidden from "./Forbidden";

interface RequirePermProps {
  perm: string;
  children: React.ReactNode;
}

export default function RequirePerm({ perm, children }: RequirePermProps) {
  const { user, loading, can } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!can(perm)) {
    return <Forbidden />;
  }

  return <>{children}</>;
}
