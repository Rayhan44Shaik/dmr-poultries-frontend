import React from "react";
import { Check } from "lucide-react";

interface Props {
  currentStep: number;
  steps: string[];
  completedMask: { start: boolean; farm: boolean; pickup: boolean; delivery: boolean };
  onStepClick?: (index: number) => void;
}

export default function TripWizardStepper({ currentStep, steps, completedMask, onStepClick }: Props) {
  // Map the masks to step indices (Logic untouched)
  const stepStatus = [0, 1, 2, 3, 4].map((index) => {
    const stepNames = ["start", "farm", "pickup", "delivery", "end"];
    const key = stepNames[index];
    if (key === "end") return false; 
    return completedMask[key as keyof typeof completedMask];
  });

  return (
    <div className="relative w-full flex justify-between items-start md:items-center mb-8 px-1 md:px-4 pt-4 md:pt-2">
      {steps.map((label, index) => {
        const isCompleted = stepStatus[index];
        const isActive = !isCompleted && index === currentStep;
        const isClickable = !!onStepClick && (isCompleted || (!isCompleted && index === currentStep));

        // 🔹 Extracted shared classes for clean, DRY code and mobile-first responsiveness
        const circleClasses = `
          relative z-10 rounded-full flex items-center justify-center font-bold transition-all duration-300 border-2 shadow-sm
          w-8 h-8 text-xs md:w-10 md:h-10 md:text-sm
          ${isCompleted ? "bg-blue-600 border-blue-600 text-white" : isActive ? "bg-white border-blue-600 text-blue-600 ring-4 ring-blue-50" : "bg-slate-100 border-slate-300 text-slate-400"}
          ${isClickable ? "cursor-pointer hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2" : ""}
        `.trim();

        return (
          <div key={index} className="flex flex-col items-center relative z-10 w-full group">
            {/* Step Connector Line */}
            {index < steps.length - 1 && (
              <div
                // Responsive top positioning to align perfectly with shrinking/growing circles
                className={`absolute top-4 md:top-5 left-[50%] w-full h-[2px] -z-10 transition-colors duration-500 ${
                  isCompleted || (index < currentStep && stepStatus[index]) ? "bg-blue-600" : "bg-slate-200"
                }`}
              />
            )}

            {/* Circle Wrapper (Clickable vs Non-Clickable) */}
            {isClickable ? (
              <button
                onClick={() => onStepClick(index)}
                className={circleClasses}
                aria-current={isActive ? "step" : undefined}
                aria-label={`Step ${index + 1}: ${label}`}
              >
                {isCompleted ? <Check className="w-4 h-4 md:w-5 md:h-5" strokeWidth={3} /> : index + 1}
              </button>
            ) : (
              <div className={circleClasses}>
                {isCompleted ? <Check className="w-4 h-4 md:w-5 md:h-5" strokeWidth={3} /> : index + 1}
              </div>
            )}

            {/* Label */}
            <div className="mt-2 md:mt-3 text-[10px] md:text-[11px] lg:text-xs font-bold tracking-wide text-center px-1">
              <span className={`block transition-colors duration-300 ${isCompleted ? "text-blue-700" : isActive ? "text-slate-900" : "text-slate-400"}`}>
                {label}
              </span>
              {/* Hide "Completed" on mobile to prevent overlapping text, show on tablets/laptops */}
              {isCompleted && (
                <span className="hidden md:block text-[9px] md:text-[10px] text-emerald-600 mt-0.5">
                  Completed
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}