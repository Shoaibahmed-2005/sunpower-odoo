/**
 * API client with cookie-based auth and unified error toast handling.
 */
import axios from "axios";
import { toast } from "../components/Toast";

const api = axios.create({
  baseURL: "/api",
  withCredentials: true,
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || "";

    // On 401: redirect to login if not checking session (/auth/me) or trying to log in (/auth/login)
    // Never redirect public pages (/login, /enquire)
    if (status === 401) {
      if (!url.includes("/auth/me") && !url.includes("/auth/login")) {
        if (window.location.pathname !== "/login" && window.location.pathname !== "/enquire") {
          window.location.href = "/login";
        }
      }
    }

    const message =
      error.response?.data?.error ||
      error.response?.data?.detail ||
      error.message ||
      "Request failed";

    // Suppress 401 toasts for silent initial /auth/me check
    if (status !== 401 || (!url.includes("/auth/me") && !url.includes("/auth/login"))) {
      toast.error(message);
    }

    return Promise.reject(error);
  }
);

export default api;
