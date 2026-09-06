// Real Orders integration. Every collection, assignment and delivery is keyed
// by the existing Trip Entry trip.id. No Orders trip creation or sample source.
import { apiPost } from "../../../api";
import type { ShopDelivery, Trip } from "../../../shared/trip";
import { listTrips, loadTripById, mapApiTripToTrip, toStep4Payload, uniqueTripsById } from "../vehicle-trips/services/tripHeaderApiService";
import type { Shop } from "../../masters/shops/types/shop";
import { loadShops } from "../../masters/shops/services/shopService";
import { loadVehicles } from "../../masters/vehicles/services/vehicleService";
import { loadEmployees } from "../../masters/employees/services/employeeService";
import { getTripRevision } from "../../../shared/trip/tripSync";
import { addLocalDays, buildOrdersTrip, buildShopDeliveryRow, collectionTotals, computeOrdersProgress,
  deliveredRowBoxes, isCapturedRow, isEligibleVehicleTrip, isTrackingTrip, localToday, rowBoxes,
  rowsInSequence, toEligibleVehicle, uniqueShopRows } from "./ordersUtils";
import { isOrderPlanRemarks, parseOrderRef, type DayShopAssignment, type DayVehicleView,
  type OrderShopRow, type OrdersDayCollection, type OrdersFetch, type ShopOrderQuantities } from "./types";

const num=(v:unknown):number=>Number.isFinite(Number(v))?Number(v):0;
let ordersRequest: {revision:number; promise:Promise<OrdersFetch>} | null = null;

export function deriveOrdersData(input: Trip[], vehicleList: Array<{id:number;noOfBoxes?:number}>, now=new Date()): OrdersFetch {
  // Legacy vehicle-less ORD containers are not Trip Entry trips and never enter Orders.
  const trips=uniqueTripsById(input).filter(t=>t.id>0 && !t.deleted && t.vehicleId>0 && t.startStepSubmitted);
  const today=localToday(now);
  const collectionsByTripId: Record<number,OrdersDayCollection>={};
  const dayVehicleViews: Record<string,DayVehicleView[]>={};
  const quantitiesFor=(trip:Trip):ShopOrderQuantities=>new Map((trip.orderAssignments??[]).map(a=>{
    const collected=trip.ordersCollection?.find(r=>r.shopId===a.shopId);
    return [a.shopId,{boxes:num(collected?.boxNo),birds:num(collected?.birds),weight:num(collected?.weight),assignedBoxes:num(a.boxNo)}];
  }));
  for (const trip of trips) {
    const rows=toEditorRows(trip);
    const totals=collectionTotals(rows);
    const shops=new Map<number,DayShopAssignment|null>();
    let assignedShops=0,assignedBoxes=0;
    for (const row of rows) {
      const assignment=trip.orderAssignments?.find(a=>a.shopId===row.shopId);
      if (!assignment) { shops.set(row.shopId,null); continue; }
      const captures=trip.deliveries.filter(r=>r.shopId===row.shopId && isCapturedRow(r));
      const deliveredBoxes=captures.reduce((sum,r)=>sum+deliveredRowBoxes(r),0);
      assignedShops++; assignedBoxes+=rowBoxes(assignment);
      shops.set(row.shopId,{
        tripNo:trip.tripNo,vehicleNo:trip.vehicleNo,sequence:num(assignment.serialNo),boxes:rowBoxes(row),birds:num(row.birds),
        delivered:captures.length>0,deliveredBoxes,tripStatus:computeOrdersProgress(trip,quantitiesFor(trip)).status,
        avgBirdWeight:num(trip.avgBirdWeight),assignedBoxesTotal:rowBoxes(assignment),
        parts:[{tripId:trip.id,tripNo:trip.tripNo,vehicleNo:trip.vehicleNo,boxes:rowBoxes(assignment),delivered:captures.length>0,deliveredBoxes}]
      });
    }
    collectionsByTripId[trip.id]={trip,rows,...totals,finished:trip.collectionFinished===true,assignedShops,assignedBoxes,
      fullyAssigned:rows.length>0 && rows.every(r=>(shops.get(r.shopId)?.assignedBoxesTotal??0)>=rowBoxes(r)),shops};
    const assigned=trip.orderAssignments??[];
    if (assigned.length) {
      const viewRows=assigned.map(a=>({shopId:a.shopId,shopName:a.shopName,sequence:num(a.serialNo),boxes:rowBoxes(a),birds:num(a.birds),
        delivered:trip.deliveries.some(r=>r.shopId===a.shopId && isCapturedRow(r))}));
      (dayVehicleViews[trip.tripDate]??=[]).push({trip,rows:viewRows,boxes:viewRows.reduce((s,r)=>s+r.boxes,0),shops:viewRows.length,
        deliveredShops:viewRows.filter(r=>r.delivered).length,status:computeOrdersProgress(trip,quantitiesFor(trip)).status,
        allDelivered:viewRows.every(r=>r.delivered)});
    }
  }
  return {today,days:Array.from({length:7},(_,i)=>addLocalDays(today,i-6)),trips,collectionsByTripId,
    eligibleVehicles:trips.filter(t=>isEligibleVehicleTrip(t)||t.assignmentSubmitted===true).map(t=>toEligibleVehicle(t,vehicleList)),dayVehicleViews,
    tracking:trips.filter(isTrackingTrip).map(t=>buildOrdersTrip(t,quantitiesFor(t)))};
}

