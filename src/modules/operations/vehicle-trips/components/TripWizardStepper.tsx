import { Fragment } from "react";
import { Check, Lock, Play, MapPin, Package, Truck, Wallet } from "lucide-react";
import { TRIP_STEP_KEYS } from "../../../../shared/trip/workflow";
import { useI18n } from "../../../../i18n";
import {
  resolveStepperCompletion,
  type TripWizardCompletedMask,
} from "./stepperCompletion";

interface Props {
  /** Index of the currently selected / viewed step. */
  currentStep: number;
  steps: string[];
  completedMask: TripWizardCompletedMask;
  onStepClick?: (index: number) => void;
  /**
   * Steps at these indexes are LOCKED (a previous step has not been
   * submitted yet). Locked steps can never become the active step; clicking
   * one forwards to `onLockedStepClick` so the parent can redirect to the
   * correct next incomplete step and explain why the step is locked.
   */
  lockedSteps?: boolean[];
  onLockedStepClick?: (index: number) => void;
}

const STEP_ICONS = [Play, MapPin, Package, Truck, Wallet];

/**
 * Read-only 5-step trip wizard for the Trip View.
 * Every step is selectable; the selected step is strongly highlighted with a
 * smooth transition while completed steps keep their ✓ indication.
 */
export default function TripWizardStepper({
  currentStep,
  steps,
  completedMask,
  onStepClick,
  lockedSteps = [],
  onLockedStepClick,
}: Props) {
  const { t } = useI18n();
  const stepStatus = resolveStepperCompletion(completedMask);

  return (
    <nav
      className="flex items-center gap-1 md:gap-1.5 overflow-x-auto scrollbar-none py-1.5 px-1 select-none"
      aria-label={t("ops.trip.wizard_steps")}
    >
      {steps.map((label, index) => {
        const stepKey = TRIP_STEP_KEYS[index] ?? String(index);
        const stepLabel = t(`ops.trip.step.${stepKey}`);
        const isCompleted = stepStatus[index];
        const isActive = index === currentStep;
        const isLocked = Boolean(lockedSteps[index]);
        const isClickable = !!onStepClick && !isLocked;
        const Icon = STEP_ICONS[index % STEP_ICONS.length];

        const pillClasses = `
          inline-flex items-center gap-1.5 rounded-full border px-2.5 md:px-3 py-1.5 text-[11px] font-bold whitespace-nowrap shrink-0
          transition-all duration-300 ease-out
          focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40
          ${isClickable ? "cursor-pointer active:scale-95" : "cursor-default"}
          ${
            isActive
              ? "bg-emerald-600 text-white border-transparent shadow-sm shadow-emerald-600/25 scale-105"
              : isLocked
                ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-80"
                : isCompleted
                  ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                  : "bg-white text-slate-500 border-slate-200 hover:border-emerald-200 hover:text-emerald-600"
          }
        `.trim();

        const chipClasses = `
          grid place-items-center w-[18px] h-[18px] rounded-full text-[9px] font-extrabold shrink-0
          transition-all duration-300
          ${
            isActive
              ? "bg-white/20 text-white ring-1 ring-white/30"
              : isLocked
                ? "bg-slate-200 text-slate-400"
                : isCompleted
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-500"
          }
        `;

        const content = (
          <>
            <span className={chipClasses} aria-hidden>
              {isCompleted ? <Check size={11} strokeWidth={3.5} /> : index + 1}
            </span>
            {isLocked ? (
              <Lock size={11} strokeWidth={2.5} aria-hidden />
            ) : (
              <Icon size={13} strokeWidth={2.5} aria-hidden />
            )}
            <span>{stepLabel}</span>
            {isCompleted && (
              <span
                className={`hidden md:inline text-[9px] font-semibold ${
                  isActive ? "text-emerald-50/90" : "text-emerald-600"
                }`}
              >
                {t("ops.trip.submitted")}
              </span>
            )}
          </>
        );

        return (
          <Fragment key={`${index}-${label}`}>
            {isClickable ? (
              <button
                type="button"
                onClick={() => onStepClick(index)}
                className={pillClasses}
                aria-current={isActive ? "step" : undefined}
                aria-label={t("ops.trip.step_aria", { step: index + 1, label: stepLabel })}
              >
                {content}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  // A locked step must never become the active step. Only the
                  // dedicated lock handler (parent redirects to the next
                  // incomplete step) may fire; onStepClick is never reached.
                  if (isLocked) {
                    onLockedStepClick?.(index);
                    return;
                  }
                  onStepClick?.(index);
                }}
                disabled={!isLocked && !onStepClick}
                aria-disabled={isLocked || undefined}
                className={pillClasses}
                aria-current={isActive ? "step" : undefined}
                aria-label={t("ops.trip.step_aria", { step: index + 1, label: stepLabel }) + (isLocked ? ` (${t("ops.trip.locked")})` : "")}
              >
                {content}
              </button>
            )}
            {index < steps.length - 1 && (
              <div
                aria-hidden
                className={`h-[2px] flex-1 min-w-3 rounded-full transition-colors duration-500 ${
                  stepStatus[index] ? "bg-emerald-300" : "bg-slate-200"
                }`}
              />
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
