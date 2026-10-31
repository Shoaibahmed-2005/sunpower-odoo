import { ShieldX } from "lucide-react";
import { Link } from "react-router-dom";

export default function Forbidden() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4">
      <ShieldX className="h-12 w-12 text-danger" />
      <h1 className="font-heading text-2xl font-semibold text-text">
        Access Denied
      </h1>
      <p className="text-muted text-sm">
        You don't have permission to view this page.
      </p>
      <Link to="/" className="text-primary text-sm font-medium hover:underline">
        Go to Dashboard
      </Link>
    </div>
  );
}
