// Member B's routes (BUILD_PLAN §9). App.tsx (D) adds these inside <Layout> and wraps each in <RequirePerm perm>.
// The menu shows only entries with `menu` whose `perm` the user has.
import type { ReactNode } from "react";
import LeadsList from "../pages/sales/LeadsList";
import LeadNew from "../pages/sales/LeadNew";
import LeadForm from "../pages/sales/LeadForm";
import SurveysList from "../pages/sales/SurveysList";
import SurveyDetail from "../pages/sales/SurveyDetail";
import SurveyForm from "../pages/mobile/SurveyForm";
import EnquiryForm from "../pages/sales/EnquiryForm";
import UsersPage from "../pages/admin/UsersPage";

type Route = { path: string; element: ReactNode; perm: string; menu?: { group: string; label: string } };

export const salesRoutes: Route[] = [
  { path: "/leads", element: <LeadsList />, perm: "leads:read", menu: { group: "Sales", label: "Enquiries" } },
  { path: "/leads/new", element: <LeadNew />, perm: "leads:write" },
  { path: "/leads/:id", element: <LeadForm />, perm: "leads:read" },
  // surveys:approve (not surveys:read) so technicians use their phone screens, not the office list
  { path: "/surveys", element: <SurveysList />, perm: "surveys:approve", menu: { group: "Sales", label: "Surveys" } },
  { path: "/surveys/:id", element: <SurveyDetail />, perm: "surveys:approve" },
  { path: "/m/surveys/:id", element: <SurveyForm />, perm: "surveys:submit" },
  { path: "/admin/users", element: <UsersPage />, perm: "users:write", menu: { group: "Settings", label: "Users & Roles" } },
];

// Public page: mount OUTSIDE <Layout> and WITHOUT <RequirePerm> (customers never log in).
export const publicSalesRoutes: { path: string; element: ReactNode }[] = [
  { path: "/enquire", element: <EnquiryForm /> },
];
