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
  

  /**
   * Master-record status. "Maintenance" represents an explicit
   * active-maintenance state set on the vehicle master (fleet overview
   * treats it as the only maintenance-status source); the current
   * PostgreSQL enum stores 'Active'/'Inactive'.
   */
  status: "Active" | "Inactive" | "Maintenance";
};