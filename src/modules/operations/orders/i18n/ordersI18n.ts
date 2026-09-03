// src/modules/operations/orders/i18n/ordersI18n.ts
// Orders-specific translations in NEW files (no global i18n files touched).
// Falls back to the shared `t()` for common keys and to English for any
// Orders key missing in Telugu — so a raw key is never rendered.

import { useCallback } from "react";
import { useI18n, type Language } from "../../../../i18n";

const EN: Record<string, string> = {
  // Tabs
  "orders.title": "Orders",
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
  "orders.col_city": "City",
  "orders.col_owner": "Owner",
  "orders.col_mobile": "Mobile",
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
  "orders.save": "Save",
  "orders.edit_entry": "Edit {shop}",
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
  "orders.no_eligible_vehicles":
    "No vehicle trips available for assignment. Create a trip with Step 2 (Farm) completed in Vehicle Trip Entry first.",
  "orders.vehicle_locked":
    "This order already has assignments on {vehicle} — continue the assignment there.",
  "orders.vehicle_no": "Vehicle No",
  "orders.farm_address": "Farm Address",
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
  "orders.assigned_boxes": "Assigned",
  "orders.assign_hint":
    "Reorder the delivery sequence and set the boxes each shop receives from this vehicle.",
  "orders.capacity_exceeded_title": "Vehicle box capacity exceeded",
  "orders.capacity_exceeded":
    "Vehicle Capacity: {capacity} · Already Assigned: {assigned} · Available: {available} · Requested: {requested}",
  "orders.finish_assignment_invalid":
    "Assign at least 1 box to every shop before finishing the assignment",
  "orders.assignment_saved": "Assignment progress saved",
  "orders.assignment_finished": "Assignment submitted successfully",
  "orders.finish_assignment": "Finish Assignment",

  // ── Tab 3 · Delivery Tracking ─────────────────────────────────────────
  "orders.tracking_empty": "No orders in the selected date range",
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
  "orders.whatsapp": "WhatsApp",
  "orders.pdf_generating": "Generating PDF…",
  "orders.pdf_ready": "Order PDF generated",
  "orders.pdf_failed": "Unable to generate the PDF",
  "orders.whatsapp_sending": "Sending to {shop}…",
  "orders.whatsapp_done": "WhatsApp sent for {sent} of {total} shops",
  "orders.whatsapp_partial": "WhatsApp sent for {sent}, {failed} failed",
  "orders.whatsapp_failed": "WhatsApp failed: {message}",
  "orders.whatsapp_not_configured":
    "WhatsApp backend is not configured (VITE_WHATSAPP_BACKEND_ENABLED)",
  "orders.whatsapp_no_rows": "No shops to send yet — add shops first",
  "orders.loading": "Loading orders…",
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
  "orders.status_not_delivered": "NOT DELIVERED",
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
    "orders.search_collection": "Search shop, city, order no, trip, vehicle…",
    "orders.search_assignment": "Search shop, city, order no, trip, vehicle…",
    "orders.search_tracking": "Search shop, city, order no, trip, vehicle…",
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
  "orders.status_auto_completed": "Auto Completed",
  "orders.auto_finished_note": "Collection was automatically completed after the daily cutoff.",
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
  "orders.vehicle_trip": "Vehicle / Trip",
  "orders.sort_pending_first": "Pending First",
  "orders.sort_vehicle_trip": "Vehicle / Trip",
  "orders.listed_shops": "Listed Shops",
  "orders.not_listed_shops": "Not Listed Shops",
  "orders.box_difference": "Box Difference",
  // ── Collection working-sheet controls (sort / filled-only / empty) ──
  "orders.sort_by": "Sort By",
  "orders.sort_shop_az": "Shop Name A → Z",
  "orders.sort_shop_za": "Shop Name Z → A",
  "orders.sort_city_az": "City A → Z",
  "orders.sort_city_za": "City Z → A",
  "orders.sort_required_desc": "Required Boxes — High to Low",
  "orders.sort_required_asc": "Required Boxes — Low to High",
  "orders.sort_loaded_desc": "Loaded / Picked Up — High to Low",
  "orders.sort_pending_desc": "Pending Boxes — High to Low",
  "orders.sort_delivered_desc": "Delivered Boxes — High to Low",
  "orders.sort_remaining_desc": "Remaining Boxes — High to Low",
  "orders.filled_only": "Filled Only",
  "orders.no_shops_available": "No shops available for this date.",
  "orders.no_filled_shops": "No shops have entered collection data yet.",
  "orders.working_sheet_hint":
    "Enter No. of Birds and No. of Boxes for each shop. Save Progress keeps you here; Finish Collection finalises the day.",
  // ── Orders backend module (server-side list / assignment / tracking) ──
  "orders.tabs_aria": "Orders sections",
  "orders.col_required_boxes": "Required Boxes",
  "orders.col_pickup_boxes": "Pickup Boxes",
  "orders.col_pending_boxes": "Pending Boxes",
  "orders.col_remaining_boxes": "Remaining Boxes",
  "orders.col_trip": "Trip No",
  "orders.col_vehicle": "Vehicle No",
  "orders.status_partially_delivered": "Partially Delivered",
  "orders.metric_shops": "Total Shops",
  "orders.metric_shops_with_orders": "Shops With Orders",
  "orders.metric_required": "Required Boxes",
  "orders.metric_loaded": "Loaded / Picked Up",
  "orders.metric_pending": "Pending Boxes",
  "orders.metric_delivered": "Delivered Boxes",
  "orders.metric_remaining": "Remaining Boxes",
  "orders.metric_delivered_shops": "Delivered Shops",
  "orders.metric_capacity": "Vehicle Capacity",
  "orders.metric_available": "Available Boxes",

  // ── Tab 2 · Order Assignment — dedicated KPI board ────────────────────
  // Six tiles: shops ordered/assigned/pending, then boxes ordered/assigned/
  // pending. Every figure is the SERVER's own summary for the selected day
  // (not the visible page), so ordered = assigned + pending always holds.
  "orders.kpi_board_aria": "Order assignment key figures",
  "orders.kpi_shops_ordered": "Shops Ordered",
  "orders.kpi_shops_assigned": "Assigned Shops",
  "orders.kpi_shops_pending": "Pending Shops",
  "orders.kpi_boxes_ordered": "Boxes Ordered",
  "orders.kpi_boxes_assigned": "Assigned Boxes",
  "orders.kpi_boxes_pending": "Pending Boxes",
  "orders.kpi_unsaved": "{value} after saving",
  "orders.kpi_syncing": "Updating…",
  "orders.kpi_trip_capacity": "Capacity",
  "orders.kpi_trip_loaded": "Loaded",
  "orders.kpi_trip_available": "Available",
  "orders.kpi_trip_over": "Over capacity by {value} boxes",

  // Vehicle details table + the loaded-shop list it opens
  "orders.vehicle_details": "Vehicle Details",
  "orders.vehicle_selected": "Assigning",
  "orders.assign_shops": "Assign Shops",
  "orders.close_assign": "Close",
  "orders.expand_to_assign": "Expand a vehicle to assign shops to it.",
  "orders.cross_date_note": "Assigning {orderDate} orders to a trip raised on {tripDate}.",
  "orders.col_load": "Load",
  "orders.col_open_boxes": "Open Boxes",
  "orders.view_loaded_shops": "View Loaded Shops",
  "orders.loaded_shops_title": "Loaded Shops",
  "orders.loaded_shops_section": "Shops loaded on this vehicle",
  "orders.loaded_shops_count": "{shops} shops · {boxes} boxes",
  "orders.loaded_shops_total": "Total — {shops} shops",
  "orders.loaded_shops_unsaved":
    "Unsaved pickup changes are not included — save the assignment to see them here.",
  "orders.search_loaded_shops": "Search shop, owner, city, mobile, order no",
  "orders.no_loaded_shops": "No shop is loaded on this vehicle yet",
  "orders.no_loaded_shops_hint":
    "Enter pickup boxes for at least one shop and save the assignment.",
  "orders.no_loaded_shops_match": "No loaded shop matches this search",
  "orders.pagination_range": "{from}–{to} of {total}",
  "orders.rows_per_page": "{size} / page",
  "orders.rows_per_page_label": "Rows per page",
  "orders.from": "From",
  "orders.to": "To",
  "orders.add_shop": "Add a shop to this day's order",
  "orders.remove_added_shop": "Remove this shop",
  "orders.delete_entry": "Delete order for {shop}",
  "orders.add_order_aria": "Add another order for {shop}",
  "orders.offline_waiting":
    "Waiting to sync — the server is unreachable. Your changes are kept and will retry when the connection returns.",
  "orders.draft_restored": "Restored your unsaved changes",
  "orders.entry_deleted": "Order line deleted",
  "orders.delete_failed": "Could not delete — the backend rejected it",
  "orders.save_failed": "Could not save — the backend rejected it",
  "orders.load_failed": "Could not load the delivery details",
  "orders.conflict_refresh": "Data changed by another user. Refreshing the latest collection.",
  "orders.nothing_to_save": "Nothing changed yet",
  "orders.assign_at_least_one_shop": "Assign at least one shop before finishing",
  "orders.assignment_removed": "Shop removed from the assignment",
  "orders.remove_assignment": "Remove {shop} from this vehicle",
  "orders.max_hint": "min {min} · max {max}",
  "orders.trip_locked": "This trip is completed — its assignment is locked",
  "orders.channel_email": "Email",
  "orders.channel_whatsapp": "WhatsApp",
  "orders.notify_sent": "Sent to {recipient}",
  "orders.notify_not_sent": "Not sent",
  "orders.view_delivery": "View delivery details",
  "orders.download_pdf": "Download PDF",
  "orders.send_whatsapp": "Send on WhatsApp",
  "orders.whatsapp_completed_only": "WhatsApp is available once the trip is Completed",
  "orders.pdf_report_title": "SHOP DELIVERY REPORT",
  "orders.pdf_totals": "TOTALS",
};

