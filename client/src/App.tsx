import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { AuthProvider } from "./auth/AuthContext";
import Layout from "./components/Layout";
import RequirePerm from "./components/RequirePerm";
import { salesRoutes } from "./routes/salesRoutes";
import { quoteRoutes } from "./routes/quoteRoutes";
import { inventoryRoutes } from "./routes/inventoryRoutes";
import { fieldRoutes } from "./routes/fieldRoutes";
import Dashboard from "./pages/dashboard/Dashboard";

export interface AppRoute {
  path: string;
  element: React.ReactNode;
  perm?: string;
  menu?: { group: string; label: string };
}

const allRoutes: AppRoute[] = [
  { path: "/", element: <Dashboard />, perm: "dashboard:read" },
  ...salesRoutes,
  ...quoteRoutes,
  ...inventoryRoutes,
  ...fieldRoutes,
];

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Login is outside Layout — owned by C */}
            <Route path="/login" element={<div>Login page — owned by C</div>} />
            <Route element={<Layout />}>
              {allRoutes.map((r) => (
                <Route
                  key={r.path}
                  path={r.path}
                  element={
                    r.perm ? (
                      <RequirePerm perm={r.perm}>{r.element}</RequirePerm>
                    ) : (
                      r.element
                    )
                  }
                />
              ))}
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
