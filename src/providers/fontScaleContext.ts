import { createContext, useContext } from "react";
import type { FontScale } from "./fontScale";

export interface FontScaleContextValue {
  scale: FontScale;
  setScale: (scale: FontScale) => void;
  increase: () => void;
  decrease: () => void;
  canIncrease: boolean;
  canDecrease: boolean;
}

export const FontScaleContext = createContext<FontScaleContextValue | undefined>(undefined);

export function useFontScale(): FontScaleContextValue {
  const context = useContext(FontScaleContext);
  if (!context) {
    throw new Error("useFontScale must be used within FontScaleProvider");
  }
  return context;
}
