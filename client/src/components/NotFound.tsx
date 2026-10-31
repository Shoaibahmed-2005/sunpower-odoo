import { AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 py-16 text-center px-4">
      <AlertCircle className="h-12 w-12 text-muted" />
      <h1 className="font-heading text-2xl font-semibold text-text">
        Page not found
      </h1>
      <p className="text-muted text-sm max-w-md">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        to="/"
        className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-sm bg-primary text-white hover:bg-primary-hover transition-colors"
      >
        Go to Dashboard
      </Link>
    </div>
  );
}
