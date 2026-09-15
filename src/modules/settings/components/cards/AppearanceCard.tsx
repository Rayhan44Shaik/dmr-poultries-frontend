import React, { useState } from "react";
import { Card, Button } from "../common";
import { useFontSize, FONT_SCALE_STEPS, type FontScale } from "../../../../providers/FontSizeProvider";

const SCALE_LABELS: Record<FontScale, string> = {
  1: "100%",
  1.1: "110%",
  1.2: "120%",
  1.3: "130%",
  1.4: "140%",
  1.5: "150%",
};

export const AppearanceCard: React.FC = () => {
  const { scale, setScale, reset } = useFontSize();
  const [saved, setSaved] = useState(false);

  return (
    <Card className="flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <span className="text-base font-bold text-slate-800">Appearance</span>
        <span className="text-[11px] text-slate-400">Customise how the app looks</span>
      </div>

      {/* Dark/light mode is intentionally disabled for now. The existing
          ThemeProvider and implementation remain in the project for a future
          release; the controls are commented out rather than removed. */}
      {/*
      <div>
        <label className="mb-2 block text-xs font-semibold text-slate-600">Theme</label>
        <div className="flex gap-3">
          <button type="button">☀ Light</button>
          <button type="button">☾ Dark</button>
        </div>
      </div>
      */}

      <div>
        <label className="mb-2 block text-xs font-semibold text-slate-600">Font size</label>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {FONT_SCALE_STEPS.map((step) => (
            <button
              key={step}
              type="button"
              onClick={() => setScale(step)}
              className={`flex min-h-9 items-center justify-center rounded-lg border px-2 text-xs transition-colors ${
                scale === step
                  ? "border-brand-600 bg-brand-50 font-semibold text-brand-800"
                  : "border-slate-200 text-slate-500 hover:border-slate-300"
              }`}
            >
              {SCALE_LABELS[step]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-slate-400">
          Scales the complete application UI — text, buttons, forms, tables, KPIs, charts and calendars — without changing business logic.
        </p>
      </div>

      <div>
        <label className="mb-2 block text-xs font-semibold text-slate-600">Brand accent</label>
        <div className="flex gap-3">
          <div className="h-7 w-7 rounded-full bg-brand-600 ring-2 ring-brand-600/30" title="DMR Emerald (active)" />
          <div className="h-7 w-7 rounded-full border border-slate-200 bg-slate-100" title="More accents coming soon" />
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
        <Button
          variant="secondary"
          onClick={() => {
            reset();
            setSaved(false);
          }}
        >
          Reset
        </Button>
        <Button
          onClick={() => {
            setSaved(true);
            window.setTimeout(() => setSaved(false), 2000);
          }}
        >
          {saved ? "Saved ✓" : "Apply changes"}
        </Button>
      </div>
    </Card>
  );
};
