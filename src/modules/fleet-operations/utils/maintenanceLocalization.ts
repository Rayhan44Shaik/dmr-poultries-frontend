// src/modules/fleet-operations/utils/maintenanceLocalization.ts
//
// Telugu localization for maintenance domain values — the same approach as the
// Trip List's tripViewLocalization: display strings map word-for-word while
// the stored English values remain the database truth. Numbers stay numeric.

import type { Language } from "../../../i18n";
import { localizeTripViewText } from "../../operations/vehicle-trips/utils/tripViewLocalization";

/** Full maintenance-type phrases (values of MaintenanceTypeEnum). */
const PHRASE_TE: Record<string, string> = {
  "Engine Oil Change": "ఇంజిన్ ఆయిల్ మార్పిడి",
  "Oil Filter Replacement": "ఆయిల్ ఫిల్టర్ మార్పిడి",
  "Air Filter Replacement": "ఎయిర్ ఫిల్టర్ మార్పిడి",
  "Brake Service": "బ్రేక్ సర్వీస్",
  "Clutch Plate Replacement": "క్లచ్ ప్లేట్ మార్పిడి",
  "Gear Oil Change": "గియర్ ఆయిల్ మార్పిడి",
  "Coolant Replacement": "కూలెంట్ మార్పిడి",
  "Battery Replacement": "బ్యాటరీ మార్పిడి",
  "Suspension Repair": "సస్పెన్షన్ రిపేర్",
  "General Service": "సాధారణ సర్వీస్",
  "AC Service": "ఏసీ సర్వీస్",
  "Electrical Repair": "ఎలక్ట్రికల్ రిపేర్",
  "Engine Repair": "ఇంజిన్ రిపేర్",
  "Tyre Rotation": "టైర్ రొటేషన్",
  "Wheel Alignment": "వీల్ అలైన్‌మెంట్",
  "Wheel Balancing": "వీల్ బ్యాలెన్సింగ్",
  "Greasing": "గ్రీసింగ్",
  "Washing": "వాషింగ్",
  "Emergency Breakdown Repair": "అత్యవసర బ్రేక్‌డౌన్ రిపేర్",
  "Other Maintenance": "ఇతర మెయింటెనెన్స్",
  // Service types
  "Preventive": "నివారణ సర్వీస్",
  "Corrective": "సరిదిద్దే సర్వీస్",
};

/** Word map for garages / workshops beyond the trip list's own vocabulary. */
const WORD_TE: Record<string, string> = {
  Garage: "గ్యారేజ్",
  Motors: "మోటర్స్",
  Auto: "ఆటో",
  Works: "వర్క్స్",
  Truck: "ట్రక్",
  Care: "కేర్",
  Deccan: "డెక్కన్",
};

/** Localize a free maintenance-domain string (types, service types, garages). */
export function localizeMaintenanceText(
  value: string | null | undefined,
  language: Language
): string {
  const raw = String(value ?? "").trim();
  if (!raw || language !== "te") return raw;
  if (PHRASE_TE[raw]) return PHRASE_TE[raw];
  // Word-by-word fallback for garages / multi-word leftovers; unknown words
  // pass through untouched, digits stay digits.
  const translated = raw
    .split(/\s+/)
    .map((word) => WORD_TE[word] ?? word)
    .join(" ");
  return translated;
}

/** Driver / mechanic / people names — reuse the trip list's name vocabulary. */
export function localizeMaintenanceName(
  value: string | null | undefined,
  language: Language
): string {
  if (!value || language !== "te") return String(value ?? "");
  return localizeTripViewText(String(value), language);
}
