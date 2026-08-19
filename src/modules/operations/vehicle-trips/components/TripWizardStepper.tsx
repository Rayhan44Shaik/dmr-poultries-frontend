import { Fragment } from "react";
import { Check, Play, MapPin, Package, Truck, Wallet } from "lucide-react";
import { TRIP_STEP_KEYS } from "../../../../shared/trip/workflow";

export type TripWizardCompletedMask = {
  start: boolean;
  farm: boolean;
  pickup: boolean;
  delivery: boolean;
  end?: boolean;
};

interface Props {
  /** Index of the currently selected / viewed step. */
  currentStep: number;
  steps: string[];
  completedMask: TripWizardCompletedMask;
  onStepClick?: (index: number) => void;
}

const STEP_ICONS = [Play, MapPin, Package, Truck, Wallet];

export function resolveStepperCompletion(completedMask: TripWizardCompletedMask): boolean[] {
  return TRIP_STEP_KEYS.map((key) => {
    if (key === "expenses") return Boolean(completedMask.end);
    const maskKey = (key === "deliveries" ? "delivery" : key) as keyof TripWizardCompletedMask;
    return Boolean(completedMask[maskKey]);
  });
}

/**
 * Five-step trip wizard.
 * A step is selectable only when it has already been submitted or it is the
 * single next step in sequence. Future steps remain locked until the previous
 * step is submitted, so Step 2 cannot be opened before Step 1, etc.
 */
export default function TripWizardStepper({ currentStep, steps, completedMask, onStepClick }: Props) {
  const stepStatus = resolveStepperCompletion(completedMask);

  return (
    <div className="flex items-center gap-1 md:gap-1.5 overflow-x-auto scrollbar-none py-1.5 px-1 select-none">
      {steps.map((label, index) => {
        const isCompleted = stepStatus[index];
        const isActive = index === currentStep;
        const isNextStep = index === currentStep && !isCompleted;
        const isStepAvailable = isCompleted || isNextStep;
        const isClickable = Boolean(onStepClick) && isStepAvailable;
        const Icon = STEP_ICONS[index % STEP_ICONS.length];

        const pillClasses = `
          inline-flex items-center gap-1.5 rounded-full border px-2.5 md:px-3 py-1.5 text-[11px] font-bold whitespace-nowrap shrink-0
          transition-all duration-300 ease-out
          focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40
          ${isClickable ? "cursor-pointer active:scale-95" : "cursor-not-allowed opacity-65"}
          ${
            isActive
              ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white border-transparent shadow-md shadow-emerald-500/25 scale-105"
              : isCompleted
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                : "bg-white text-slate-400 border-slate-200"
          }
        `.trim();

        const chipClasses = `
          grid place-items-center w-[18px] h-[18px] rounded-full text-[9px] font-extrabold shrink-0
          transition-all duration-300
          ${
            isActive
              ? "bg-white/25 text-white"
              : isCompleted
                ? "bg-emerald-600 text-white"
                : "bg-slate-100 text-slate-400"
          }
        `;

        const content = (
          <>
            <span className={chipClasses} aria-hidden>
              {isCompleted ? <Check size={11} strokeWidth={3.5} /> : index + 1}
            </span>
            <Icon size={13} strokeWidth={2.5} aria-hidden />
            <span>{label}</span>
            {isCompleted && (
              <span
                className={`hidden md:inline text-[9px] font-semibold ${
                  isActive ? "text-emerald-50/90" : "text-emerald-500"
                }`}
              >
                Submitted
              </span>
            )}
          </>
        );

        return (
          <Fragment key={`${index}-${label}`}>
            {isClickable ? (
              <button
                type="button"
                onClick={() => onStepClick?.(index)}
                className={pillClasses}
                aria-current={isActive ? "step" : undefined}
                aria-label={`Step ${index + 1}: ${label}`}
              >
                {content}
              </button>
            ) : (
              <div
                className={pillClasses}
                aria-disabled="true"
                title={isCompleted ? undefined : "Submit the previous step first"}
              >
                {content}
              </div>
            )}
            {index < steps.length - 1 && (
              <div
                aria-hidden
                className={`h-[2px] flex-1 min-w-3 rounded-full transition-colors duration-500 ${
                  stepStatus[index] ? "bg-emerald-400/70" : "bg-slate-200"
                }`}
              />
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