export function fetchOrdersData():Promise<OrdersFetch> {
  const revision=getTripRevision();
  if (ordersRequest?.revision===revision) return ordersRequest.promise;
  const promise=Promise.all([listTrips({full:true}),loadVehicles()]).then(([trips,vehicles])=>deriveOrdersData(trips,vehicles));
  ordersRequest={revision,promise};
  void promise.finally(()=>{if(ordersRequest?.promise===promise)ordersRequest=null;}).catch(()=>{});
  return promise;
}

function requireTripId(id:unknown):asserts id is number {
  if (typeof id!=="number" || !Number.isInteger(id) || id<=0) throw new Error("Select a real Trip Entry trip before saving Orders");
}

async function persistOrders(trip:Trip,rows:OrderShopRow[],ordersAction:"collection"|"assignment",mode:"save"|"submit",finishCollection=false):Promise<Trip> {
  requireTripId(trip.id);
  if (typeof trip.version!=="number") throw new Error("BLOCKED — BACKEND GAP: Trip version is missing");
  const {data}=await apiPost<Record<string,unknown>>(`/trips/${trip.id}/steps/deliveries`,{
    ...toStep4Payload({deliveries:uniqueShopRows(rows)}),ordersAction,mode,tripDate:trip.tripDate,expectedVersion:trip.version,finishCollection,
  });
  if (Number(data.id)!==trip.id) throw new Error("Backend returned a different trip identity");
  return mapApiTripToTrip(data);
}

export async function saveCollection(tripId:number|null,_tripNo:string|null,rows:OrderShopRow[],expectedVersion?:number):Promise<Trip> {
  requireTripId(tripId);
  const trip=await loadTripById(tripId);
  if (expectedVersion!=null && trip.version!==expectedVersion) throw new Error("Collection changed. Refresh before saving again.");
  return persistOrders(trip,rows,"collection","save");
}
export async function finishCollection(tripId:number|null,_tripNo:string|null,rows:OrderShopRow[],expectedVersion?:number):Promise<Trip> {
  requireTripId(tripId);
  const trip=await loadTripById(tripId);
  if (expectedVersion!=null && trip.version!==expectedVersion) throw new Error("Collection changed. Refresh before saving again.");
  return persistOrders(trip,rows,"collection","save",true);
}
export function toEditorRows(trip:Trip):OrderShopRow[] {
  return [...(trip.ordersCollection??[])].sort((a,b)=>num(a.serialNo)-num(b.serialNo)).map(r=>({...r,clientKey:r.clientKey||`order:${r.id}`}));
}

