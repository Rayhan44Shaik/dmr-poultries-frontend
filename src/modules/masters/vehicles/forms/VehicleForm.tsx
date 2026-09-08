import { useEffect, useState, useRef } from "react";
import type { Vehicle } from "../types/vehicle";
import type { VehicleInput } from "../services/vehicleService";
import { useSafeNotification } from "../../../../hooks/useSafeNotification";
import {
  Truck,
  Package,
  Weight,
  Bird,
  MapPin,
  Landmark,
  Gauge,
  Cpu,
  IndianRupee,
  CalendarDays,
  Clock,
} from "lucide-react";
import DatePicker from "../../../../components/common/DatePicker";

// The form collects the vehicle fields it owns; insurance/permit/fitness
// expiries are managed on the fleet documents pages.
type VehicleFormSave = Omit<VehicleInput, "insuranceExpiry" | "permitExpiry" | "fitnessExpiry"> & {
  emiDay?: number;
  totalEMIs?: number;
};

/** Master record plus the extra EMI fields the backend payload accepts. */
type VehicleModel = Vehicle & { emiDay?: number; totalEMIs?: number };

type VehicleFormProps = {
  vehicle?: Vehicle | null;
  onSave: (vehicle: VehicleFormSave) => void;
  onCancel: () => void;
  isSaving?: boolean;
};

