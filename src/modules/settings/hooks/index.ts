// src/modules/settings/hooks/index.ts
// Reuses the single app-wide notification provider instead of maintaining a
// duplicate toast system within the Settings module.

import { useNotification } from "../../../providers/NotificationProvider";

export const useToast = () => {
  const { showNotification } = useNotification();
  return {
    showToast: (message: string, type: "success" | "error" | "info" = "info") =>
      showNotification(message, type),
  };
};