export type AssignmentGroup={orderTripId?:number;orderTripNo?:string;rows:OrderShopRow[]};
/** Retained pure merge utility for existing persisted-row consumers. Identity is an ID reference, not a display number. */
export function mergeOrderRowsInto(baseRows:ShopDelivery[],reference:string,assignedRows:ShopDelivery[]):ShopDelivery[] {
  const kept=baseRows.filter(r=>!isOrderPlanRemarks(r.remarks)||parseOrderRef(r.remarks)!==reference);
  return [...kept,...assignedRows].map((r,i)=>({...r,serialNo:i+1,id:0}));
}
function assignmentRows(trip:Trip,groups:AssignmentGroup[]):OrderShopRow[] {
  requireTripId(trip.id);
  if (groups.length!==1 || groups[0].orderTripId!==trip.id) throw new Error("Assignment and collection must use the same backend trip ID");
  return groups[0].rows;
}
export async function saveAssignment(trip:Trip,groups:AssignmentGroup[]):Promise<Trip> {
  return persistOrders(trip,assignmentRows(trip,groups),"assignment","save");
}
export async function finishAssignment(trip:Trip,groups:AssignmentGroup[]):Promise<Trip> {
  return persistOrders(trip,assignmentRows(trip,groups),"assignment","submit");
}
export async function recordShopDelivery(trip:Trip,entry:{shopId:number;boxes:number}):Promise<Trip> {
  const fresh=await loadTripById(trip.id);
  const assignment=fresh.orderAssignments?.find(a=>a.shopId===entry.shopId);
  const captures=fresh.deliveries.filter(r=>r.shopId===entry.shopId && isCapturedRow(r));
  const remaining=num(assignment?.boxNo)-captures.reduce((s,r)=>s+deliveredRowBoxes(r),0);
  if (!assignment || entry.boxes<=0 || entry.boxes>remaining) throw new Error("Delivery exceeds the latest saved assignment balance");
  const row=buildShopDeliveryRow(fresh,assignment,entry);
  return saveShopDeliveries({...fresh,deliveries:[...fresh.deliveries,row]});
}
export async function saveShopDeliveries(trip:Trip):Promise<Trip> {
  requireTripId(trip.id);
  const {data}=await apiPost<Record<string,unknown>>(`/trips/${trip.id}/steps/deliveries`,{...toStep4Payload(trip),mode:"save"});
  return mapApiTripToTrip(data);
}
/** Tracking can save captures, never submit Step 4 or complete a trip. */
export const submitShopDeliveries=saveShopDeliveries;

export type DayOverAssignment={shopId:number;shopName:string;ordered:number;elsewhere:number;remaining:number;requested:number};
export async function findDayOverAssignments(day:string,selected:Array<{shopId:number;shopName:string;boxes:number}>,tripId:number):Promise<DayOverAssignment[]> {
  requireTripId(tripId);
  const fresh=await fetchOrdersData();
  const collection=fresh.collectionsByTripId[tripId];
  if (!collection || collection.trip.tripDate!==day) throw new Error("Collection does not belong to this trip/day");
  return selected.flatMap(s=>{const row=collection.rows.find(r=>r.shopId===s.shopId);const ordered=num(row?.boxNo);
    return !row||s.boxes>ordered?[{...s,ordered,elsewhere:0,remaining:ordered,requested:s.boxes}]:[];});
}

export type ShopDirectory = Map<
  number,
  { shopName: string; village: string; mobile: string; shopNumber: string }
>;
export type SupervisorDirectory = Map<string, string>; // name (lower) -> mobile

export async function loadShopDirectory(source?: Shop[]): Promise<ShopDirectory> {
  const shops = source ?? await loadShops();
  const dir: ShopDirectory = new Map();
  for (const shop of shops) {
    dir.set(shop.id, {
      shopName: shop.shopName,
      // The Shop Master redesign renamed `village` to `city`; Orders keeps its
      // own "village" wording for the column but reads the master's field.
      village: shop.city,
      mobile: (shop.phoneNumber ?? "").trim(),
      shopNumber: (shop.shopNumber || (shop.shopNo ? String(shop.shopNo) : "")).trim(),
    });
  }
  return dir;
}

export async function loadSupervisorDirectory(): Promise<SupervisorDirectory> {
  const employees = await loadEmployees();
  const dir: SupervisorDirectory = new Map();
  for (const emp of employees) {
    const name = emp.employeeName?.trim().toLowerCase();
    if (name && emp.phoneNumber) dir.set(name, emp.phoneNumber);
    if (emp.id && emp.phoneNumber) dir.set(String(emp.id), emp.phoneNumber);
  }
  return dir;
}

export function supervisorMobileOf(trip: Trip, directory: SupervisorDirectory): string {
  const byId = directory.get(String(trip.supervisorId ?? ""));
  if (byId) return byId;
  return directory.get(trip.supervisorName?.trim().toLowerCase() ?? "") ?? "";
}

