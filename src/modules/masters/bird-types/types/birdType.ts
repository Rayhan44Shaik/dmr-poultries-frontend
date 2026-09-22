export type BirdType = {
  id: number;
  birdTypeNo: number;

  birdType: string;

  averageWeight: number;

  description: string;

  category: "Bird" | "Fuel Bunk";
  ownerName: string;
  mobileNumber: string;
  address: string;
  latitude: number | null;
  longitude: number | null;

  status: "Active" | "Inactive";
};
