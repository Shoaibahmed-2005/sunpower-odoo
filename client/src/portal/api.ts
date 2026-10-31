import axios from "axios";

export const portalApi = axios.create({
  baseURL: "/api/portal",
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

portalApi.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // Skip redirect if already on login/signup or me check
      const path = window.location.pathname;
      const isAuthCheck = err.config?.url?.includes("/auth/me");
      if (!isAuthCheck && !path.startsWith("/portal/login") && !path.startsWith("/portal/signup") && path !== "/portal") {
        window.location.href = "/portal";
      }
    }
    return Promise.reject(err);
  }
);

export interface CustomerAccountInfo {
  id: number;
  phone: string;
  name: string;
  phoneMasked?: string;
}

export interface CustomerOverview {
  name: string;
  phone: string;
  productsCount: number;
  underWarrantyCount: number;
  activeJobsCount: number;
  openTicketsCount: number;
  pendingInvoicesCount: number;
  unreadMessagesCount: number;
}

export interface DeliveredProduct {
  id: number;
  serial: string;
  productName: string;
  leadRef: string;
  deliveredAt: string | null;
  warrantyUntil: string | null;
  underWarranty: boolean;
}

export interface CustomerQuotation {
  id: number;
  ref: string;
  packageName: string;
  total: number;
  subsidy: number;
  netPayable: number;
  paid: number;
  pending: number;
  balance: number;
  status: string;
  lines: { id: number; name: string; qty: number; unitPrice: number }[];
  invoices: {
    id: number;
    ref: string;
    type: string;
    amount: number;
    status: string;
    reference: string | null;
    submittedByCustomer: boolean;
    paidAt: string | null;
  }[];
}

export interface CustomerTicket {
  id: number;
  ref: string;
  serial: string | null;
  productName: string | null;
  issue: string;
  status: string;
  underWarranty: boolean;
  partsCost: number;
  labourCost: number;
  billAmount: number;
  createdAt: string;
  resolvedAt: string | null;
  customerConfirmedAt: string | null;
  source: string;
}

export interface MessageItem {
  id: number;
  senderType: "CUSTOMER" | "STAFF";
  text: string;
  readAt: string | null;
  createdAt: string;
}

export interface CustomerNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  date: string;
}

export const portalService = {
  // Auth
  signupStart: (phone: string) =>
    portalApi.post<{ sent: boolean; demo_code?: string }>("/auth/signup/start", { phone }),

  signupVerify: (data: { phone: string; code: string; name: string; password: string }) =>
    portalApi.post<{ account: CustomerAccountInfo }>("/auth/signup/verify", data),

  login: (data: { phone: string; password: string }) =>
    portalApi.post<{ account: CustomerAccountInfo }>("/auth/login", data),

  forgotPassword: (phone: string) =>
    portalApi.post<{ sent: boolean; demo_code?: string }>("/auth/password/forgot", { phone }),

  resetPassword: (data: { phone: string; code: string; newPassword: string }) =>
    portalApi.post<{ success: boolean }>("/auth/password/reset", data),

  logout: () => portalApi.post("/auth/logout"),

  me: () => portalApi.get<{ account: CustomerAccountInfo }>("/auth/me"),

  // Data
  getOverview: () => portalApi.get<CustomerOverview>("/overview"),

  getProducts: () => portalApi.get<DeliveredProduct[]>("/products"),

  getQuotations: () => portalApi.get<CustomerQuotation[]>("/quotations"),

  submitPayment: (quotationId: number, data: { amount: number; reference: string }) =>
    portalApi.post(`/quotations/${quotationId}/payments`, data),

  getTickets: () => portalApi.get<CustomerTicket[]>("/tickets"),

  createTicket: (data: { serial: string; issue: string }) =>
    portalApi.post<CustomerTicket>("/tickets", data),

  confirmTicket: (ticketId: number) =>
    portalApi.post(`/tickets/${ticketId}/confirm`),

  getMessages: () => portalApi.get<MessageItem[]>("/messages"),

  sendMessage: (data: { text: string; leadId?: number }) =>
    portalApi.post<MessageItem>("/messages", data),

  requestCallback: (data: { preferredTime?: string; note?: string }) =>
    portalApi.post<{ success: boolean; message: string }>("/callback", data),

  submitEnquiry: (data: { monthlyBill: number; roofArea?: number; systemType?: string }) =>
    portalApi.post<{ id: number; ref: string; message: string }>("/enquiry", data),

  getNotifications: () => portalApi.get<CustomerNotification[]>("/notifications"),
};

