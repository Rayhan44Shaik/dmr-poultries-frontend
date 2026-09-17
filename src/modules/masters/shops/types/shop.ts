export type Shop = {
  id: number;
  shopNo: number;
  shopNumber: string;
  shopName: string;
  ownerName: string;
  phoneNumber: string;
  secondaryPhoneNumber?: string;
  /** Optional dedicated WhatsApp number; delivery WhatsApp falls back to phoneNumber. */
  whatsappNumber?: string;
  email: string;
  /** Shop locality. `city` is the shop-master-redesign name for the old `village`. */
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
