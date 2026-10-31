import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { AuthProvider } from "./auth/AuthContext";
import Layout from "./components/Layout";
import RequirePerm from "./components/RequirePerm";
import NotFound from "./components/NotFound";
import { salesRoutes, publicSalesRoutes } from "./routes/salesRoutes";
import { quoteRoutes } from "./routes/quoteRoutes";
import { inventoryRoutes } from "./routes/inventoryRoutes";
import { fieldRoutes } from "./routes/fieldRoutes";
import TechHome from "./pages/mobile/TechHome";
import JobWorksheet from "./pages/mobile/JobWorksheet";
import SurveyForm from "./pages/mobile/SurveyForm";
import Login from "./pages/auth/Login";

export interface AppRoute {
  path: string;
  element: React.ReactNode;
  perm?: string;
  menu?: { group: string; label: string };
}

const allRoutes: AppRoute[] = [
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
            <Route path="/login" element={<Login />} />

            {/* Public routes (no login required) */}
            {publicSalesRoutes.map((r) => (
              <Route key={r.path} path={r.path} element={r.element} />
            ))}

            {/* Mobile /m routes have their own PhoneLayout, render directly */}
            <Route
              path="/m"
              element={
                <RequirePerm perm="jobs:mine">
                  <TechHome />
                </RequirePerm>
              }
            />
            <Route
              path="/m/jobs/:id"
              element={
                <RequirePerm perm="jobs:mine">
                  <JobWorksheet />
                </RequirePerm>
              }
            />
            <Route
              path="/m/surveys/:id"
              element={
                <RequirePerm perm="surveys:submit">
                  <SurveyForm />
                </RequirePerm>
              }
            />

            {/* Desktop routes wrapped in Layout */}
            <Route element={<Layout />}>
              {allRoutes
                .filter((r) => r.path !== "/m" && !r.path.startsWith("/m/"))
                .map((r) => (
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
              {/* Fallback 404 route inside Layout */}
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
