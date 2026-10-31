import { useAuth } from "../auth/AuthContext";
import Forbidden from "./Forbidden";

interface RequirePermProps {
  perm: string;
  children: React.ReactNode;
}

export default function RequirePerm({ perm, children }: RequirePermProps) {
  const { can } = useAuth();

  if (!can(perm)) {
    return <Forbidden />;
  }

  return <>{children}</>;
}
