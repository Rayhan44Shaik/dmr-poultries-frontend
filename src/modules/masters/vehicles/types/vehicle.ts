export type Vehicle = {
  id: number;
  vehicleNo: number;

  vehicleNumber: string;

  vehicleType: string;

  noOfBoxes: number;

  birdCapacity: number;

  capacityKg: number;

  trackingId: string;

  fastagBank: string;

  engineNumber: string;

  chassisNumber: string;

  insuranceExpiry: string;

  permitExpiry: string;

  fitnessExpiry: string;

  status: "Active" | "Inactive";
};