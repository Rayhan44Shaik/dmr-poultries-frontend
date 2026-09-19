/**
 * Windows / Vite shim.
 * Extensionless imports resolve `.ts` before `.tsx`. A prior helper file at this
 * basename left browsers and Vite's module graph requesting
 * `TripWizardStepper.ts` — re-export the React component so that URL always
 * has a default export.
 */
export { default } from "./TripWizardStepper.tsx";
