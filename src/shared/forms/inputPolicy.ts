const CASE_SENSITIVE_TYPES = new Set(["password", "email", "url", "file"]);

export function shouldUppercaseInput(target: EventTarget | null): target is HTMLInputElement | HTMLTextAreaElement {
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) return false;
  if (target.dataset.preserveCase === "true") return false;
  if (target instanceof HTMLInputElement) {
    if (CASE_SENSITIVE_TYPES.has(target.type)) return false;
    // Password reveal controls temporarily switch their input to type="text".
    // Keep detecting them as case-sensitive so showing a password can never
    // uppercase it while the employee types.
    const semanticName = `${target.name} ${target.id} ${target.autocomplete}`.toLowerCase();
    if (semanticName.includes("password")) return false;
  }
  return target instanceof HTMLTextAreaElement || target.type === "text" || target.type === "search";
}

export function uppercaseEditableValue(target: HTMLInputElement | HTMLTextAreaElement): void {
  const upper = target.value.toLocaleUpperCase("en-IN");
  if (upper === target.value) return;
  const start = target.selectionStart;
  const end = target.selectionEnd;
  // Use the native prototype setter. React installs a value tracker on the
  // element instance; bypassing that tracker lets its normal input handler see
  // the uppercase value as the user's actual change and update controlled state.
  const prototype = target instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype
    : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
  if (setter) setter.call(target, upper);
  else target.value = upper;
  if (start != null && end != null) target.setSelectionRange(start, end);
}

export function installProjectInputPolicy(doc: Document = document): () => void {
  const disableAutofill = (root: ParentNode) => {
    root.querySelectorAll<HTMLInputElement>("input").forEach((input) => {
      input.autocomplete = input.type === "password" ? "new-password" : "off";
      input.setAttribute("data-1p-ignore", "true");
      input.setAttribute("data-lpignore", "true");
    });
    root.querySelectorAll<HTMLFormElement>("form").forEach((form) => form.setAttribute("autocomplete", "off"));
  };
  disableAutofill(doc);
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node instanceof Element) {
          if (node instanceof HTMLInputElement) disableAutofill(node.parentNode ?? node);
          else disableAutofill(node);
        }
      }
    }
  });
  observer.observe(doc.documentElement, { childList: true, subtree: true });
  const onInput = (event: Event) => {
    if ((event as InputEvent).isComposing || !shouldUppercaseInput(event.target)) return;
    uppercaseEditableValue(event.target);
  };
  const onWheel = (event: WheelEvent) => {
    const target = event.target;
    if (target instanceof HTMLInputElement && target.type === "number" && doc.activeElement === target) {
      // Removing focus before the browser's default action prevents a value
      // nudge while still allowing the wheel to scroll the page normally.
      target.blur();
    }
  };
  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target;
    if (
      target instanceof HTMLInputElement &&
      target.type === "number" &&
      (event.key === "ArrowUp" || event.key === "ArrowDown")
    ) {
      event.preventDefault();
    }
  };

  doc.addEventListener("input", onInput, true);
  doc.addEventListener("wheel", onWheel, { capture: true, passive: true });
  doc.addEventListener("keydown", onKeyDown, true);
  return () => {
    observer.disconnect();
    doc.removeEventListener("input", onInput, true);
    doc.removeEventListener("wheel", onWheel, true);
    doc.removeEventListener("keydown", onKeyDown, true);
  };
}
