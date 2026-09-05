// src/modules/operations/orders/i18n/ordersI18n.ts
// Orders-specific translations in NEW files (no global i18n files touched).
// Falls back to the shared `t()` for common keys and to English for any
// Orders key missing in Telugu — so a raw key is never rendered.

import { useCallback } from "react";
import { useI18n, type Language } from "../../../../i18n";

const EN: Record<string, string> = {
  // Tabs
  "orders.tab_collection": "Order Collection",
  "orders.tab_assignment": "Order Assignment",
  "orders.tab_tracking": "Delivery Tracking",

  // ── Tab 1 · Order Collection ──────────────────────────────────────────
  "orders.collection_hint":
    "Enter No. of Birds and No. of Boxes for each shop. The vehicle is assigned only after the collection is finished.",
  "orders.collection_resume": "Resuming saved collection {orderNo}",
  "orders.no_active_shops": "No active shops available in Shop Master",
  "orders.col_sno": "S.No",
  "orders.col_shop_name": "Shop Name",
  "orders.col_village": "City",
  "orders.city": "City",
  "orders.col_mobile": "Mobile",
  "orders.boxes": "Boxes",
  "orders.birds": "Birds",
  "orders.col_birds": "No. of Birds",
  "orders.col_boxes": "No. of Boxes",
  "orders.col_no_of_boxes": "No. of Boxes",
  "orders.col_weight": "Weight",
  "orders.col_status": "Status",
  "orders.col_action": "Action",
  "orders.status_entered": "Entered",
  "orders.status_draft": "Incomplete",
  "orders.entry_cleared": "Entry cleared for {shop}",
  "orders.clear_entry": "Clear entry",
  "orders.clear_entry_label": "Clear {shop}",
  "orders.collection_summary": "{shops} shops · {boxes} boxes · {birds} birds",
  "orders.add_at_least_one_shop": "Enter at least one shop order (birds + boxes)",
  "orders.finish_invalid": "Enter No. of Boxes for: {shops}",
  "orders.save_progress": "Save Progress",
  "orders.saving": "Saving…",
  "orders.finish_collection": "Finish Collection",
  "orders.submitting": "Finishing…",
  "orders.cancel": "Cancel",
  "orders.collection_saved": "Collection progress saved",
  "orders.collection_finished": "Order collected — assign a vehicle in Order Assignment",
  "orders.weight_pending": "Weight comes from farm data at delivery",

  // ── Tab 2 · Order Assignment ──────────────────────────────────────────
  "orders.assignment_empty":
    "No collected orders awaiting assignment. Finish a collection in Order Collection first.",
  "orders.col_order_no": "Order No",
  "orders.col_date": "Date",
  "orders.col_shops": "Shops",
  "orders.col_assigned": "Assigned",
  "orders.awaiting_assignment": "Awaiting assignment",
  "orders.partial_assigned": "Partial on {vehicle} ({assigned}/{total} shops)",
  "orders.select_order": "Select a collected order to assign it to a vehicle",
  "orders.select_vehicle": "Select vehicle",
  "orders.vehicles_ready": "Vehicles ready for assignment",
  "orders.step2_submitted_note": "Step 2 submitted, delivery pending",
  "orders.assign_to_vehicle": "Assign shops to this vehicle",
  "orders.select_vehicle_hint":
    "Pick a vehicle on the left to assign the day's collected shops to it.",
  "orders.saved_on_vehicle": "Saved on this vehicle",
  "orders.no_eligible_vehicles":
    "No vehicle trips available for assignment. Create a trip with Step 2 (Farm) completed in Vehicle Trip Entry first.",
  "orders.vehicle_locked":
    "This order already has assignments on {vehicle} — continue the assignment there.",
  "orders.vehicle_no": "Vehicle No",
  "orders.farm_address": "Farm Address",
  "orders.farm_city": "Farm City",
  "orders.bird_type": "Bird Type",
  "orders.avg_bird_weight": "Avg Bird Weight",
  "orders.vehicle_box_capacity": "Vehicle Box Capacity",
  "orders.available_boxes": "Available Boxes",
  "orders.supervisor": "Supervisor",
  "orders.driver": "Driver",
  "orders.supervisor_mobile": "Supervisor Mobile",
  "orders.assignment_summary":
    "Capacity: {capacity} · Assigned: {assigned} · Remaining: {remaining} · Shops: {shops}",
  "orders.col_sequence": "Sequence",
  // Sequence editing at scale (~45 shops a vehicle): drag, jump, or sort.
  "orders.drag_handle": "Drag to reorder",
  "orders.drag_hint":
    "Drag a row to reorder · ↑ ↓ move one place · ⤒ ⤓ send to first / last · or sort the whole list",
  "orders.move_first": "Move to first",
  "orders.move_last": "Move to last",
  "orders.sequence_sort": "Sort sequence",
  "orders.seq_shop_az": "Shop A→Z",
  "orders.seq_village_az": "City A→Z",
  "orders.assigned_boxes": "Assigned",
  "orders.assign_hint":
    "Reorder the delivery sequence and set the boxes each shop receives from this vehicle.",
  "orders.capacity_exceeded_title": "Vehicle box capacity exceeded",
  "orders.capacity_exceeded":
    "Vehicle Capacity: {capacity} · Already Assigned: {assigned} · Available: {available} · Requested: {requested}",
  "orders.finish_assignment_invalid":
    "Assign at least 1 box to every shop before finishing the assignment",
  "orders.assignment_saved": "Assignment progress saved",
  "orders.assignment_finished": "Order assigned — now visible in Delivery Tracking",
  "orders.finish_assignment": "Finish Assignment",

  // ── Tab 3 · Delivery Tracking ─────────────────────────────────────────
  "orders.tracking_empty":
    "No assigned orders to track yet. Finish an order assignment to start tracking.",
  "orders.col_trip_no": "Trip No",
  "orders.col_vehicle_no": "Vehicle No",
  "orders.col_total_shops": "Total Shops",
  "orders.col_delivered": "Delivered",
  "orders.col_pending": "Pending",
  "orders.col_total_boxes": "Total Boxes",
  "orders.col_delivered_boxes": "Delivered Boxes",
  "orders.delivered_of": "{x} / {y} Delivered",
  "orders.pending_count": "{n} Pending",
  "orders.status_assigned": "Assigned",
  "orders.status_in_progress": "In Progress",
  "orders.status_completed": "Completed",
  "orders.week_window_note":
    "Completed orders are shown for the current 7-day operational window only.",

  // ── Delivery detail view ──────────────────────────────────────────────
  "orders.trip_details": "TRIP DETAILS",
  "orders.shop_delivery_details": "SHOP DELIVERY REPORT",
  "orders.no_results": "No matching shop delivery records",
  "orders.ordered_birds": "Ordered Birds",
  "orders.ordered_boxes": "Ordered Boxes",
  "orders.delivered_birds": "Delivered Birds",
  "orders.delivered_boxes": "Delivered Boxes",
  "orders.col_delivery_status": "Delivery Status",
  "orders.col_delivered_at": "Delivered At",
  "orders.status_delivered": "Delivered",
  "orders.status_pending": "Pending",
  "orders.added_during_delivery": "ADDED DURING DELIVERY",
  "orders.additional_legend":
    "Shops present in Step 4 delivery data but not in the original order",
  "orders.additional_shop": "Additional shop",
  "orders.additional_count": "{n} shop(s) added during delivery",
  "orders.back": "Back",
  "orders.view": "View",
  "orders.no_saved_collection": "No saved collection yet",

  // ── Shared actions / states ───────────────────────────────────────────
  "orders.pdf": "PDF",
  "orders.whatsapp": "Review & Submit",
  "orders.pdf_generating": "Generating PDF…",
  "orders.pdf_ready": "Order PDF generated",
  "orders.pdf_failed": "Unable to generate the PDF",
  // "Check PDF" popup — verify the report, then download / send it.
  "orders.pdf_check_title": "Delivery Report — check before sending",
  "orders.pdf_order_details": "Order details",
  "orders.pending_boxes": "Pending Boxes",
  "orders.assign_shops": "Assign Shops",
  "orders.part_assign_left": "{boxes} left",
  "orders.vehicles_waiting": "Waiting for shops",
  "orders.vehicle_list_assigned": "Shops assigned",
  "orders.vehicles_count": "{pending} pending · {saved} saved",
  "orders.boxes_short": "boxes",
  "orders.vehicle_shops_assigned": "{n} shops assigned",
  "orders.vehicle_shops_none": "No shops yet",
  "orders.sequence_empty_hint": "Tick the shops above to build this vehicle's delivery sequence — drag the rows to set the order, then Save Progress or Review & Submit.",
  "orders.col_available": "Available",
  "orders.hdr_mobile": "Mobile",
  "orders.hdr_ord_birds": "Ord. Birds",
  "orders.hdr_del_birds": "Del. Birds",
  "orders.hdr_diff_birds": "Diff. (Birds)",
  "orders.hdr_ord_boxes": "Ord. Boxes",
  "orders.hdr_del_boxes": "Del. Boxes",
  "orders.hdr_diff_boxes": "Diff. (Boxes)",
  "orders.hdr_status": "Status",
  "orders.hdr_delivered_at": "Delivered At",
  "orders.pending_boxes_hint": "{boxes} box still to deliver",
  "orders.pdf_check_summary": "Report summary",
  "orders.delivered_shops": "Delivered Shops",
  "orders.pdf_saved_btn": "Saved",
  "orders.pdf_shop_details": "Shop details",
  "orders.pdf_order_date": "Order Date",
  "orders.pdf_save_progress": "Save Progress",
  "orders.pdf_submit": "Submit",
  "orders.pdf_saved_ok": "Progress saved",
  "orders.pdf_submitted_ok": "Delivery submitted — the trip is now Completed",
  "orders.pdf_submit_blocked": "Deliver at least one shop before submitting",
  "orders.pdf_building": "Building the report…",
  "orders.pdf_pages": "{pages} page(s)",
  "orders.pdf_download": "Download PDF",
  "orders.pdf_send_whatsapp": "Send on WhatsApp",
  "orders.pdf_correct": "Correct deliveries",
  "orders.sending": "Sending…",
  "orders.pdf_sent_ok": "Report sent on WhatsApp — {sent} shop(s)",
  "orders.pdf_sent_partial": "Report sent to {sent} shop(s) — {failed} failed",
  "orders.whatsapp_sending": "Sending to {shop}…",
  "orders.whatsapp_done": "WhatsApp sent for {sent} of {total} shops",
  "orders.whatsapp_partial": "WhatsApp sent for {sent}, {failed} failed",
  "orders.whatsapp_failed": "WhatsApp failed: {message}",
  "orders.whatsapp_not_configured":
    "WhatsApp backend is not configured (VITE_WHATSAPP_BACKEND_ENABLED)",
  "orders.whatsapp_no_rows": "No shops to send yet — add shops first",
  "orders.loading": "Loading orders…",
  "orders.sample_badge": "Sample data",
  "orders.sample_hint":
    "Showing bundled sample data — no backend is connected. Save, Finish and Assignment work against the in-memory sample store and reset on refresh.",
  "orders.error_title": "Could not load orders",
  "orders.error_message":
    "The backend did not respond. Check the connection and try again.",
  "orders.retry": "Retry",
  "orders.refresh_failed": "Could not refresh order data",
  "orders.unsaved_changes": "Unsaved changes",
  "orders.confirm_discard_title": "Discard unsaved changes?",
  "orders.confirm_discard_message":
    "Your unsaved entries will be lost. Saved progress is kept.",
  "orders.discard": "Discard changes",
  "orders.close": "Close",

  // Day scroller (day-based workflow)
  "orders.day_label": "Operational Day",
  "orders.day_prev": "Previous Day",
  "orders.day_next": "Next Day",
  "orders.locked": "LOCKED",
  "orders.closed_day": "CLOSED",
  "orders.read_only_note": "This operational day is closed — view only.",
  "orders.auto_closed_note":
    "Collection auto-closed at {deadline} — view only.",
  "orders.no_collection_day": "No order collection for {day}",
  "orders.collection_complete": "Complete",
  "orders.finish_collection_locked":
    "This day's collection is complete — no further edits",

  // Collection table: trip / assignment / status
  "orders.col_trip_assignment": "Trip / Assignment",
  "orders.not_assigned": "Not Assigned",
  "orders.seq_n": "Seq {n}",
  "orders.assigned_to_vehicle": "{vehicle} · Seq {n}",
  "orders.status_delivered_diff": "Delivered with Difference",
  "orders.status_part_delivered": "Part Delivered",
  "orders.status_not_delivered": "NOT DELIVERED",
  // Shop-level delivery capture (Tab 3 report — last column).
  "orders.record_delivery": "Delivery Entry",
  "orders.deliver": "Deliver",
  "orders.balance": "Balance",
  "orders.delivery_balance_hint": "Enter up to {remaining} boxes (the shop's balance)",
  "orders.delivery_complete": "Complete",
  "orders.delivery_saved_partial": "{boxes} boxes delivered — {shop}",
  "orders.status_not_listed": "NOT LISTED",
  "orders.status_ordered": "ORDERED",
  "orders.col_order_status": "Order Status",
  "orders.not_listed_deliveries": "NOT LISTED SHOP DELIVERIES",
  "orders.search_report": "Search shop, city, status…",
  "orders.pool_summary":
    "{collected} collected · {assigned} assigned · {available} available",

  // Tab 2: shop selection
  "orders.available_shops": "AVAILABLE SHOPS",
  "orders.selected_for_vehicle": "SELECTED FOR VEHICLE",
  "orders.select_col": "Select",
  "orders.select_vehicle_first":
    "Select a vehicle to see the available shops for {day}",
  "orders.selection_empty":
    "Tick shops in Available Shops to build this vehicle's delivery order",
  "orders.assigned_elsewhere": "Assigned — {trip} ({vehicle})",
  "orders.day_assignments": "Assignments for {day}",
  "orders.vehicles_assigned": "{vehicles} vehicle(s) · {shops} shop(s) assigned",
  "orders.conflict_message":
    "{shops} already assigned to another vehicle for this day. Selection refreshed.",
  // Split-order (partial assignment across vehicles) — hard balance cap.
  "orders.status_pending_assign": "Pending for Assign",
  "orders.status_part_assigned": "Part Assigned",
  "orders.on_other_vehicles": "{boxes} on other vehicles",
  "orders.over_assign_message":
    "Not enough unassigned boxes: {shops}. Values adjusted to the remaining balance.",
  // WhatsApp check-popup + Shop Assignment Sheet PDF.
  "orders.wa_check_title": "Review & Submit",
  "orders.sheet_language": "Language",
  "orders.lang_english": "English",
  "orders.lang_telugu": "Telugu",
  "orders.pdf_seq": "Seq",
  "orders.pdf_page": "Page {p} of {n}",
  "orders.pdf_generated": "Generated on {when}",
  "orders.wa_message_preview": "Message preview (exactly what will be sent)",
  "orders.wa_send_note":
    "Sends this assignment to the supervisor on WhatsApp, one message per shop with its delivery PDF.",
  "orders.wa_confirm_send": "Confirm & Send",
  "orders.wa_send_to": "Send to",
  "orders.assignment_sheet_title": "Shop Assignment Sheet",
  "orders.assignment_details": "ASSIGNMENT DETAILS",
  "orders.col_assigned_boxes": "Assigned Boxes",
  "orders.est_weight": "Est. Weight",
  "orders.shops_to_deliver": "SHOPS TO DELIVER (IN ORDER)",
  "orders.assignment_sheet_sub": "{shops} shops · {boxes} boxes",
  "orders.sequence_empty": "No shops selected",

  // Differences
  "orders.col_difference": "Difference",
  "orders.word_box": "box",
  "orders.word_boxes": "boxes",
  "orders.word_bird": "bird",
  "orders.word_birds": "birds",

  // Delivery tracking: two-table layout
    "orders.tracking_active_title": "PENDING & IN PROGRESS",
    "orders.tracking_completed_title": "COMPLETED",
    "orders.col_progress": "Progress",
    "orders.col_completed_at": "Completed At",
    "orders.status_complete": "COMPLETE",
    "orders.no_pending_deliveries": "No pending deliveries",
    "orders.no_completed_window": "No completed trips in the selected range",
    "orders.no_search_results": "No shops match your search",
    "orders.no_filter_results": "No shops match this filter",
    "orders.search_collection": "Search shop, city, trip, vehicle, status…",
    "orders.search_assignment": "Search shop, city, trip, vehicle, supervisor…",
    "orders.search_tracking": "Search shop, city, trip, vehicle, supervisor, status…",
    "orders.filter_status": "Status",
    "orders.filter_difference": "Difference",
    "orders.all": "All",
    "orders.delivered_with_difference": "Delivered With Difference",
    "orders.no_difference": "No Difference",
    "orders.short_delivery": "Short Delivery",
    "orders.extra_delivery": "Extra Delivery",

  // Global date selector
  "orders.today_chip": "TODAY",
  "orders.no_orders_for_day": "No orders collected for {date}",

  // Delivery detail report: weight columns + totals
  "orders.ordered_weight": "Ordered Weight",
  "orders.delivered_weight": "Delivered Weight",
  "orders.weight_kg": "Weight (KG)",
  "orders.total_ordered": "TOTAL ORDERED",
  "orders.total_delivered": "TOTAL DELIVERED",

  // Table-level refresh (soft notification)
  "orders.refresh": "Refresh",
  "orders.refresh_collection": "Orders refreshed",
  "orders.refresh_assignment": "Assignment data refreshed",
  "orders.refresh_tracking": "Delivery tracking refreshed",

  // Collection table sort
  "orders.sort": "Sort",
  "orders.sort_collected_first": "Collected First",
  "orders.sort_name_az": "Shop Name A → Z",
  "orders.sort_name_za": "Shop Name Z → A",

  // Collection statuses + assignment/tracking additions (polish round 2)
  "orders.status_not_collected": "Not Collected",
  "orders.status_collected": "Collected",
  "orders.available": "Available",
  "orders.available_collected_shops": "AVAILABLE COLLECTED SHOPS",
  "orders.selected_shops": "Selected Shops",
  "orders.selected_count": "{n} selected",
  "orders.total_birds": "Total Birds",
  "orders.total_boxes": "Total Boxes",
  "orders.total_weight": "Total Weight (KG)",
  "orders.delivery_time": "Delivery Time",
  "orders.weight": "Weight",
  "orders.requested": "Requested",
  "orders.already_assigned": "Already Assigned",
  "orders.capacity_exceeded_line": "Capacity exceeded. Please reduce the assigned boxes.",
  "orders.not_listed_note": "This shop was delivered during Step 4 but was not present in the original collected order.",
  "orders.shop_mobile": "Shop Mobile",
  "orders.from_date": "From",
  "orders.to_date": "To",
  "orders.trips_count": "{x} trips",
  "orders.collected_shops": "Collected Shops",
  // Pool search + refine (a day can carry ~100 shops).
  "orders.search_pool": "Search shop, city, vehicle, trip…",
  "orders.filter_shops": "Refine shops",
  "orders.filter_city": "City",
  "orders.filter_city_all": "All cities",
  "orders.pool_filter_all": "All shops",
  "orders.pool_filter_pending": "Pending (not assigned)",
  "orders.pool_filter_assigned": "Assigned (any vehicle)",
  "orders.pool_filter_this_vehicle": "On this vehicle",
  "orders.pool_showing": "{shown} of {total} shops · {selected} selected",
  "orders.vehicle_trip": "Vehicle / Trip",
  "orders.sort_pending_first": "Pending First",
  "orders.sort_vehicle_trip": "Vehicle / Trip",
  "orders.listed_shops": "Listed Shops",
  "orders.not_listed_shops": "Not Listed Shops",
  "orders.box_difference": "Box Difference",
  "orders.pdf_report_title": "SHOP DELIVERY REPORT",
  "orders.pdf_order_no": "Order No",
  "orders.pdf_totals": "TOTALS",
};