const TE: Record<string, string> = {
  // Tabs
  "orders.title": "ఆర్డర్లు",
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
  "orders.col_city": "నగరం",
  "orders.col_owner": "యజమాని",
  "orders.col_mobile": "మొబైల్",
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
  "orders.save": "సేవ్",
  "orders.edit_entry": "{shop} సవరించండి",
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
  "orders.no_eligible_vehicles":
    "అసైన్‌మెంట్‌కు అందుబాటులో ఉన్న వాహన ట్రిప్‌లు లేవు. ముందు వాహన ట్రిప్ ఎంట్రీలో స్టెప్ 2 (ఫామ్) పూర్తి చేసిన ట్రిప్ సృష్టించండి.",
  "orders.vehicle_locked":
    "ఈ ఆర్డర్‌కు ఇప్పటికే {vehicle} పై అసైన్‌మెంట్‌లు ఉన్నాయి — అక్కడ కొనసాగించండి.",
  "orders.vehicle_no": "వాహన నంబర్",
  "orders.farm_address": "ఫామ్ చిరునామా",
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
  "orders.whatsapp": "WhatsApp",
  "orders.pdf_generating": "PDF ఉత్పత్తి అవుతోంది…",
  "orders.pdf_ready": "ఆర్డర్స్ PDF ఉత్పత్తి చేయబడింది",
  "orders.pdf_failed": "PDF ఉత్పత్తి చేయలేకపోయాను",
  "orders.whatsapp_sending": "{shop}కు పంపబడుతోంది…",
  "orders.whatsapp_done": "WhatsApp {total} షాప్‌లలో {sent}కు పంపబడింది",
  "orders.whatsapp_partial": "WhatsApp {sent} షాప్‌లకు పంపబడింది, {failed} విఫలమైంది",
  "orders.whatsapp_failed": "WhatsApp విఫలం: {message}",
  "orders.whatsapp_not_configured": "WhatsApp బ్యాకెండ్ సక్రిమం చేయబడలేదు (VITE_WHATSAPP_BACKEND_ENABLED)",
  "orders.whatsapp_no_rows": "ఇంకా పంపాల్సిన షాప్‌లు లేవు — ముందు షాప్‌లు జోడించండి",
  "orders.loading": "ఆర్డర్లు లోడ్ అవుతున్నాయి…",
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
  "orders.status_not_delivered": "నివ్వబడలేదు",
  "orders.status_not_listed": "పట్టికలో లేదు",
  "orders.status_ordered": "ఆర్డర్ చేయబడింది",
  "orders.col_order_status": "ఆర్డర్ స్థితి",
  "orders.not_listed_deliveries": "పట్టికలో లేని షాప్ల డెలివరీలు",
  "orders.search_report": "షాప్, నగరం, స్థితి వెతకండి…",
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
  "orders.search_collection": "షాప్, నగరం, ట్రిప్, వాహనం, స్థితి వెతకండి…",
  "orders.search_assignment": "షాప్, నగరం, ట్రిప్, వాహనం, సూపర్‌వైజర్ వెతకండి…",
  "orders.search_tracking": "షాప్, నగరం, ట్రిప్, వాహనం, సూపర్‌వైజర్, స్థితి వెతకండి…",
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
  "orders.status_auto_completed": "స్వయంచాలకంగా పూర్తయింది",
  "orders.auto_finished_note": "రోజువారీ గడువు తర్వాత సేకరణ స్వయంచాలకంగా పూర్తయింది.",
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
  "orders.vehicle_trip": "వాహనం / ట్రిప్",
  "orders.sort_pending_first": "పెండింగ్ ముందు",
  "orders.sort_vehicle_trip": "వాహనం / ట్రిప్",
  "orders.listed_shops": "లిస్టెడ్ షాప్‌లు",
  "orders.not_listed_shops": "పట్టికలో లేని షాప్‌లు",
  "orders.box_difference": "బాక్స్ తేడా",
  // ── Collection working-sheet controls (sort / filled-only / empty) ──
  "orders.sort_by": "వరుస ప్రకారం",
  "orders.sort_shop_az": "షాప్ పేరు A → Z",
  "orders.sort_shop_za": "షాప్ పేరు Z → A",
  "orders.sort_city_az": "నగరం A → Z",
  "orders.sort_city_za": "నగరం Z → A",
  "orders.sort_required_desc": "అవసరమైన బాక్స్‌లు — ఎక్కువ నుండి తక్కువ",
  "orders.sort_required_asc": "అవసరమైన బాక్స్‌లు — తక్కువ నుండి ఎక్కువ",
  "orders.sort_loaded_desc": "లోడ్ చేసినవి — ఎక్కువ నుండి తక్కువ",
  "orders.sort_pending_desc": "పెండింగ్ బాక్స్‌లు — ఎక్కువ నుండి తక్కువ",
  "orders.sort_delivered_desc": "డెలివరీ అయినవి — ఎక్కువ నుండి తక్కువ",
  "orders.sort_remaining_desc": "మిగిలినవి — ఎక్కువ నుండి తక్కువ",
  "orders.filled_only": "నమోదు చేసినవి మాత్రమే",
  "orders.no_shops_available": "ఈ తేదీకి షాప్‌లు అందుబాటులో లేవు.",
  "orders.no_filled_shops": "ఇంకా ఏ షాప్ సేకరణ డేటా నమోదు చేయలేదు.",
  "orders.working_sheet_hint":
    "ప్రతి షాప్‌కు పక్షుల సంఖ్య మరియు బాక్స్‌ల సంఖ్య నమోదు చేయండి. సేవ్ ప్రోగ్రెస్ ఇక్కడే ఉంటుంది; ఫినిష్ కలెక్షన్ రోజును ఖరారు చేస్తుంది.",
  "orders.pdf_report_title": "షాప్ డెలివరీ రిపోర్ట్",
  "orders.pdf_totals": "మొత్తాలు",

  "orders.tabs_aria": "ఆర్డర్ విభాగాలు",
  "orders.col_required_boxes": "అవసరమైన బాక్స్‌లు",
  "orders.col_pickup_boxes": "పికప్ బాక్స్‌లు",
  "orders.col_pending_boxes": "పెండింగ్ బాక్స్‌లు",
  "orders.col_remaining_boxes": "మిగిలిన బాక్స్‌లు",
  "orders.col_trip": "ట్రిప్ నం",
  "orders.col_vehicle": "వాహన నం",
  "orders.status_partially_delivered": "పాక్షికంగా డెలివరీ",
  "orders.metric_shops": "మొత్తం షాప్‌లు",
  "orders.metric_shops_with_orders": "ఆర్డర్లు ఉన్న షాప్‌లు",
  "orders.metric_required": "అవసరమైన బాక్స్‌లు",
  "orders.metric_loaded": "లోడ్ చేసినవి",
  "orders.metric_pending": "పెండింగ్ బాక్స్‌లు",
  "orders.metric_delivered": "డెలివరీ అయినవి",
  "orders.metric_remaining": "మిగిలినవి",
  "orders.metric_delivered_shops": "డెలివరీ అయిన షాప్‌లు",
  "orders.metric_capacity": "వాహన సామర్థ్యం",
  "orders.metric_available": "అందుబాటులో ఉన్న బాక్స్‌లు",

  // ── Tab 2 · Order Assignment — dedicated KPI board ────────────────────
  "orders.kpi_board_aria": "ఆర్డర్ కేటాయింపు ముఖ్య గణాంకాలు",
  "orders.kpi_shops_ordered": "ఆర్డర్ ఇచ్చిన షాప్‌లు",
  "orders.kpi_shops_assigned": "కేటాయించిన షాప్‌లు",
  "orders.kpi_shops_pending": "పెండింగ్ షాప్‌లు",
  "orders.kpi_boxes_ordered": "ఆర్డర్ చేసిన బాక్స్‌లు",
  "orders.kpi_boxes_assigned": "కేటాయించిన బాక్స్‌లు",
  "orders.kpi_boxes_pending": "పెండింగ్ బాక్స్‌లు",
  "orders.kpi_unsaved": "సేవ్ తర్వాత {value}",
  "orders.kpi_syncing": "నవీకరిస్తోంది…",
  "orders.kpi_trip_capacity": "సామర్థ్యం",
  "orders.kpi_trip_loaded": "లోడ్ చేసినవి",
  "orders.kpi_trip_available": "అందుబాటులో",
  "orders.kpi_trip_over": "సామర్థ్యం కంటే {value} బాక్స్‌లు ఎక్కువ",

  // Vehicle details table + the loaded-shop list it opens
  "orders.vehicle_details": "వాహన వివరాలు",
  "orders.vehicle_selected": "కేటాయిస్తోంది",
  "orders.assign_shops": "షాప్‌లను కేటాయించండి",
  "orders.close_assign": "మూసివేయండి",
  "orders.expand_to_assign": "షాప్‌లను కేటాయించడానికి ఒక వాహనాన్ని విస్తరించండి.",
  "orders.cross_date_note": "{orderDate} ఆర్డర్లను {tripDate} ట్రిప్‌కు కేటాయిస్తున్నారు.",
  "orders.col_load": "లోడ్",
  "orders.col_open_boxes": "మిగిలిన బాక్స్‌లు",
  "orders.view_loaded_shops": "లోడ్ చేసిన షాప్‌లు చూడండి",
  "orders.loaded_shops_title": "లోడ్ చేసిన షాప్‌లు",
  "orders.loaded_shops_section": "ఈ వాహనంలో లోడ్ చేసిన షాప్‌లు",
  "orders.loaded_shops_count": "{shops} షాప్‌లు · {boxes} బాక్స్‌లు",
  "orders.loaded_shops_total": "మొత్తం — {shops} షాప్‌లు",
  "orders.loaded_shops_unsaved":
    "సేవ్ చేయని పికప్ మార్పులు ఇందులో లేవు — ఇక్కడ చూడటానికి కేటాయింపును సేవ్ చేయండి.",
  "orders.search_loaded_shops": "షాప్, యజమాని, నగరం, మొబైల్, ఆర్డర్ నం వెతకండి",
  "orders.no_loaded_shops": "ఈ వాహనంలో ఇంకా ఏ షాప్ లోడ్ కాలేదు",
  "orders.no_loaded_shops_hint":
    "కనీసం ఒక షాప్‌కు పికప్ బాక్స్‌లు నమోదు చేసి కేటాయింపును సేవ్ చేయండి.",
  "orders.no_loaded_shops_match": "ఈ శోధనకు సరిపోయే లోడ్ చేసిన షాప్ లేదు",
  "orders.pagination_range": "{total}లో {from}–{to}",
  "orders.rows_per_page": "{size} / పేజీ",
  "orders.rows_per_page_label": "పేజీకి వరుసలు",
  "orders.from": "నుండి",
  "orders.to": "వరకు",
  "orders.add_shop": "ఈ రోజు ఆర్డర్‌కు షాప్ జోడించండి",
  "orders.remove_added_shop": "ఈ షాప్‌ను తొలగించండి",
  "orders.delete_entry": "{shop} ఆర్డర్‌ను తొలగించండి",
  "orders.add_order_aria": "{shop} కోసం మరో ఆర్డర్ జోడించండి",
  "orders.offline_waiting":
    "సింక్ కోసం వేచి ఉంది — సర్వర్ అందుబాటులో లేదు. మీ మార్పులు భద్రంగా ఉంచబడ్డాయి, కనెక్షన్ తిరిగి వచ్చినప్పుడు మళ్లీ ప్రయత్నిస్తుంది.",
  "orders.draft_restored": "మీ సేవ్ చేయని మార్పులు పునరుద్ధరించబడ్డాయి",
  "orders.entry_deleted": "ఆర్డర్ లైన్ తొలగించబడింది",
  "orders.delete_failed": "తొలగించలేకపోయాం — బ్యాకెండ్ తిరస్కరించింది",
  "orders.save_failed": "సేవ్ చేయలేకపోయాం — బ్యాకెండ్ తిరస్కరించింది",
  "orders.load_failed": "డెలివరీ వివరాలు లోడ్ కాలేదు",
  "orders.conflict_refresh": "మరొక వినియోగదారు డేటాను మార్చారు. తాజా సేకరణను రిఫ్రెష్ చేస్తున్నాము.",
  "orders.nothing_to_save": "ఇంకా ఏమీ మారలేదు",
  "orders.assign_at_least_one_shop": "పూర్తి చేయడానికి ముందు కనీసం ఒక షాప్ అసైన్ చేయండి",
  "orders.assignment_removed": "అసైన్‌మెంట్ నుండి షాప్ తీసివేయబడింది",
  "orders.remove_assignment": "ఈ వాహనం నుండి {shop} తీసివేయండి",
  "orders.max_hint": "కనిష్ఠం {min} · గరిష్ఠం {max}",
  "orders.trip_locked": "ఈ ట్రిప్ పూర్తయింది — అసైన్‌మెంట్ లాక్ చేయబడింది",
  "orders.channel_email": "ఇమెయిల్",
  "orders.channel_whatsapp": "వాట్సాప్",
  "orders.notify_sent": "{recipient}కు పంపబడింది",
  "orders.notify_not_sent": "పంపబడలేదు",
  "orders.view_delivery": "డెలివరీ వివరాలు చూడండి",
  "orders.download_pdf": "PDF డౌన్‌లోడ్",
  "orders.send_whatsapp": "వాట్సాప్‌లో పంపండి",
  "orders.whatsapp_completed_only": "ట్రిప్ పూర్తయ్యాక వాట్సాప్ అందుబాటులో ఉంటుంది",
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
