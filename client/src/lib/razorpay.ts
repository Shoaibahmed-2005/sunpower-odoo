// Loads Razorpay Checkout (official script) once, the first time a customer pays.
const SRC = "https://checkout.razorpay.com/v1/checkout.js";
let loading: Promise<void> | null = null;

export function loadRazorpay(): Promise<void> {
  if ((window as any).Razorpay) return Promise.resolve();
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SRC;
      script.onload = () => resolve();
      script.onerror = () => {
        loading = null; // allow a retry
        reject(new Error("Could not load Razorpay. Check your internet connection."));
      };
      document.body.appendChild(script);
    });
  }
  return loading;
}