const TE: Record<string, string> = {
  // Tabs
  "orders.tab_collection": "ఆర్డర్ సేకరణ",
  "orders.tab_assignment": "ఆర్డర్ అసైన్‌మెంట్",
  "orders.tab_tracking": "డెలివరీ ట్రాకింగ్",

  // Tab 1
  "orders.collection_hint":
    "ప్రతి షాప్‌కు పక్షుల సంఖ్య మరియు బాక్స్‌ల సంఖ్య నమోదు చేయండి. సేకరణ పూర్తి అయిన తర్వాత మాత్రమే వాహనం అసైన్ చేయబడుతుంది.",
  "orders.collection_resume": "సేవ్ చేసిన సేకరణ {orderNo} కొనసాగించబడుతోంది",
  "orders.no_active_shops": "షాప్ మాస్టర్‌లో యాక్టివ్ షాప్‌లు లేవు",
  "orders.col_sno": "సం.సం",
  "orders.col_shop_name": "షాప్ పేరు",
  "orders.col_village": "సిటీ",
  "orders.city": "సిటీ",
  "orders.col_mobile": "మొబైల్",
  "orders.boxes": "బాక్స్‌లు",
  "orders.birds": "పక్షులు",
  "orders.col_birds": "పక్షుల సంఖ్య",
  "orders.col_boxes": "బాక్స్‌ల సంఖ్య",
  "orders.col_no_of_boxes": "బాక్స్‌ల సంఖ్య",
  "orders.col_weight": "బరువు",
  "orders.col_status": "స్థితి",
  "orders.col_action": "చర్య",
  "orders.status_entered": "నమోదు చేయబడింది",
  "orders.status_draft": "పూర్తి అవ్వలేదు",
  "orders.entry_cleared": "{shop} నమోదు తీసివేయబడింది",
  "orders.clear_entry": "నమోదును క్లియర్ చేయండి",
  "orders.clear_entry_label": "{shop} క్లియర్ చేయండి",
  "orders.collection_summary": "{shops} షాప్‌లు · {boxes} బాక్స్‌లు · {birds} పక్షులు",
  "orders.add_at_least_one_shop": "కనీసం ఒక షాప్ ఆర్డర్ నమోదు చేయండి (పక్షులు + బాక్స్‌లు)",
  "orders.finish_invalid": "ఇవీ బాక్స్‌ల సంఖ్య నమోదు చేయండి: {shops}",
  "orders.save_progress": "ప్రగతి సేవ్ చేయండి",
  "orders.saving": "సేవ్ అవుతోంది…",
  "orders.finish_collection": "సేకరణ పూర్తి చేయండి",
  "orders.submitting": "పూర్తి అవుతోంది…",
  "orders.cancel": "రద్దు చేయండి",
  "orders.collection_saved": "సేకరణ ప్రగతి సేవ్ చేయబడింది",
  "orders.collection_finished": "ఆర్డర్ సేకరించబడింది — ఆర్డర్ అసైన్‌మెంట్‌లో వాహనం అసైన్ చేయండి",
  "orders.weight_pending": "బరువు డెలివరీ సమయంలో ఫామ్ డేటా నుండి వస్తుంది",

  // Tab 2
  "orders.assignment_empty":
    "అసైన్‌మెంట్‌కు காతూంటూ ఉన్న సేకరించిన ఆర్డర్లు లేవు. ముందు ఆర్డర్ సేకరణ పూర్తి చేయండి.",
  "orders.col_order_no": "ఆర్డర్ నంబర్",
  "orders.col_date": "తేదీ",
  "orders.col_shops": "షాప్‌లు",
  "orders.col_assigned": "అసైన్",
  "orders.awaiting_assignment": "అసైన్‌మెంట్‌కు ప్రతిక్షిస్తోంది",
  "orders.partial_assigned": "{vehicle} పై పాక్షికంగా ({assigned}/{total} షాప్‌లు)",
  "orders.select_order": "వాహనానికి అసైన్ చేయడానికి సేకరించిన ఆర్డర్ ఎంచుకోండి",
  "orders.select_vehicle": "వాహనం ఎంచుకోండి",
  "orders.vehicles_ready": "అసైన్‌మెంట్‌కు సిద్ధంగా ఉన్న వాహనాలు",
  "orders.step2_submitted_note": "స్టెప్ 2 సబ్మిట్ అయింది, డెలివరీ పెండింగ్",
  "orders.assign_to_vehicle": "ఈ వాహనానికి షాప్‌లను కేటాయించండి",
  "orders.select_vehicle_hint":
    "రోజు సేకరించిన షాప్‌లను కేటాయించడానికి ఎడమ వైపున వాహనాన్ని ఎంచుకోండి.",
  "orders.saved_on_vehicle": "ఈ వాహనంపై సేవ్ చేయబడింది",
  "orders.no_eligible_vehicles":
    "అసైన్‌మెంట్‌కు అందుబాటులో ఉన్న వాహన ట్రిప్‌లు లేవు. ముందు వాహన ట్రిప్ ఎంట్రీలో స్టెప్ 2 (ఫామ్) పూర్తి చేసిన ట్రిప్ సృష్టించండి.",
  "orders.vehicle_locked":
    "ఈ ఆర్డర్‌కు ఇప్పటికే {vehicle} పై అసైన్‌మెంట్‌లు ఉన్నాయి — అక్కడ కొనసాగించండి.",
  "orders.vehicle_no": "వాహన నంబర్",
  "orders.farm_address": "ఫామ్ చిరునామా",
  "orders.farm_city": "ఫామ్ సిటీ",
  "orders.bird_type": "పక్షి రకం",
  "orders.avg_bird_weight": "సగటు పక్షి బరువు",
  "orders.vehicle_box_capacity": "వాహన బాక్స్ సామర్థ్యం",
  "orders.available_boxes": "అందుబాటులో ఉన్న బాక్స్‌లు",
  "orders.supervisor": "సూపర్‌వైజర్",
  "orders.driver": "డ్రైవర్",
  "orders.supervisor_mobile": "సూపర్‌వైజర్ మొబైల్",
  "orders.assignment_summary":
    "సామర్థ్యం: {capacity} · అసైన్: {assigned} · మిగిలినవి: {remaining} · షాప్‌లు: {shops}",
  "orders.col_sequence": "క్రమం",
  // పెద్ద సంఖ్యలో షాప్‌ల క్రమం (~45 ఒక వాహనానికి): డ్రాగ్, జంప్, లేదా సార్ట్.
  "orders.drag_handle": "క్రమం మార్చడానికి డ్రాగ్ చేయండి",
  "orders.drag_hint":
    "వరుస మార్చడానికి వరుసను డ్రాగ్ చేయండి · ↑ ↓ ఒక స్థానం · ⤒ ⤓ మొదటి / చివరి స్థానానికి · లేదా మొత్తం జాబితాను సార్ట్ చేయండి",
  "orders.move_first": "మొదటి స్థానానికి",
  "orders.move_last": "చివరి స్థానానికి",
  "orders.sequence_sort": "క్రమాన్ని సార్ట్ చేయండి",
  "orders.seq_shop_az": "షాప్ A→Z",
  "orders.seq_village_az": "సిటీ A→Z",
  "orders.assigned_boxes": "అసైన్",
  "orders.assign_hint":
    "డెలివరీ క్రమాన్ని మార్చండి మరియు ప్రతి షాప్‌కు ఈ వాహనం నుండి ఎన్ని బాక్స్‌లు వస్తాయో నిర్దేశించండి.",
  "orders.capacity_exceeded_title": "వాహన బాక్స్ సామర్థ్యం మించింది",
  "orders.capacity_exceeded":
    "వాహన సామర్థ్యం: {capacity} · ఇప్పటికే అసైన్: {assigned} · అందుబాటులో: {available} · అడిగినవి: {requested}",
  "orders.finish_assignment_invalid":
    "అసైన్‌మెంట్ పూర్తి చేయడానికి ముందు ప్రతి షాప్‌కు కనీసం 1 బాక్స్ అసైన్ చేయండి",
  "orders.assignment_saved": "అసైన్‌మెంట్ ప్రగతి సేవ్ చేయబడింది",
  "orders.assignment_finished": "ఆర్డర్ అసైన్ చేయబడింది — డెలివరీ ట్రాకింగ్‌లో కనిపిస్తోంది",
  "orders.finish_assignment": "అసైన్‌మెంట్ పూర్తి చేయండి",

  // Tab 3
  "orders.tracking_empty":
    "ట్రాక్ చేయాల్సిన అసైన్ చేసిన ఆర్డర్లు లేవు. ట్రాకింగ్ ప్రారంభించడానికి ఆర్డర్ అసైన్‌మెంట్ పూర్తి చేయండి.",
  "orders.col_trip_no": "ట్రిప్ నంబర్",
  "orders.col_vehicle_no": "వాహన నంబర్",
  "orders.col_total_shops": "మొత్తం షాప్‌లు",
  "orders.col_delivered": "డెలివర్డ్",
  "orders.col_pending": "పెండింగ్",
  "orders.col_total_boxes": "మొత్తం బాక్స్‌లు",
  "orders.col_delivered_boxes": "డెలివర్డ్ బాక్స్‌లు",
  "orders.delivered_of": "{x} / {y} డెలివర్డ్",
  "orders.pending_count": "{n} పెండింగ్",
  "orders.status_assigned": "అసైన్",
  "orders.status_in_progress": "ప్రాసెస్‌లో",
  "orders.status_completed": "పూర్తి",
  "orders.week_window_note": "పూర్తి చేసిన ఆర్డర్లు ప్రస్తుత 7-రోజుల కాలానికి మాత్రమే కనిపిస్తాయి.",

  // Detail
  "orders.trip_details": "ట్రిప్ వివరాలు",
  "orders.shop_delivery_details": "షాప్ డెలివరీ రిపోర్ట్",
  "orders.no_results": "పొందే షాప్ డెలివరీ రికార్డులు లేవు",
  "orders.ordered_birds": "ఆర్డర్ పక్షులు",
  "orders.ordered_boxes": "ఆర్డర్ బాక్స్‌లు",
  "orders.delivered_birds": "డెలివర్డ్ పక్షులు",
  "orders.delivered_boxes": "డెలివర్డ్ బాక్స్‌లు",
  "orders.col_delivery_status": "డెలివరీ స్థితి",
  "orders.col_delivered_at": "డెలివర్డ్ సమయం",
  "orders.status_delivered": "డెలివర్డ్",
  "orders.status_pending": "పెండింగ్",
  "orders.added_during_delivery": "డెలివరీ సమయంలో జోడించబడింది",
  "orders.additional_legend":
    "మూల ఆర్డర్‌లో లేకుండా స్టెప్ 4 డెలివరీ డేటాలో ఉన్న షాప్‌లు",
  "orders.additional_shop": "అదనపు షాప్",
  "orders.additional_count": "{n} షాప్(లు) డెలివరీ సమయంలో జోడించబడ్డాయి",
  "orders.back": "వెనుకకు",
  "orders.view": "చూడండి",
  "orders.no_saved_collection": "ఇంకా సేవ్ చేసిన సేకరణ లేదు",

  // Shared
  "orders.pdf": "PDF",
  "orders.whatsapp": "Review & Submit",
  "orders.pdf_generating": "PDF ఉత్పత్తి అవుతోంది…",
  "orders.pdf_ready": "ఆర్డర్స్ PDF ఉత్పత్తి చేయబడింది",
  "orders.pdf_failed": "PDF ఉత్పత్తి చేయలేకపోయాను",
  // "PDF చెక్" పాప్‌అప్ — నివేదికను సరిచూసి, డౌన్‌లోడ్ / పంపండి.
  "orders.pdf_check_title": "డెలివరీ రిపోర్ట్ — పంపే ముందు తనిఖీ చేయండి",
  "orders.pdf_order_details": "ఆర్డర్ వివరాలు",
  "orders.pending_boxes": "పెండింగ్ బాక్సులు",
  "orders.assign_shops": "షాప్‌లను కేటాయించండి",
  "orders.part_assign_left": "{boxes} మిగిలి ఉన్నాయి",
  "orders.vehicles_waiting": "షాప్‌ల కోసం వేచి ఉన్నవి",
  "orders.vehicle_list_assigned": "షాప్‌లు కేటాయించబడ్డాయి",
  "orders.vehicles_count": "{pending} పెండింగ్ · {saved} సేవ్",
  "orders.boxes_short": "బాక్స్‌లు",
  "orders.vehicle_shops_assigned": "{n} షాప్‌లు కేటాయించబడ్డాయి",
  "orders.vehicle_shops_none": "ఇంకా షాప్‌లు లేవు",
  "orders.sequence_empty_hint": "ఈ వాహనానికి డెలివరీ క్రమం సిద్ధం చేయడానికి పైన షాప్‌లను ఎంచుకోండి — వరుస కోసం వరుసలను లాగండి, ఆపై Save Progress లేదా Review & Submit నొక్కండి.",
  "orders.col_available": "అందుబాటులో",
  "orders.hdr_mobile": "మొబైల్",
  "orders.hdr_ord_birds": "ఆర్డర్ పక్షులు",
  "orders.hdr_del_birds": "డెలివరీ పక్షులు",
  "orders.hdr_diff_birds": "తేడా (పక్షులు)",
  "orders.hdr_ord_boxes": "ఆర్డర్ బాక్సులు",
  "orders.hdr_del_boxes": "డెలివరీ బాక్సులు",
  "orders.hdr_diff_boxes": "తేడా (బాక్సులు)",
  "orders.hdr_status": "స్థితి",
  "orders.hdr_delivered_at": "డెలివరీ సమయం",
  "orders.pending_boxes_hint": "ఇంకా {boxes} బాక్సులు డెలివరీ చేయాలి",
  "orders.pdf_check_summary": "రిపోర్ట్ సారాంశం",
  "orders.delivered_shops": "డెలివరీ అయిన షాప్‌లు",
  "orders.pdf_saved_btn": "సేవ్ అయింది",
  "orders.pdf_shop_details": "షాప్ వివరాలు",
  "orders.pdf_order_date": "ఆర్డర్ తేదీ",
  "orders.pdf_save_progress": "పురోగతి సేవ్ చేయండి",
  "orders.pdf_submit": "సబ్మిట్",
  "orders.pdf_saved_ok": "పురోగతి సేవ్ అయింది",
  "orders.pdf_submitted_ok": "డెలివరీ సబ్మిట్ అయింది — ట్రిప్ ఇప్పుడు Completed",
  "orders.pdf_submit_blocked": "సబ్మిట్ చేసే ముందు కనీసం ఒక షాప్‌కు డెలివరీ ఇవ్వండి",
  "orders.pdf_building": "రిపోర్ట్ తయారవుతోంది…",
  "orders.pdf_pages": "{pages} పేజీ(లు)",
  "orders.pdf_download": "PDF డౌన్‌లోడ్",
  "orders.pdf_send_whatsapp": "WhatsApp లో పంపండి",
  "orders.pdf_correct": "డెలివరీలను సరిచేయండి",
  "orders.sending": "పంపుతోంది…",
  "orders.pdf_sent_ok": "రిపోర్ట్ WhatsApp లో పంపబడింది — {sent} షాప్‌లు",
  "orders.pdf_sent_partial": "{sent} షాప్‌లకు పంపబడింది — {failed} విఫలమయ్యాయి",
  "orders.whatsapp_sending": "{shop}కు పంపబడుతోంది…",
  "orders.whatsapp_done": "WhatsApp {total} షాప్‌లలో {sent}కు పంపబడింది",
  "orders.whatsapp_partial": "WhatsApp {sent} షాప్‌లకు పంపబడింది, {failed} విఫలమైంది",
  "orders.whatsapp_failed": "WhatsApp విఫలం: {message}",
  "orders.whatsapp_not_configured": "WhatsApp బ్యాకెండ్ సక్రిమం చేయబడలేదు (VITE_WHATSAPP_BACKEND_ENABLED)",
  "orders.whatsapp_no_rows": "ఇంకా పంపాల్సిన షాప్‌లు లేవు — ముందు షాప్‌లు జోడించండి",
  "orders.loading": "ఆర్డర్లు లోడ్ అవుతున్నాయి…",
  "orders.sample_badge": "నమూనా డేటా",
  "orders.sample_hint":
    "నమూనా డేటా చూపబడుతోంది — బ్యాకెండ్ కనెక్ట్ కాలేదు. సేవ్, ఫినిష్, అసైన్‌మెంట్ మెమరీలో పని చేస్తాయి; రిఫ్రెష్ చేస్తే మళ్లీ మొదటి స్థితికి వస్తాయి.",
  "orders.error_title": "ఆర్డర్లను లోడ్ చేయలేకపోయాను",
  "orders.error_message": "బ్యాకెండ్ సమాధానం ఇవ్వలేదు. కనెక్షన్ తనిఖీ చేసి మళ్లీ ప్రయత్నించండి.",
  "orders.retry": "మళ్లీ ప్రయత్నించండి",
  "orders.refresh_failed": "ఆర్డర్ల డేటాను రిఫ్రెష్ చేయలేకపోయాను",
  "orders.unsaved_changes": "సేవ్ చేయப்படని మార్పులు",
  "orders.confirm_discard_title": "సేవ్ చేయని మార్పులను తీసివేయాలా?",
  "orders.confirm_discard_message":
    "మీ సేవ్ చేయని నమోదులు తొలగిపోతాయి. సేవ్ చేసిన ప్రగతి ఉంటుంది.",
  "orders.discard": "మార్పులను తీసివేయండి",
  "orders.close": "మూసివేయండి",

  // Day scroller
  "orders.day_label": "పని రోజు",
  "orders.day_prev": "మునుపటి రోజు",
  "orders.day_next": "తర్వాత రోజు",
  "orders.locked": "లాక్",
  "orders.closed_day": "మూసి వేయబడింది",
  "orders.read_only_note": "ఈ పని రోజు మూసి వేయబడింది — చూడటం మాత్రమే.",
  "orders.auto_closed_note":
    "సేకరణ {deadline}కు ఆటోమేటిక్‌గా మూసివేయబడింది — చూడటం మాత్రమే.",
  "orders.no_collection_day": "{day} కి ఆర్డర్ సేకరణ లేదు",
  "orders.collection_complete": "పూర్తయింది",
  "orders.finish_collection_locked":
    "ఈ రోజు సేకరణ పూర్తయింది — మరిన్ని మార్పులు లేవు",

  // Collection table
  "orders.col_trip_assignment": "ట్రిప్ / కేటాయింపు",
  "orders.not_assigned": "కేటాయించబడలేదు",
  "orders.seq_n": "సీక్వెన్స్ {n}",
  "orders.assigned_to_vehicle": "{vehicle} · సీక్వెన్స్ {n}",
  "orders.status_delivered_diff": "వ్యత్యాసంతో పంపిణీ చేయబడింది",
  "orders.status_part_delivered": "పాక్షికంగా పంపిణీ",
  "orders.status_not_delivered": "నివ్వబడలేదు",
  // షాప్ స్థాయి డెలివరీ ఎంట్రీ (ట్యాబ్ 3 నివేదిక — చివరి నిలువు వరుస).
  "orders.record_delivery": "డెలివరీ ఎంట్రీ",
  "orders.deliver": "డెలివర్",
  "orders.balance": "మిగిలినవి",
  "orders.delivery_balance_hint": "{remaining} బాక్స్‌ల వరకు నమోదు చేయండి (షాప్ బ్యాలెన్స్)",
  "orders.delivery_complete": "పూర్తయింది",
  "orders.delivery_saved_partial": "{boxes} బాక్స్‌లు డెలివర్ అయ్యాయి — {shop}",
  "orders.status_not_listed": "పట్టికలో లేదు",
  "orders.status_ordered": "ఆర్డర్ చేయబడింది",
  "orders.col_order_status": "ఆర్డర్ స్థితి",
  "orders.not_listed_deliveries": "పట్టికలో లేని షాప్ల డెలివరీలు",
  "orders.search_report": "షాప్, సిటీ, స్థితి వెతకండి…",
  "orders.pool_summary":
    "{collected} సేకరించబడింది · {assigned} కేటాయించబడింది · {available} అందుబాటులో",

  // Tab 2: shop selection
  "orders.available_shops": "అందుబాటులో ఉన్న షాపులు",
  "orders.selected_for_vehicle": "వాహనానికి ఎంపిక చేసినవి",
  "orders.select_col": "ఎంచుకోండి",
  "orders.select_vehicle_first":
    "{day} కి అందుబాటులో ఉన్న షాపులను చూడటానికి వాహనాన్ని ఎంచుకోండి",
  "orders.selection_empty":
    "ఈ వాహనం డెలివరీ క్రమాన్ని రూపొందించడానికి షాపులను ఎంచుకోండి",
  "orders.assigned_elsewhere": "కేటాయించబడింది — {trip} ({vehicle})",
  "orders.day_assignments": "{day} కేటాయింపులు",
  "orders.vehicles_assigned": "{vehicles} వాహనాలు · {shops} షాపులు కేటాయించబడ్డాయి",
  "orders.conflict_message":
    "{shops} ఇప్పటికే ఈ రోజుకి వేరే వాహనానికి కేటాయించబడ్డాయి. ఎంపిక పునరుద్ధరించబడింది.",
  // స్ప్లిట్ ఆర్డర్ (వాహనాల మధ్య పాక్షిక కేటాయింపు) — హార్డ్ బ్యాలెన్స్ క్యాప్.
  "orders.status_pending_assign": "కేటాయింపు పెండింగ్‌లో",
  "orders.status_part_assigned": "పాక్షికంగా కేటాయించబడింది",
  "orders.on_other_vehicles": "{boxes} ఇతర వాహనాలపై",
  "orders.over_assign_message":
    "కేటాయించని బాక్స్‌లు సరిపోవు: {shops}. విలువలు మిగిలిన బ్యాలెన్స్‌కు సరిచేయబడ్డాయి.",
  // వాట్సాప్ చెక్-పాప్‌అప్ + షాప్ అసైన్‌మెంట్ షీట్ PDF.
  "orders.wa_check_title": "రివ్యూ & సబ్మిట్",
  "orders.sheet_language": "భాష",
  "orders.lang_english": "English",
  "orders.lang_telugu": "తెలుగు",
  "orders.pdf_seq": "క్రమం",
  "orders.pdf_page": "పేజీ {p} / {n}",
  "orders.pdf_generated": "తయారు: {when}",
  "orders.wa_message_preview": "సందేశం మునుజూపు (ఇదే సందేశం పంపబడుతుంది)",
  "orders.wa_send_note":
    "ఈ కేటాయింపును సూపర్‌వైజర్‌కు వాట్సాప్‌లో పంపుతుంది — ప్రతి షాప్‌కు ఒక సందేశం, దాని డెలివరీ PDFతో.",
  "orders.wa_confirm_send": "నిర్ధారించి పంపండి",
  "orders.wa_send_to": "పంపాల్సిన నంబర్",
  "orders.assignment_sheet_title": "షాప్ అసైన్‌మెంట్ షీట్",
  "orders.assignment_details": "కేటాయింపు వివరాలు",
  "orders.col_assigned_boxes": "కేటాయించిన బాక్స్‌లు",
  "orders.est_weight": "అంచనా బరువు",
  "orders.shops_to_deliver": "డెలివరీ చేయాల్సిన షాప్‌లు (క్రమంలో)",
  "orders.assignment_sheet_sub": "{shops} షాప్‌లు · {boxes} బాక్స్‌లు",
  "orders.sequence_empty": "షాప్‌లు ఎంపిక చేయలేదు",

  // Differences
  "orders.col_difference": "వ్యత్యాసం",
  "orders.word_box": "బాక్స్",
  "orders.word_boxes": "బాక్స్",
  "orders.word_bird": "పక్షి",
  "orders.word_birds": "పక్షులు",

  // Delivery tracking: two-table layout
  "orders.tracking_active_title": "పెండింగ్ & ప్రగతిలో",
  "orders.tracking_completed_title": "పూర్తయినవి",
  "orders.col_progress": "ప్రగతి",
  "orders.col_completed_at": "పూర్తయిన సమయం",
  "orders.status_complete": "పూర్తయింది",
  "orders.no_pending_deliveries": "పెండింగ్ డెలివరీలు లేవు",
  "orders.no_completed_window": "చివరి 7 రోజులలో పూర్తయిన ట్రిప్‌లు లేవు",
  "orders.no_search_results": "మీ వెతకడానికి సరిపోలే షాప్‌లు లేవు",
  "orders.no_filter_results": "ఈ ఫిల్టర్‌కు సరిపోయే షాప్‌లు లేవు",
  "orders.search_collection": "షాప్, సిటీ, ట్రిప్, వాహనం, స్థితి వెతకండి…",
  "orders.search_assignment": "షాప్, సిటీ, ట్రిప్, వాహనం, సూపర్‌వైజర్ వెతకండి…",
  "orders.search_tracking": "షాప్, సిటీ, ట్రిప్, వాహనం, సూపర్‌వైజర్, స్థితి వెతకండి…",
  "orders.filter_status": "స్థితి",
  "orders.filter_difference": "వ్యత్యాసం",
  "orders.all": "అన్నీ",
  "orders.delivered_with_difference": "వ్యత్యాసంతో డెలివరీ",
  "orders.no_difference": "వ్యత్యాసం లేదు",
  "orders.short_delivery": "పాక్షిక డెలివరీ",
  "orders.extra_delivery": "అదనపు డెలివరీ",

  // Global date selector
  "orders.today_chip": "ఈరోజు",
  "orders.no_orders_for_day": "{date} కు సేకరించిన ఆర్డర్లు లేవు",

  // Delivery detail report: weight columns + totals
  "orders.ordered_weight": "ఆర్డర్ బరువు",
  "orders.delivered_weight": "డెలివర్డ్ బరువు",
  "orders.weight_kg": "బరువు (కేజీ)",
  "orders.total_ordered": "మొత్తం ఆర్డర్",
  "orders.total_delivered": "మొత్తం డెలివర్డ్",

  // Table-level refresh (soft notification)
  "orders.refresh": "రిఫ్రెష్",
  "orders.refresh_collection": "ఆర్డర్లు రిఫ్రెష్ అయ్యాయి",
  "orders.refresh_assignment": "అసైన్‌మెంట్ డేటా రిఫ్రెష్ అయ్యంది",
  "orders.refresh_tracking": "డెలివరీ ట్రాకింగ్ రిఫ్రెష్ అయింది",

  // Collection table sort
  "orders.sort": "వరుస",
  "orders.sort_collected_first": "సేకరించినవి ముందు",
  "orders.sort_name_az": "షాప్ పేరు A → Z",
  "orders.sort_name_za": "షాప్ పేరు Z → A",

  // Collection statuses + assignment/tracking additions (polish round 2)
  "orders.status_not_collected": "సేకరించలేదు",
  "orders.status_collected": "సేకరించబడింది",
  "orders.available": "అందుబాటులో",
  "orders.available_collected_shops": "అందుబాటులో ఉన్న సేకరించిన షాప్‌లు",
  "orders.selected_shops": "ఎంచుకున్న షాప్‌లు",
  "orders.selected_count": "{n} ఎంచుకోబడ్డాయి",
  "orders.total_birds": "మొత్తం పక్షులు",
  "orders.total_boxes": "మొత్తం బాక్స్‌లు",
  "orders.total_weight": "మొత్తం బరువు (కేజీ)",
  "orders.delivery_time": "డెలివరీ సమయం",
  "orders.weight": "బరువు",
  "orders.requested": "రిక్వెస్టెడ్",
  "orders.already_assigned": "ఇప్పటికే అసైన్ చేసినవి",
  "orders.capacity_exceeded_line": "కెపాసిటీ మించింది. అసైన్ చేసిన బాక్స్‌లను తగ్గించండి.",
  "orders.not_listed_note": "ఈ షాప్ స్టెప్ 4 సమయంలో డెలివర్ అయింది కానీ అసలు సేకరించిన ఆర్డర్‌లో లేదు.",
  "orders.shop_mobile": "షాప్ మొబైల్",
  "orders.from_date": "మొదలు",
  "orders.to_date": "వరకు",
  "orders.trips_count": "{x} ట్రిప్‌లు",
  "orders.collected_shops": "సేకరించిన షాప్‌లు",
  // పూల్ సెర్చ్ + ఫిల్టర్ (ఒక రోజుకు ~100 షాప్‌లు ఉండవచ్చు).
  "orders.search_pool": "షాప్, సిటీ, వాహనం, ట్రిప్ వెతకండి…",
  "orders.filter_shops": "షాప్‌లను ఫిల్టర్ చేయండి",
  "orders.filter_city": "సిటీ",
  "orders.filter_city_all": "అన్ని సిటీలు",
  "orders.pool_filter_all": "అన్ని షాప్‌లు",
  "orders.pool_filter_pending": "పెండింగ్ (కేటాయించలేదు)",
  "orders.pool_filter_assigned": "కేటాయించినవి (ఏ వాహనమైనా)",
  "orders.pool_filter_this_vehicle": "ఈ వాహనంపై",
  "orders.pool_showing": "{total} షాప్‌లలో {shown} · {selected} ఎంపిక చేయబడ్డాయి",
  "orders.vehicle_trip": "వాహనం / ట్రిప్",
  "orders.sort_pending_first": "పెండింగ్ ముందు",
  "orders.sort_vehicle_trip": "వాహనం / ట్రిప్",
  "orders.listed_shops": "లిస్టెడ్ షాప్‌లు",
  "orders.not_listed_shops": "పట్టికలో లేని షాప్‌లు",
  "orders.box_difference": "బాక్స్ తేడా",
  "orders.pdf_report_title": "షాప్ డెలివరీ రిపోర్ట్",
  "orders.pdf_order_no": "ఆర్డర్ నంబర్",
  "orders.pdf_totals": "మొత్తాలు",
};

export type OrdersT = (key: string, params?: Record<string, string | number>) => string;

function interpolate(text: string, params?: Record<string, string | number>): string {
  if (!params) return text;
  let out = text;
  for (const [k, v] of Object.entries(params)) {
    out = out.split(`{${k}}`).join(String(v));
  }
  return out;
}

/** Translate Orders keys: Orders dict (language-aware, EN fallback) → shared t. */
export function useOrdersI18n() {
  const { language, t } = useI18n();
  const to = useCallback<OrdersT>(
    (key, params) => {
      const dict: Record<string, string> = language === "te" ? TE : EN;
      const raw = dict[key] ?? EN[key] ?? key;
      const translated = raw === key ? t(key) : raw;
      return interpolate(translated, params);
    },
    [language, t]
  );
  return { to, language, t };
}

/** Non-hook variant for services / PDF / WhatsApp (mirrors i18n `translate`). */
export function ordersTranslate(
  key: string,
  language: Language = "en",
  params?: Record<string, string | number>
): string {
  const dict: Record<string, string> = language === "te" ? TE : EN;
  return interpolate(dict[key] ?? EN[key] ?? key, params);
}
