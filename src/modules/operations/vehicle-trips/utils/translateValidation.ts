// src/modules/operations/vehicle-trips/utils/translateValidation.ts
//
// The shared validator (src/shared/trip/validation.ts) returns plain-English
// messages. This helper maps those messages onto i18n keys at DISPLAY time so
// every wizard step shows its validation errors in the active language
// (Telugu included) without changing the shared validator or its tests.
// Unknown messages fall through untouched.

type TFunc = (key: string, params?: Record<string, string | number>) => string;

/** Exact-match map for fixed validator messages. */
const FIXED: Record<string, string> = {
  // validateStartStep (Step 1)
  "Trip Date is required.": "ops.trip.validate.trip_date_required",
  "Please select a Vehicle.": "ops.trip.validate.select_vehicle",
  "Please select a Driver.": "ops.trip.validate.select_driver",
  "Please select a Supervisor.": "ops.trip.validate.select_supervisor",
  "Please add at least one Helper.": "ops.trip.validate.add_helper",
  "Please add at least one Loader.": "ops.trip.validate.add_loader",
  "Valid Opening Meter reading is required.": "ops.trip.validate.opening_meter_required",
  "Opening Meter must be a valid non-negative number.": "ops.trip.validate.opening_meter_non_negative",
  "Valid Advance amount is required.": "ops.trip.validate.advance_required",
  "Advance must be a valid non-negative number.": "ops.trip.validate.advance_non_negative",

  // validateFarmStep (Step 2)
  "Please select a Farm.": "ops.trip.validate.select_farm",
  "Please select a Bird Type.": "ops.trip.validate.select_bird_type",
  "Farm address is required.": "ops.trip.validate.farm_address_required",
  "Please capture the farm GPS location.": "ops.trip.validate.gps_required",
  "Valid Farm Meter reading is required.": "ops.trip.validate.farm_meter_required",
  "Tolls cannot be negative.": "ops.trip.validate.tolls_non_negative",
  "Please enter a valid Average Bird Weight.": "ops.trip.validate.avg_bird_weight_required",

  // validatePickupStep (Step 3)
  "Please upload at least one pickup photo.": "ops.trip.validate.pickup_photo_required",
  "A maximum of 2 photos is allowed.": "ops.trip.max_2_photos",
  "At least one complete box is required.": "ops.trip.validate.box_required",
  "Box numbers must be sequential (1, 2, 3…).": "ops.trip.validate.box_sequential",

  // validateDeliveriesStep (Step 4)
  "Please add at least one shop delivery.": "ops.trip.validate.add_shop_delivery",
  "Each delivered shop must have a shop selected.": "ops.trip.validate.delivery_shop_required",
  "Each delivered shop must have a bird type selected.": "ops.trip.validate.delivery_bird_type_required",

  // validateEndStep (Step 5)
  "Valid End Meter reading is required.": "ops.trip.validate.end_meter_required",
  "Closing Meter cannot be less than the Destination Meter.": "ops.trip.validate.closing_lt_dest",
  "Please enter the number of tolls crossed on the delivery route (0 or greater).":
    "ops.trip.validate.delivery_tolls_required",

  // validateFinalTrip
  "KM Logic Error: Closing Meter must be greater than Destination Meter.":
    "ops.trip.validate.km_logic_error",
};

/** Parameterised validator messages, matched by regex. */
const PARAMETRIC: Array<{ pattern: RegExp; render: (t: TFunc, m: RegExpMatchArray) => string }> = [
  {
    // Farm meter (${destMeter} KM) must be strictly greater than the Step 1 starting meter (${startMeter} KM).
    pattern: /^Farm meter \(([\d.]+) KM\) must be strictly greater than the Step 1 starting meter \(([\d.]+) KM\)\.$/,
    render: (t, m) => t("ops.trip.validate.farm_meter_gt_start", { dest: m[1], start: m[2] }),
  },
  {
    // Box ${boxNo} birds must be a valid positive whole number.
    pattern: /^Box (\d+) birds must be a valid positive whole number\.$/,
    render: (t, m) => t("ops.trip.validate.box_birds_positive", { box: m[1] }),
  },
  {
    // Box ${boxNo} weight must be a valid positive number.
    pattern: /^Box (\d+) weight must be a valid positive number\.$/,
    render: (t, m) => t("ops.trip.validate.box_weight_positive", { box: m[1] }),
  },
  {
    // Vehicle box capacity exceeded. Maximum boxes for this vehicle: ${cap}.
    pattern: /^Vehicle box capacity exceeded\. Maximum boxes for this vehicle: (\d+)\.$/,
    render: (t, m) => t("ops.trip.validate.box_capacity_exceeded", { cap: m[1] }),
  },
  {
    // Bird count mismatch: Pickup (${pickup}) must equal Delivered (${delivered}) + Mortality (${mortality}) = ${total}.
    pattern:
      /^Bird count mismatch: Pickup \(([\d.]+)\) must equal Delivered \(([\d.]+)\) \+ Mortality \(([\d.]+)\) = ([\d.]+)\.$/,
    render: (t, m) =>
      t("ops.trip.validate.birds_mismatch", {
        pickup: m[1],
        delivered: m[2],
        mortality: m[3],
        total: m[4],
      }),
  },
  {
    // Weight mismatch: Delivered (…) + Mortality (…) + Loss (…) = … Kg but Farm weight is … Kg.
    pattern:
      /^Weight mismatch: Delivered \(([\d.]+) Kg\) \+ Mortality \(([\d.]+) Kg\) \+ Loss \(([\d.]+) Kg\) = ([\d.]+) Kg but Farm weight is ([\d.]+) Kg\.$/,
    render: (t, m) =>
      t("ops.trip.validate.weight_mismatch", {
        delivered: m[1],
        mortalityWeight: m[2],
        loss: m[3],
        expected: m[4],
        farm: m[5],
      }),
  },
  {
    // Bird Count Mismatch: Trip Birds (${total}) must equal Delivered (${delivered}) + Mortality (${mortality}) = ${expected}.
    pattern:
      /^Bird Count Mismatch: Trip Birds \(([\d.]+)\) must equal Delivered \(([\d.]+)\) \+ Mortality \(([\d.]+)\) = ([\d.]+)\.$/,
    render: (t, m) =>
      t("ops.trip.validate.final_birds_mismatch", {
        total: m[1],
        delivered: m[2],
        mortality: m[3],
        expected: m[4],
      }),
  },
  {
    // Weight Mismatch: Delivered Weight + Mortality Weight exceeds DC Weight by ${excess} Kg.
    pattern: /^Weight Mismatch: Delivered Weight \+ Mortality Weight exceeds DC Weight by ([\d.]+) Kg\.$/,
    render: (t, m) => t("ops.trip.validate.final_weight_mismatch", { excess: m[1] }),
  },
];

/** Translate one validator message into the active language (fallback: as-is). */
export function translateValidationMessage(t: TFunc, message: string): string {
  if (!message) return message;
  const fixed = FIXED[message];
  if (fixed) return t(fixed);
  for (const { pattern, render } of PARAMETRIC) {
    const match = message.match(pattern);
    if (match) return render(t, match);
  }
  return message;
}