export function villageOf(
  shopId: number,
  shopName: string,
  directory: ShopDirectory
): string {
  return directory.get(shopId)?.village ?? shopName ?? "";
}

/** Shop Mobile from the Shop Master only ("" when the master has none). */
export function shopMobileOf(
  shopId: number,
  directory: ShopDirectory
): string {
  return directory.get(shopId)?.mobile ?? "";
}

/** Shop number from the Shop Master only ("" when the master has none). */
export function shopNumberOf(
  shopId: number,
  directory: ShopDirectory
): string {
  return directory.get(shopId)?.shopNumber ?? "";
}

// ─── WhatsApp — existing per-delivery mechanism, order-level usage ──────────

export type OrdersWhatsAppResult = {
  enabled: boolean;
  sent: number;
  failed: number;
  skipped: number;
  message?: string;
};

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error("Unable to read PDF bytes."));
    reader.readAsDataURL(blob);
  });
}

/**
 * Order Assignment Review & Submit — ONE WhatsApp to the vehicle SUPERVISOR
 * mobile only. Shop-owner numbers are never used as the recipient.
 */
export function isOrdersWhatsAppConfigured(): boolean {
  return import.meta.env?.VITE_WHATSAPP_BACKEND_ENABLED === "true";
}

export async function sendOrdersWhatsApp(
  trip: Trip,
  supervisorMobile: string,
  onProgress?: (sent: number, total: number, shopName: string) => void
): Promise<OrdersWhatsAppResult> {
  if (!isOrdersWhatsAppConfigured()) {
    return {
      enabled: false,
      sent: 0,
      failed: 1,
      skipped: 0,
      message: "WhatsApp integration is not configured yet.",
    };
  }

  const recipient = String(supervisorMobile || "").trim();
  if (!recipient) {
    return {
      enabled: true,
      sent: 0,
      failed: 1,
      skipped: 0,
      message: "Supervisor mobile is missing — nothing sent to shop owners.",
    };
  }

  const rows = rowsInSequence(trip).filter((r) => r.shopId > 0);
  if (rows.length === 0) {
    return { enabled: true, sent: 0, failed: 1, skipped: 0, message: "no_rows" };
  }

  onProgress?.(0, 1, trip.supervisorName || "Supervisor");

  try {
    const { generateAssignmentSheetPdf } = await import("./pdf/generateAssignmentSheetPdf");
    const orderTripNo =
      rows.map((r) => parseOrderRef(r.remarks)).find((ref) => Boolean(ref)) || trip.tripNo;
    const built = await generateAssignmentSheetPdf({
      trip,
      supervisorMobile: recipient,
      orderTripNo,
      orderDate: trip.tripDate,
      rows: rows.map((r, i) => ({
        serialNo: i + 1,
        shopId: r.shopId,
        shopName: r.shopName || "Shop",
        village: String((r as { village?: string }).village ?? ""),
        mobile: "",
        boxes: rowBoxes(r),
        birds: num(r.birds),
      })),
      capacity: 0,
      alreadyAssignedOther: 0,
      mode: "preview",
    });
    const pdfBase64 = await blobToBase64(built.blob);
    URL.revokeObjectURL(built.url);
    const { data: receipt } = await apiPost<{sent?: boolean; messageId?: string}>(
      `/trips/${trip.id}/whatsapp`,
      {
        ordersHash: trip.ordersHash,
        recipient,
        supervisorMobile: recipient,
        shopWhatsApp: recipient,
        message: `DMR Poultries assignment for ${trip.tripNo} · ${trip.vehicleNo || ""}`.trim(),
        pdfBase64,
        fileName: built.fileName,
      },
      { timeout: 60_000 }
    );
    if (!receipt.sent || !receipt.messageId) throw new Error("WhatsApp did not confirm a successful send");
    onProgress?.(1, 1, "");
    return { enabled: true, sent: 1, failed: 0, skipped: 0 };
  } catch (error: unknown) {
    return {
      enabled: true,
      sent: 0,
      failed: 1,
      skipped: 0,
      message: error instanceof Error ? error.message : "send failed",
    };
  }
}

// ─── Client-side page slice (the pattern used across the existing Ops pages) ─

export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
