// Owned by A — dashboard, dispatches, stock, serials, profit report.
import { AppRoute } from "../App";
import Dashboard from "../pages/dashboard/Dashboard";
import ProfitReport from "../pages/dashboard/ProfitReport";
import DispatchesList from "../pages/inventory/DispatchesList";
import DispatchForm from "../pages/inventory/DispatchForm";
import StockPage from "../pages/inventory/StockPage";
import SerialsLookup from "../pages/inventory/SerialsLookup";

export const inventoryRoutes: AppRoute[] = [
  { path: "/", element: <Dashboard />, perm: "dashboard:read", menu: { group: "Overview", label: "Dashboard" } },
  { path: "/dispatches", element: <DispatchesList />, perm: "dispatches:read", menu: { group: "Inventory", label: "Dispatches" } },
  { path: "/dispatches/:id", element: <DispatchForm />, perm: "dispatches:read" },
  { path: "/stock", element: <StockPage />, perm: "stock:read", menu: { group: "Inventory", label: "Stock" } },
  { path: "/serials", element: <SerialsLookup />, perm: "serials:read", menu: { group: "Inventory", label: "Serials" } },
  { path: "/reports/profit", element: <ProfitReport />, perm: "reports:read", menu: { group: "Reports", label: "Profit per job" } },
];
