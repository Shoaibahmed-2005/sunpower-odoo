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

/** The server's message from our standard {error, field} body, or a fallback. */
export function errorText(err: any, fallback: string): string {
  return err?.response?.data?.error || fallback;
}

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
  balance: number;
  minAdvance: number;
  status: "SENT" | "CONFIRMED";
  acceptedName: string | null;
  acceptedAt: string | null;
  preferredDate: string | null;
  onlinePaymentsEnabled: boolean;
  job: { scheduledDate: string; technicianName: string | null; status: string } | null;
  lines: { id: number; name: string; qty: number; unitPrice: number }[];
  invoices: {
    id: number;
    ref: string;
    type: string;
    amount: number;
    status: string;
    method: string | null;
    paidAt: string | null;
  }[];
}

export interface PaymentOrder {
  keyId: string;
  orderId: string;
  amount: number; // paise
  currency: string;
  name: string;
  description: string;
  prefill: { name: string; contact: string };
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

  acceptQuotation: (quotationId: number, data: { name: string; agree: true; preferredDate?: string }) =>
    portalApi.post(`/quotations/${quotationId}/accept`, data),

  createOrder: (quotationId: number, data: { kind: "ADVANCE" | "FULL" | "PART"; amount?: number }) =>
    portalApi.post<PaymentOrder>(`/quotations/${quotationId}/order`, data),

  verifyPayment: (data: { razorpayOrderId: string; razorpayPaymentId: string; razorpaySignature: string }) =>
    portalApi.post<{ success: boolean; invoiceRef?: string; amount?: number }>("/payments/verify", data),

  markPaymentFailed: (orderId: string) => portalApi.post(`/payments/${orderId}/failed`),

  getTickets: () => portalApi.get<CustomerTicket[]>("/tickets"),

  createTicket: (data: { serial: string; issue: string }) =>
    portalApi.post<CustomerTicket>("/tickets", data),

  confirmTicket: (ticketId: number) =>
    portalApi.post(`/tickets/${ticketId}/confirm`),

  getMessages: () => portalApi.get<MessageItem[]>("/messages"),

  sendMessage: (data: { text: string }) =>
    portalApi.post<MessageItem>("/messages", data),

  requestCallback: (data: { preferredTime?: string; note?: string }) =>
    portalApi.post<{ success: boolean; message: string }>("/callback", data),

  submitEnquiry: (data: {
    address: string;
    kw: number;
    systemType: string;
    monthlyBill: number;
    roofArea?: number;
  }) => portalApi.post<{ id: number; ref: string; message: string }>("/enquiry", data),

  getNotifications: () => portalApi.get<CustomerNotification[]>("/notifications"),
};