function VehicleForm({ vehicle, onSave, onCancel, isSaving = false }: VehicleFormProps) {
  const { showNotification } = useSafeNotification();

  // Fields (in new order)
  const [vehicleNumber, setVehicleNumber] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [trackingId, setTrackingId] = useState("");
  const [noOfBoxes, setNoOfBoxes] = useState<number | "">("");
  const [birdCapacity, setBirdCapacity] = useState<number | "">("");
  const [capacityKg, setCapacityKg] = useState<number | "">("");
  const [fastagBank, setFastagBank] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [purchaseAmount, setPurchaseAmount] = useState<number | "">(""); // renamed from loanAmount
  const [emiDay, setEmiDay] = useState<number | "">("");
  const [totalEMIs, setTotalEMIs] = useState<number | "">("");
  const [engineNumber, setEngineNumber] = useState("");
  const [chassisNumber, setChassisNumber] = useState("");
  const [rcDate, setRcDate] = useState("");

  const [status, setStatus] = useState<"Active" | "Inactive">("Active");

  // Raw digits for Purchase Amount (without commas)
  const [purchaseAmountRaw, setPurchaseAmountRaw] = useState<string>("");
  const purchaseInputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!vehicle;

  // Helper to format Indian number with commas
  const formatIndianNumber = (numStr: string): string => {
    if (!numStr) return "";
    const clean = numStr.replace(/,/g, "");
    if (clean === "") return "";
    const num = parseFloat(clean);
    if (isNaN(num)) return "";
    return num.toLocaleString('en-IN');
  };

  useEffect(() => {
    if (vehicle) {
      setVehicleNumber(vehicle.vehicleNumber);
      setVehicleType(vehicle.vehicleType);
      setTrackingId(vehicle.trackingId ?? "");
      setNoOfBoxes(vehicle.noOfBoxes);
      setBirdCapacity(vehicle.birdCapacity);
      setCapacityKg(vehicle.capacityKg);
      setFastagBank(vehicle.fastagBank ?? "");
      setPurchaseDate(vehicle.purchaseDate ?? "");
      setPurchaseAmount(vehicle.purchaseAmount ?? "");
      setPurchaseAmountRaw(vehicle.purchaseAmount ? String(vehicle.purchaseAmount) : "");
      const model = vehicle as VehicleModel;
      setEmiDay(model.emiDay ?? "");
      setTotalEMIs(model.totalEMIs ?? "");
      setEngineNumber(vehicle.engineNumber ?? "");
      setChassisNumber(vehicle.chassisNumber ?? "");
      setRcDate(vehicle.rcDate ?? "");
      setStatus(vehicle.status);
    } else {
      // Reset all
      setVehicleNumber("");
      setVehicleType("");
      setTrackingId("");
      setNoOfBoxes("");
      setBirdCapacity("");
      setCapacityKg("");
      setFastagBank("");
      setPurchaseDate("");
      setPurchaseAmount("");
      setPurchaseAmountRaw("");
      setEmiDay("");
      setTotalEMIs("");
      setEngineNumber("");
      setChassisNumber("");
      setRcDate("");
      setStatus("Active");
    }
  }, [vehicle]);

  // Sync purchaseAmountRaw with purchaseAmount when vehicle changes
  useEffect(() => {
    if (purchaseInputRef.current) {
      const formatted = purchaseAmountRaw ? formatIndianNumber(purchaseAmountRaw) : "";
      purchaseInputRef.current.value = formatted;
    }
  }, [purchaseAmountRaw]);

  // Handlers for Purchase Amount input
  const handlePurchaseFocus = () => {
    if (purchaseInputRef.current) {
      purchaseInputRef.current.value = purchaseAmountRaw;
    }
  };

  const handlePurchaseBlur = () => {
    if (purchaseInputRef.current) {
      const formatted = purchaseAmountRaw ? formatIndianNumber(purchaseAmountRaw) : "";
      purchaseInputRef.current.value = formatted;
    }
  };

  const handlePurchaseChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/,/g, "").replace(/[^0-9]/g, "");
    setPurchaseAmountRaw(val);
    setPurchaseAmount(val === "" ? "" : parseFloat(val));
  };

  // Bird Capacity – integer only
  const handleBirdCapacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, "");
    if (val === "") {
      setBirdCapacity("");
      return;
    }
    const num = parseInt(val, 10);
    if (!isNaN(num) && num >= 0) {
      setBirdCapacity(num);
    }
  };

  // EMI Day validation (1-31)
  const handleEmiDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, "");
    if (val === "") {
      setEmiDay("");
      return;
    }
    const num = parseInt(val, 10);
    if (num >= 1 && num <= 31) {
      setEmiDay(num);
    }
  };

  const handleEmiDayBlur = () => {
    if (emiDay !== "") {
      const num = Number(emiDay);
      if (num < 1 || num > 31) {
        showNotification("EMI day must be between 1 and 31.", "error");
        setEmiDay("");
      }
    }
  };

  // Total EMIs handler
  const handleTotalEMIsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, "");
    if (val === "") {
      setTotalEMIs("");
      return;
    }
    const num = parseInt(val, 10);
    if (num > 0) {
      setTotalEMIs(num);
    }
  };

  const handleSubmit = () => {
    // Required fields
    if (!vehicleNumber || !vehicleType || noOfBoxes === "" || birdCapacity === "" || capacityKg === "") {
      showNotification("Please fill all required fields.", "error");
      return;
    }
    // Engine and Chassis are now mandatory
    if (!engineNumber.trim()) {
      showNotification("Engine Number is required.", "error");
      return;
    }
    if (!chassisNumber.trim()) {
      showNotification("Chassis Number is required.", "error");
      return;
    }
    onSave({
      vehicleNumber,
      vehicleType,
      trackingId,
      noOfBoxes: Number(noOfBoxes),
      birdCapacity: Number(birdCapacity),
      capacityKg: Number(capacityKg),
      fastagBank,
      purchaseDate,
      purchaseAmount: purchaseAmount === "" ? undefined : Number(purchaseAmount),
      emiDay: emiDay === "" ? undefined : Number(emiDay),
      totalEMIs: totalEMIs === "" ? undefined : Number(totalEMIs),
      engineNumber,
      chassisNumber,
      rcDate,
      status,
    });
  };

  // ── Shared field chrome (form-local redesign — simple, neat, compact) ────
  // Every text/number input and the DatePicker's built-in h-10/text-sm input
  // now share one visual language: 40px tall, rounded-lg, slate border, soft
  // background, emerald focus ring (matches the ERP calendar theme).
  const inputClass = () =>
    "w-full h-10 pl-9 pr-3 text-sm rounded-lg border border-slate-200 bg-slate-50/60 text-slate-800 placeholder:text-slate-400 outline-none transition focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

  const numberInputClass = () =>
    inputClass() + " [&::-moz-inner-spin-button]:appearance-none";

  const iconWrapperClass = "absolute left-3 top-1/2 -translate-y-1/2 text-slate-400";

  const fieldLabel = (text: string, required = false) => (
    <label className="block mb-1.5 text-xs font-semibold text-slate-600">
      {text}
      {required && <span className="text-red-500"> *</span>}
    </label>
  );

  const sectionHeading = (label: string) => (
    <div className="flex items-center gap-2">
      <span className="h-3.5 w-1 rounded-full bg-emerald-500" aria-hidden="true" />
      <h3 className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
        {label}
      </h3>
      <div className="h-px flex-1 bg-slate-200/80" aria-hidden="true" />
    </div>
  );

  /**
   * DatePicker draws its own compact input (h-10 / text-sm) and applies
   * `className` to the wrapper it positions the popup against — so the wrapper
   * only sets width. The calendar icon on the side is left to the shared
   * DatePicker's own default (emerald-600), which keeps the green icon
   * consistent across every master page. `popupClassName` shrinks the calendar
   * popup for THIS form only (the shared DatePicker is untouched): `w-72!`
   * beats the popup's built-in `w-80` regardless of utility order, and
   * `scale-80 origin-top-left` renders the whole calendar 20% smaller while
   * staying anchored to the input — placement is "bottom", so the popup opens
   * below the field and its top edge stays glued to it while scaling.
   */
  const datePickerWrapperClass = "w-full";
  const datePickerPopupClass = "w-72! scale-80 origin-top-left";

  const title = isEditing ? "Edit Vehicle" : "Add Vehicle";
  const subtitle = isEditing ? "Update information" : "Fill in the information";

  const toggleStatus = () => {
    if (!isSaving) {
      setStatus(status === "Active" ? "Inactive" : "Active");
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200">
      {/* Header — rounded on its own corners: the card must NOT clip
          (overflow-hidden) or the date picker's popup gets cut off at the
          card edge and the dialog cannot scroll to reveal it. */}
      <div className="rounded-t-2xl px-6 py-4 sm:px-8 sm:py-5 flex items-center justify-between gap-4 border-b border-slate-200/70 bg-gradient-to-r from-emerald-50/70 via-white to-white">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-100 text-emerald-700 p-2.5 rounded-xl">
            <Truck size={22} />
          </div>
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
              {title}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Status
          </span>
          <button
            type="button"
            onClick={toggleStatus}
            disabled={isSaving}
            aria-label={`Status: ${status}. Toggle status.`}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-200 ${
              status === "Active" ? "bg-emerald-500" : "bg-slate-300"
            } ${isSaving ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                status === "Active" ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span
            className={`text-sm font-semibold ${
              status === "Active" ? "text-emerald-600" : "text-slate-500"
            }`}
          >
            {status}
          </span>
        </div>
      </div>

      {/* Body — four tidy sections */}
      <div className="p-6 sm:p-8 space-y-7">
        {/* Section 1: Vehicle identity */}
        <section className="space-y-3">
          {sectionHeading("Vehicle Identity")}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="relative">
              {fieldLabel("Vehicle Number", true)}
              <div className="relative">
                <Truck className={iconWrapperClass} size={16} />
                <input
                  value={vehicleNumber}
                  onChange={(e) => setVehicleNumber(e.target.value.toUpperCase())}
                  placeholder="e.g., AP-01-AB-1234"
                  className={inputClass()}
                />
              </div>
            </div>

            <div className="relative">
              {fieldLabel("Vehicle Type", true)}
              <div className="relative">
                <Package className={iconWrapperClass} size={16} />
                <input
                  value={vehicleType}
                  onChange={(e) => setVehicleType(e.target.value)}
                  placeholder="e.g., LCV, Truck, Trailer"
                  className={inputClass()}
                />
              </div>
            </div>

            <div className="relative">
              {fieldLabel("Engine Number", true)}
              <div className="relative">
                <Gauge className={iconWrapperClass} size={16} />
                <input
                  value={engineNumber}
                  onChange={(e) => setEngineNumber(e.target.value.toUpperCase())}
                  placeholder="Engine number"
                  className={inputClass()}
                />
              </div>
            </div>

            <div className="relative">
              {fieldLabel("Chassis Number", true)}
              <div className="relative">
                <Cpu className={iconWrapperClass} size={16} />
                <input
                  value={chassisNumber}
                  onChange={(e) => setChassisNumber(e.target.value.toUpperCase())}
                  placeholder="Chassis number"
                  className={inputClass()}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Load capacity */}
        <section className="space-y-3">
          {sectionHeading("Load Capacity")}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="relative">
              {fieldLabel("No. of Boxes", true)}
              <div className="relative">
                <Package className={iconWrapperClass} size={16} />
                <input
                  type="number"
                  value={noOfBoxes}
                  onChange={(e) => setNoOfBoxes(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="e.g., 12"
                  className={numberInputClass()}
                />
              </div>
            </div>

            <div className="relative">
              {fieldLabel("Bird Capacity", true)}
              <div className="relative">
                <Bird className={iconWrapperClass} size={16} />
                <input
                  type="number"
                  step="1"
                  value={birdCapacity}
                  onChange={handleBirdCapacityChange}
                  placeholder="e.g., 2000"
                  className={numberInputClass()}
                />
              </div>
            </div>

            <div className="relative">
              {fieldLabel("Capacity (Kg)", true)}
              <div className="relative">
                <Weight className={iconWrapperClass} size={16} />
                <input
                  type="number"
                  value={capacityKg}
                  onChange={(e) => setCapacityKg(e.target.value === "" ? "" : Number(e.target.value))}
                  placeholder="e.g., 5000"
                  className={numberInputClass()}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Purchase & finance */}
        <section className="space-y-3">
          {sectionHeading("Purchase & Finance")}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="relative">
              {fieldLabel("Fastag Bank")}
              <div className="relative">
                <Landmark className={iconWrapperClass} size={16} />
                <input
                  value={fastagBank}
                  onChange={(e) => setFastagBank(e.target.value)}
                  placeholder="e.g., HDFC, Axis"
                  className={inputClass()}
                />
              </div>
            </div>

            <div className="relative">
              {fieldLabel("Purchase Date")}
              <div className="relative">
                <DatePicker
                  value={purchaseDate}
                  onChange={setPurchaseDate}
                  placeholder="Select date"
                  placement="bottom"
                  className={datePickerWrapperClass}
                  popupClassName={datePickerPopupClass}
                />
              </div>
            </div>

            <div className="relative">
              {fieldLabel("Purchase Amount (₹)")}
              <div className="relative">
                <IndianRupee className={iconWrapperClass} size={16} />
                <input
                  ref={purchaseInputRef}
                  type="text"
                  onFocus={handlePurchaseFocus}
                  onBlur={handlePurchaseBlur}
                  onChange={handlePurchaseChange}
                  placeholder="e.g., 800000"
                  className={inputClass()}
                  defaultValue={purchaseAmountRaw ? formatIndianNumber(purchaseAmountRaw) : ""}
                />
              </div>
            </div>

            <div className="relative">
              {fieldLabel("EMI Day (1–31)")}
              <div className="relative">
                <CalendarDays className={iconWrapperClass} size={16} />
                <input
                  type="number"
                  min="1"
                  max="31"
                  value={emiDay}
                  onChange={handleEmiDayChange}
                  onBlur={handleEmiDayBlur}
                  placeholder="e.g., 15"
                  className={numberInputClass()}
                />
              </div>
              <p className="mt-1 text-[11px] leading-snug text-slate-400">
                EMI due day each month. Month‑end dates adjust automatically.
              </p>
            </div>

            <div className="relative">
              {fieldLabel("Total EMIs (months)")}
              <div className="relative">
                <Clock className={iconWrapperClass} size={16} />
                <input
                  type="number"
                  min="1"
                  value={totalEMIs}
                  onChange={handleTotalEMIsChange}
                  placeholder="e.g., 36"
                  className={numberInputClass()}
                />
              </div>
              <p className="mt-1 text-[11px] leading-snug text-slate-400">
                Total number of monthly installments.
              </p>
            </div>

            <div className="relative">
              {fieldLabel("RC Date")}
              <div className="relative">
                <DatePicker
                  value={rcDate}
                  onChange={setRcDate}
                  placeholder="Select date"
                  placement="bottom"
                  className={datePickerWrapperClass}
                  popupClassName={datePickerPopupClass}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Tracking (kept last) */}
        <section className="space-y-3">
          {sectionHeading("Tracking")}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="relative">
              {fieldLabel("Tracking ID")}
              <div className="relative">
                <MapPin className={iconWrapperClass} size={16} />
                <input
                  value={trackingId}
                  onChange={(e) => setTrackingId(e.target.value)}
                  placeholder="GPS tracking ID"
                  className={inputClass()}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-5 border-t border-slate-200">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="px-6 py-2.5 border border-slate-300 rounded-lg hover:bg-slate-50 transition font-medium text-sm text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition shadow-sm hover:shadow font-semibold text-sm disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isSaving && (
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
            {isSaving ? "Saving..." : isEditing ? "Update Vehicle" : "Save Vehicle"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default VehicleForm;
