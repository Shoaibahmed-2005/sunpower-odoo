// Owned by D — field work + service routes
import { AppRoute } from "../App";
import JobsList from "../pages/field/JobsList";
import JobDetail from "../pages/field/JobDetail";
import TicketsList from "../pages/service/TicketsList";
import NewTicket from "../pages/service/NewTicket";
import TicketDetail from "../pages/service/TicketDetail";
import TechHome from "../pages/mobile/TechHome";
import JobWorksheet from "../pages/mobile/JobWorksheet";
import Styleguide from "../pages/Styleguide";

export const fieldRoutes: AppRoute[] = [
  { path: "/jobs", element: <JobsList />, perm: "jobs:read", menu: { group: "Field", label: "Installations" } },
  { path: "/jobs/:id", element: <JobDetail />, perm: "jobs:read" },
  { path: "/tickets", element: <TicketsList />, perm: "tickets:read", menu: { group: "Service", label: "Tickets" } },
  { path: "/tickets/new", element: <NewTicket />, perm: "tickets:write" },
  { path: "/tickets/:id", element: <TicketDetail />, perm: "tickets:read" },
  { path: "/m", element: <TechHome />, perm: "jobs:mine" },
  { path: "/m/jobs/:id", element: <JobWorksheet />, perm: "jobs:mine" },
  { path: "/styleguide", element: <Styleguide /> },
];
