import { useNotification } from "../context/NotificationContext";

export function useSafeNotification() {
  try {
    return useNotification();
  } catch {
    return {
      showNotification: (msg: string, _type?: "success" | "error" | "info") => {
        alert(msg);
      },
      hideNotification: () => {},
    };
  }
}