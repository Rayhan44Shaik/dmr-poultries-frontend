export type Shop = {
  id: number;
  shopNo: number;
  shopNumber: string;
  shopName: string;
  ownerName: string;
  phoneNumber: string;
  secondaryPhoneNumber?: string;
  email: string;
  city: string;
  address: string;
  latitude?: number;
  longitude?: number;
  paperRate: number;
  associationType: string;
  status: "Active" | "Inactive";
  openingBalance: number;
  currentBalance?: number;
};