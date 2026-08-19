export type Shop = {
  id: number;
  shopNo: number;
  shopName: string;
  ownerName: string;
  phoneNumber: string;
  email: string;
  village: string;
  address?: string;
  status: "Active" | "Inactive";
  openingBalance: number;
  currentBalance?: number;
};