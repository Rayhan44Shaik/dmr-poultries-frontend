import { useLayoutEffect, useRef, useState } from "react";
import DatePicker, {
  type CalendarDropdownProps,
  type DatePickerProps,
} from "../../../components/common/DatePicker";
import MasterDropdown from "./MasterDropdown";

function MasterCalendarDropdown({
  value,
  options,
  onChange,
  "aria-label": label = "",
}: CalendarDropdownProps) {
  const isYear = options.length > 12;
  return (
    <MasterDropdown
      label={label}
      hideLabel
      value={String(value)}
      options={options.map((option) => ({
        ...option,
        value: String(option.value),
      }))}
      onChange={(next) => onChange({ target: { value: next } })}
      searchable={isYear}
      portal={false}
      className={isYear ? "w-20" : "w-28"}
    />
  );
}

/** Keep shared date validation; only master calendar chrome/placement opts in. */
export default function MasterDatePicker(props: DatePickerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<"top" | "bottom">(
    props.placement ?? "bottom",
  );

  const handleOpenChange = (next: boolean) => {
    if (next) {
      const control = ref.current?.getBoundingClientRect();
      const body = ref.current
        ?.closest("[data-master-form-body]")
        ?.getBoundingClientRect();
      if (control && body)
        setPlacement(
          props.placement ??
            (control.top - body.top > body.bottom - control.bottom
              ? "top"
              : "bottom"),
        );
    }
    setOpen(next);
    props.onOpenChange?.(next);
  };

  useLayoutEffect(() => {
    if (!open) return;
    const body = ref.current?.closest<HTMLElement>("[data-master-form-body]");
    const popup = ref.current?.querySelector<HTMLElement>("[role=dialog]");
    if (!body || !popup) return;
    const bounds = body.getBoundingClientRect();
    const rect = popup.getBoundingClientRect();
    // Reveal the calendar within the form's own scroller, never move the page.
    if (rect.bottom > bounds.bottom - 8)
      body.scrollTop += rect.bottom - bounds.bottom + 8;
    else if (rect.top < bounds.top + 8)
      body.scrollTop -= bounds.top + 8 - rect.top;
  }, [open, placement]);

  return (
    <div ref={ref} data-master-calendar>
      <DatePicker
        {...props}
        dropdownComponent={MasterCalendarDropdown}
        placement={placement}
        onOpenChange={handleOpenChange}
        className={`w-full [&_input]:h-9! [&_input]:rounded-xl! [&_input]:bg-white! ${props.className ?? ""}`}
        popupClassName={`w-80! max-w-[calc(100vw-4rem)] ${props.popupClassName ?? ""}`}
      />
    </div>
  );
}
