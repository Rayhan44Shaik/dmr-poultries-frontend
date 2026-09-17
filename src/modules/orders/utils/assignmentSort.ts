export type AssignmentSort = 'pending' | 'az' | 'za' | 'vehicle_trip' | 'sequence' | 'city_az' | 'city_za' | 'birds_asc' | 'birds_desc' | 'boxes_asc' | 'boxes_desc' | 'weight_asc' | 'weight_desc';

export interface AssignmentSortRow {
  name: string;
  city: string;
  birds: number;
  boxes: number;
  weight: number;
  sequence: number;
  vehicle: string;
  trip: string;
  assigned: boolean;
}

/** Same values as the visible table, sorted before pagination; stable ties. */
export function compareAssignmentRows(a: AssignmentSortRow, b: AssignmentSortRow, sort: AssignmentSort): number {
  const numeric = (value: number) => Number.isFinite(value) ? value : 0;
  let result = 0;
  switch (sort) {
    case 'az': result = a.name.localeCompare(b.name); break;
    case 'za': result = b.name.localeCompare(a.name); break;
    case 'city_az': result = a.city.localeCompare(b.city); break;
    case 'city_za': result = b.city.localeCompare(a.city); break;
    case 'birds_asc': result = numeric(a.birds) - numeric(b.birds); break;
    case 'birds_desc': result = numeric(b.birds) - numeric(a.birds); break;
    case 'boxes_asc': result = numeric(a.boxes) - numeric(b.boxes); break;
    case 'boxes_desc': result = numeric(b.boxes) - numeric(a.boxes); break;
    case 'weight_asc': result = numeric(a.weight) - numeric(b.weight); break;
    case 'weight_desc': result = numeric(b.weight) - numeric(a.weight); break;
    case 'vehicle_trip': result = a.vehicle.localeCompare(b.vehicle) || a.trip.localeCompare(b.trip); break;
    case 'pending': result = Number(a.assigned) - Number(b.assigned); break;
    case 'sequence': break;
  }
  return result || a.sequence - b.sequence;
}
