/**
 * Toast notification system
 * Replaces browser alert() with a non-obtrusive UI component
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "info") => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const newToast: Toast = { id, message, type };

    setToasts((prev) => [...prev, newToast]);

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const handleDismiss = useCallback(() => {
    onDismiss(toast.id);
  }, [toast.id, onDismiss]);

  const styles = {
    success: {
      bg: "bg-dark-surface",
      border: "border-green-500",
      text: "text-green-400",
      shadow: "shadow-[0_0_20px_rgba(34,197,94,0.4)]",
      icon: <CheckCircle className="w-5 h-5 text-green-400" />,
      symbol: "✓",
    },
    error: {
      bg: "bg-dark-surface",
      border: "border-red-500",
      text: "text-red-400",
      shadow: "shadow-[0_0_20px_rgba(239,68,68,0.4)]",
      icon: <AlertCircle className="w-5 h-5 text-red-400" />,
      symbol: "✗",
    },
    info: {
      bg: "bg-dark-surface",
      border: "border-cyan",
      text: "text-cyan",
      shadow: "shadow-[0_0_20px_rgba(0,217,255,0.4)]",
      icon: <Info className="w-5 h-5 text-cyan" />,
      symbol: "ℹ",
    },
  };

  const style = styles[toast.type];

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, x: 100 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      transition={{ duration: 0.2 }}
      className="pointer-events-auto"
    >
      <div className={`${style.bg} border-2 ${style.border} ${style.shadow} rounded-lg overflow-hidden min-w-[320px] max-w-md`}>
        {/* Terminal header */}
        <div className="h-6 bg-dark-border border-b-2 border-current flex items-center px-3 gap-2 opacity-50">
          <div className="w-2 h-2 rounded-full bg-red-500/50"></div>
          <div className="w-2 h-2 rounded-full bg-amber/50"></div>
          <div className="w-2 h-2 rounded-full bg-cyan/50"></div>
          <span className="ml-1 text-[10px] font-mono text-text-muted">notification</span>
        </div>

        <div className="p-4">
          <div className="flex items-start gap-3">
            <span className={`${style.text} font-mono text-lg font-bold`}>
              {style.symbol}
            </span>
            <p className={`flex-1 text-sm font-mono ${style.text}`}>
              {toast.message}
            </p>
            <button
              onClick={handleDismiss}
              className="text-text-muted hover:text-red-400 transition-colors"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
