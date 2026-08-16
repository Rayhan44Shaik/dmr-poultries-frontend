export type Shop = {
  id: number;
  shopNo: number;
  shopName: string;
  ownerName: string;
  phoneNumber: string;
  village: string;
  address?: string;
  status: "Active" | "Inactive";
  currentBalance?: number;
};