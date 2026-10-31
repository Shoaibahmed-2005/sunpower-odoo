import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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

// Customer Portal
import { PortalProvider } from "./portal/PortalContext";
import PortalGuard from "./portal/PortalGuard";
import PortalLayout from "./portal/PortalLayout";
import CustomerLogin from "./pages/portal/Login";
import CustomerSignup from "./pages/portal/Signup";
import CustomerForgot from "./pages/portal/Forgot";
import CustomerHome from "./pages/portal/Home";
import CustomerProducts from "./pages/portal/Products";
import CustomerQuotations from "./pages/portal/Quotations";
import CustomerRequests from "./pages/portal/Requests";
import CustomerMessages from "./pages/portal/Messages";

// Staff customer message desk
import CustomerMessagesStaff from "./pages/service/CustomerMessages";

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
  {
    path: "/messages",
    element: <CustomerMessagesStaff />,
    perm: "leads:read",
    menu: { group: "Support", label: "Customer Chat" },
  },
];

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <PortalProvider>
          <BrowserRouter>
            <Routes>
              {/* Staff Login */}
              <Route path="/login" element={<Login />} />

              {/* Public customer enquiry route */}
              {publicSalesRoutes.map((r) => (
                <Route key={r.path} path={r.path} element={r.element} />
              ))}

              {/* Customer Portal Auth routes (public) */}
              <Route path="/portal" element={<CustomerLogin />} />
              <Route path="/portal/login" element={<Navigate to="/portal" replace />} />
              <Route path="/portal/signup" element={<CustomerSignup />} />
              <Route path="/portal/forgot" element={<CustomerForgot />} />

              {/* Protected Customer Portal routes */}
              <Route
                path="/portal/*"
                element={
                  <PortalGuard>
                    <PortalLayout />
                  </PortalGuard>
                }
              >
                <Route path="home" element={<CustomerHome />} />
                <Route path="products" element={<CustomerProducts />} />
                <Route path="quotations" element={<CustomerQuotations />} />
                <Route path="requests" element={<CustomerRequests />} />
                <Route path="messages" element={<CustomerMessages />} />
              </Route>

              {/* Mobile /m technician routes */}
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

              {/* Desktop staff routes inside Layout */}
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
                {/* Fallback 404 */}
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </PortalProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
