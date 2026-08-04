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

   purchaseDate?: string;      // date string (e.g., "2025-01-01")
  purchaseAmount?: number;        // amount in rupees
  emiStartDate?: string;  
  rcDate?: string;
  

  status: "Active" | "Inactive";
};