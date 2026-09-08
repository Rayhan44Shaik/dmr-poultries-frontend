// Fictional Vehicle Master responses for the opt-in demo backend only.
// Never imported by the frontend or written to PostgreSQL / browser storage.
// Dates follow the current month so the preview always has pending, completed,
// newly started, nearly finished and month-end schedules to review.

export function buildSampleEmiVehicles(asOf = new Date()) {
  const monthStart = (monthsAgo) => {
    const date = new Date(asOf.getFullYear(), asOf.getMonth() - monthsAgo, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
  };

  const examples = [
    // Keep the first three IDs / registrations used by the existing Orders demo.
    { id: 1, vehicleNumber: "TS 09 AB 1234", vehicleType: "Truck", noOfBoxes: 120, purchaseAmount: 1800000, totalEMIs: 36, emiDay: 5, monthsAgo: 14 },
    { id: 2, vehicleNumber: "TS 09 CD 5678", vehicleType: "Truck", noOfBoxes: 80, purchaseAmount: 1200000, totalEMIs: 24, emiDay: 10, monthsAgo: 27 },
    { id: 3, vehicleNumber: "TS 09 EF 9012", vehicleType: "Lorry", noOfBoxes: 100, purchaseAmount: 2640000, totalEMIs: 48, emiDay: 15, monthsAgo: 8 },
    { id: 4, vehicleNumber: "AP 16 TC 4101", vehicleType: "Lorry", noOfBoxes: 160, purchaseAmount: 3300000, totalEMIs: 60, emiDay: 10, monthsAgo: 30 },
    { id: 5, vehicleNumber: "AP 16 TD 4202", vehicleType: "Truck", noOfBoxes: 60, purchaseAmount: 960000, totalEMIs: 24, emiDay: 7, monthsAgo: 25 },
    { id: 6, vehicleNumber: "AP 39 UA 4303", vehicleType: "Truck", noOfBoxes: 90, purchaseAmount: 1512000, totalEMIs: 36, emiDay: 20, monthsAgo: 0 },
    { id: 7, vehicleNumber: "AP 16 TE 4404", vehicleType: "Lorry", noOfBoxes: 120, purchaseAmount: 2160000, totalEMIs: 36, emiDay: 12, monthsAgo: 34 },
    { id: 8, vehicleNumber: "AP 39 UB 4505", vehicleType: "Lorry", noOfBoxes: 140, purchaseAmount: 2880000, totalEMIs: 48, emiDay: 31, monthsAgo: 20 },
    { id: 9, vehicleNumber: "AP 16 TF 4606", vehicleType: "Truck", noOfBoxes: 50, purchaseAmount: 780000, totalEMIs: 12, emiDay: 5, monthsAgo: 14, status: "Inactive" },
    { id: 10, vehicleNumber: "AP 39 UC 4707", vehicleType: "Truck", noOfBoxes: 110, purchaseAmount: 1920000, totalEMIs: 48, emiDay: 18, monthsAgo: 4 },
    { id: 11, vehicleNumber: "AP 16 TG 4808", vehicleType: "Lorry", noOfBoxes: 180, purchaseAmount: 3600000, totalEMIs: 60, emiDay: 25, monthsAgo: 10 },
    { id: 12, vehicleNumber: "AP 39 UD 4909", vehicleType: "Truck", noOfBoxes: 70, purchaseAmount: 1080000, totalEMIs: 24, emiDay: 10, monthsAgo: 6 },
  ];

  return examples.map(({ monthsAgo, ...vehicle }) => ({
    vehicleNo: vehicle.id,
    birdCapacity: vehicle.noOfBoxes * 10,
    capacityKg: vehicle.noOfBoxes * 25,
    trackingId: "",
    fastagBank: "",
    engineNumber: "",
    chassisNumber: "",
    insuranceExpiry: "",
    permitExpiry: "",
    fitnessExpiry: "",
    rcDate: "",
    purchaseDate: monthStart(monthsAgo + 1),
    emiStartDate: monthStart(monthsAgo),
    status: "Active",
    ...vehicle,
    _mock: true,
  }));
}
