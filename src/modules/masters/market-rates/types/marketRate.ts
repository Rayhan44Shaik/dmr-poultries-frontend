export type MarketRate = {
  id: number;
  businessDate: string;
  vij: number;
  gun: number;
  rp: number;
  sneha: number;
  vencobRate: number;
  vencobVii: number;
  vencobGun: number;
  associationVii: number;
  c17: number;
  c15: number;
  c13: number;
  c12: number;
  c10: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type MarketRateInput = {
  businessDate: string;
  vij: number;
  gun: number;
  rp: number;
  sneha: number;
  vencobRate: number;
  vencobVii: number;
  vencobGun: number;
  associationVii: number;
  c17: number;
  c15: number;
  c13: number;
  c12: number;
  c10: number;
};