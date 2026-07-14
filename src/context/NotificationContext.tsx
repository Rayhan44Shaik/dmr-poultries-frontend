import type { ReactNode } from "react";
import { createContext, useContext, useState } from "react";
import { CheckCircle, XCircle, Info } from "lucide-react";

type NotificationType = "success" | "error" | "info";

interface NotificationContextType {
  showNotification: (message: string, type?: NotificationType) => void;
  hideNotification: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [type, setType] = useState<NotificationType>("info");

  const showNotification = (msg: string, t: NotificationType = "info") => {
    setMessage(msg);
    setType(t);
    setVisible(true);
    setTimeout(() => setVisible(false), 5000);
  };

  const hideNotification = () => setVisible(false);

  if (!visible) return <>{children}</>;

  return (
    <NotificationContext.Provider value={{ showNotification, hideNotification }}>
      {children}
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 pointer-events-none">
        <div className="pointer-events-auto max-w-md w-full mx-4 rounded-xl bg-white shadow-2xl animate-in fade-in zoom-in duration-200 overflow-hidden">
          <div className="flex items-start gap-3 p-5 pb-3">
            <div
              className={`flex-shrink-0 rounded-full p-1.5 ${
                type === "success"
                  ? "bg-green-100 text-green-600"
                  : type === "error"
                  ? "bg-red-100 text-red-600"
                  : "bg-blue-100 text-blue-600"
              }`}
            >
              {type === "success" && <CheckCircle size={20} />}
              {type === "error" && <XCircle size={20} />}
              {type === "info" && <Info size={20} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-slate-700 leading-relaxed">{message}</p>
            </div>
          </div>
          <div className="px-5 pb-5 pt-1 border-t border-slate-100">
            <button
              onClick={hideNotification}
              className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 transition-colors"
            >
              {type === "error" ? "OK" : "Close"}
            </button>
          </div>
        </div>
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotification must be used within a NotificationProvider");
  }
  return context;
}