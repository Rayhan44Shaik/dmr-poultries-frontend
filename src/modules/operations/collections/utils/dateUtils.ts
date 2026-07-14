// src/modules/operations/collections/utils/dateUtils.ts
export function getCurrentWeekRange() {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday, 1 = Monday ...
  const diff = (day === 0 ? 6 : day - 1); // Monday offset
  const monday = new Date(now);
  monday.setDate(now.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday };
}

export function formatDateRange(monday: Date, sunday: Date) {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  return `${fmt(monday)} to ${fmt(sunday)}`;
}