export type Shop = {
  id: number;
  shopNo: number;
  shopNumber: string;
  shopName: string;
  ownerName: string;
  phoneNumber: string;
  secondaryPhoneNumber?: string;
  /** Dedicated WhatsApp number from the shop master redesign; falls back to phone. */
  whatsappNumber?: string;
  email: string;
  city: string;
  /** Optional village / locality from the shop master redesign. */
  village?: string;
  address: string;
  latitude?: number;
  longitude?: number;
  paperRate: number;
  associationType: string;
  status: "Active" | "Inactive";
  openingBalance: number;
  currentBalance?: number;
};