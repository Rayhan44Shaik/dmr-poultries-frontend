/**
 * Tiny class-name combiner used by the shared UI kit.
 *
 * Deliberately minimal (no dependency, no specificity resolution): it joins
 * truthy values with a single space and drops `false`/`null`/`undefined`/`""`.
 * That is all the design system needs, and it removes the hand-written
 * template-literal concatenation that produced stray double spaces and
 * `undefined` class names across pages.
 *
 * Later values win only in the sense that they come last in the string; for
 * conflicting Tailwind utilities the one defined last in the generated CSS
 * still decides, so prefer the semantic tokens in `shared/ui/uiTokens.ts`
 * over ad-hoc overrides.
 */

export type ClassValue =
  | string
  | number
  | false
  | null
  | undefined
  | ClassValue[]
  | Record<string, boolean | null | undefined>;

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];

  const walk = (value: ClassValue): void => {
    if (!value && value !== 0) return;

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) out.push(trimmed);
      return;
    }

    if (typeof value === "number") {
      out.push(String(value));
      return;
    }

    if (Array.isArray(value)) {
      for (const entry of value) walk(entry);
      return;
    }

    if (typeof value === "object") {
      for (const [key, active] of Object.entries(value)) {
        if (active) {
          const trimmed = key.trim();
          if (trimmed) out.push(trimmed);
        }
      }
    }
  };

  for (const input of inputs) walk(input);
  return out.join(" ");
}

export default cn;
