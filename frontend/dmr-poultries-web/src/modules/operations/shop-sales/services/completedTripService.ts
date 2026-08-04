import type { Trip } from '../../vehicle-trips/types/trip.ts';
import type { ShopSale } from "../types/shopSale";

const TRIP_STORAGE = "vehicleTrips";
const SHOPSALE_STORAGE = "shopSales";

function getTrips(): Trip[] {
  const json = localStorage.getItem(TRIP_STORAGE);
  if (!json) return [];
  return JSON.parse(json);
}

function saveTrips(trips: Trip[]) {
  localStorage.setItem(TRIP_STORAGE, JSON.stringify(trips));
}

function getShopSales(): ShopSale[] {
  const json = localStorage.getItem(SHOPSALE_STORAGE);
  if (!json) return [];
  return JSON.parse(json);
}

function saveShopSales(sales: ShopSale[]) {
  localStorage.setItem(SHOPSALE_STORAGE, JSON.stringify(sales));
}

function getAllTrips(): Trip[] {
  return getTrips();
}

function getCompletedTrips(): Trip[] {
  return getTrips().filter(
    trip => trip.status === "Completed" && !trip.rateCompleted
  );
}

function getTrip(id: number): Trip | undefined {
  return getTrips().find(trip => trip.id === id);
}

function updateTrip(updatedTrip: Trip): boolean {
  const trips = getTrips();
  const index = trips.findIndex(t => t.id === updatedTrip.id);
  if (index === -1) return false;
  trips[index] = updatedTrip;
  saveTrips(trips);
  return true;
}

function saveRates(tripId: number, deliveries: Trip["deliveries"]): boolean {
  const trips = getTrips();
  const tripIndex = trips.findIndex(x => x.id === tripId);
  if (tripIndex === -1) return false;

  trips[tripIndex].deliveries = deliveries;
  trips[tripIndex].rateCompleted = true;
  trips[tripIndex].updatedAt = new Date().toISOString();
  saveTrips(trips);

  let sales = getShopSales();
  sales = sales.filter(x => x.tripId !== String(tripId));

  deliveries.forEach((delivery, index) => {
    const rate = (delivery as any).rate ?? 0;
    const amount = Number((delivery.weight * rate).toFixed(2));
    sales.push({
      id: `${tripId}-${index}`,
      tripId: String(tripId),
      tripNo: trips[tripIndex].tripNo,
      tripDate: trips[tripIndex].tripDate,
      shopId: String(delivery.shopId),
      shopName: delivery.shopName,
      birdType: delivery.birdType,
      totalBirds: delivery.birds,
      totalWeight: delivery.weight,
      rate,
      amount,
      remark: delivery.remarks,
      status: "Completed"
    });
  });

  saveShopSales(sales);
  return true;
}

function unlockTrip(tripId: number): boolean {
  const trips = getTrips();
  const index = trips.findIndex(x => x.id === tripId);
  if (index === -1) return false;

  trips[index].rateCompleted = false;
  trips[index].updatedAt = new Date().toISOString();
  saveTrips(trips);

  const sales = getShopSales().filter(x => x.tripId !== String(tripId));
  saveShopSales(sales);
  return true;
}

export const completedTripService = {
  getAllTrips,
  getCompletedTrips,
  getTrip,
  saveRates,
  unlockTrip,
  updateTrip,
};