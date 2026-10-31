import { useState, useEffect, useCallback } from "react";
import { CheckCircle, XCircle, X } from "lucide-react";

type ToastType = "success" | "error";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

type Listener = (toasts: ToastItem[]) => void;

let nextId = 0;
let toasts: ToastItem[] = [];
const listeners: Set<Listener> = new Set();

function notify() {
  listeners.forEach((l) => l([...toasts]));
}

function addToast(type: ToastType, message: string) {
  const id = nextId++;
  toasts = [{ id, type, message }, ...toasts].slice(0, 3);
  notify();
  setTimeout(() => removeToast(id), 3000);
}

function removeToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  notify();
}

export const toast = {
  success: (message: string) => addToast("success", message),
  error: (message: string) => addToast("error", message),
};

export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const listener: Listener = (t) => setItems(t);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  const handleClose = useCallback((id: number) => removeToast(id), []);

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80">
      {items.map((t) => (
        <div
          key={t.id}
          className={`bg-surface shadow-pop rounded-md p-4 flex gap-3 items-center text-sm animate-slide-in border-l-4 ${
            t.type === "success" ? "border-l-success" : "border-l-danger"
          }`}
        >
          {t.type === "success" ? (
            <CheckCircle className="w-5 h-5 text-success shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 text-danger shrink-0" />
          )}
          <span className="flex-1">{t.message}</span>
          <button onClick={() => handleClose(t.id)} className="shrink-0 text-muted hover:text-text">
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
