import type { Bank } from "../types/bank";

export const initialBanks: Bank[] = [
  {
    id: 1,
    bankNo: 1,
    bankName: "HDFC Bank",
    branch: "Tenali",
    accountNumber: "123456789012",
    ifscCode: "HDFC0001234",
    upiId: "dmr@hdfc",
    status: "Active",
  },
  {
    id: 2,
    bankNo: 2,
    bankName: "Union Bank",
    branch: "Guntur",
    accountNumber: "456789123456",
    ifscCode: "UBIN0534123",
    upiId: "dmr@union",
    status: "Active",
  },
];