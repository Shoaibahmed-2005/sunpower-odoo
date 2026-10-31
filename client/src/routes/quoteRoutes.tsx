/**
 * Quotation and Invoice routes.
 * Owner: C (BUILD_PLAN §3, §9).
 */
import { AppRoute } from "../App";
import QuotationList from "../pages/quotes/QuotationList";
import QuotationForm from "../pages/quotes/QuotationForm";
import InvoicesList from "../pages/accounts/InvoicesList";

export const quoteRoutes: AppRoute[] = [
  {
    path: "/quotations",
    element: <QuotationList />,
    perm: "quotes:read",
    menu: { group: "Sales", label: "Quotations" },
  },
  {
    path: "/quotations/:id",
    element: <QuotationForm />,
    perm: "quotes:read",
  },
  {
    path: "/invoices",
    element: <InvoicesList />,
    perm: "invoices:read",
    menu: { group: "Accounts", label: "Invoices" },
  },
];
