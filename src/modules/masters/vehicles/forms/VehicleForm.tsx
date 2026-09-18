import MasterForm, { MasterSectionHeading } from "../../components/MasterForm";
import {
  masterInputClass,
  masterIconClass,
  masterLabelClass,
} from "../../components/masterFormStyles";
import { useId, useEffect, useState, useRef } from "react";
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
import DatePicker from "../../components/MasterDatePicker";

// The form collects the vehicle fields it owns; insurance/permit/fitness
// expiries are managed on the fleet documents pages.
type VehicleFormSave = Omit<
  VehicleInput,
  "insuranceExpiry" | "permitExpiry" | "fitnessExpiry"
> & {
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

function VehicleForm({
  vehicle,
  onSave,
  onCancel,
  isSaving = false,
}: VehicleFormProps) {
  const formId = useId();
  const fieldId = (text: string) => `${formId}-${text.replace(/\s+/g, "-")}`;
  const { showNotification } = useSafeNotification();

  // Fields (in new order)
  const model = vehicle as VehicleModel | null | undefined;
  const [vehicleNumber, setVehicleNumber] = useState(vehicle?.vehicleNumber ?? "");
  const [vehicleType, setVehicleType] = useState(vehicle?.vehicleType ?? "");
  const [trackingId, setTrackingId] = useState(vehicle?.trackingId ?? "");
  const [noOfBoxes, setNoOfBoxes] = useState<number | "">(vehicle?.noOfBoxes ?? "");
  const [birdCapacity, setBirdCapacity] = useState<number | "">(vehicle?.birdCapacity ?? "");
  const [capacityKg, setCapacityKg] = useState<number | "">(vehicle?.capacityKg ?? "");
  const [fastagBank, setFastagBank] = useState(vehicle?.fastagBank ?? "");
  const [purchaseDate, setPurchaseDate] = useState(vehicle?.purchaseDate ?? "");
  const [purchaseAmount, setPurchaseAmount] = useState<number | "">(vehicle?.purchaseAmount ?? "");
  const [emiStartDate, setEmiStartDate] = useState(vehicle?.emiStartDate ?? "");
  const [emiDay, setEmiDay] = useState<number | "">(model?.emiDay ?? "");
  const [totalEMIs, setTotalEMIs] = useState<number | "">(model?.totalEMIs ?? "");
  const [engineNumber, setEngineNumber] = useState(vehicle?.engineNumber ?? "");
  const [chassisNumber, setChassisNumber] = useState(vehicle?.chassisNumber ?? "");
  const [rcDate, setRcDate] = useState(vehicle?.rcDate ?? "");

  const [status, setStatus] = useState<"Active" | "Inactive">(vehicle?.status ?? "Active");

  // Raw digits for Purchase Amount (without commas)
  const [purchaseAmountRaw, setPurchaseAmountRaw] = useState<string>(vehicle?.purchaseAmount ? String(vehicle.purchaseAmount) : "");
  const purchaseInputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!vehicle;

  // Helper to format Indian number with commas
  const formatIndianNumber = (numStr: string): string => {
    if (!numStr) return "";
    const clean = numStr.replace(/,/g, "");
    if (clean === "") return "";
    const num = parseFloat(clean);
    if (isNaN(num)) return "";
    return num.toLocaleString("en-IN");
  };

  // Sync purchaseAmountRaw with purchaseAmount when vehicle changes
  useEffect(() => {
    if (purchaseInputRef.current) {
      const formatted = purchaseAmountRaw
        ? formatIndianNumber(purchaseAmountRaw)
        : "";
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
      const formatted = purchaseAmountRaw
        ? formatIndianNumber(purchaseAmountRaw)
        : "";
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
    if (
      !vehicleNumber ||
      !vehicleType ||
      noOfBoxes === "" ||
      birdCapacity === "" ||
      capacityKg === ""
    ) {
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
      purchaseAmount:
        purchaseAmount === "" ? undefined : Number(purchaseAmount),
      emiStartDate,
      emiDay: emiDay === "" ? undefined : Number(emiDay),
      totalEMIs: totalEMIs === "" ? undefined : Number(totalEMIs),
      engineNumber,
      chassisNumber,
      rcDate,
      status,
    });
  };

  const inputClass = masterInputClass;
  const numberInputClass = masterInputClass;
  const iconWrapperClass = masterIconClass;

  const fieldLabel = (text: string, required = false) => (
    <label htmlFor={fieldId(text)} className={masterLabelClass}>
      {text}
      {required && <span className="text-red-500"> *</span>}
    </label>
  );

  const sectionHeading = (label: string) => (
    <MasterSectionHeading>{label}</MasterSectionHeading>
  );

  const title = isEditing ? "Edit Vehicle" : "Add Vehicle";
  const subtitle = isEditing ? "Update details" : "Fill in the details";

  return (
    <MasterForm
      title={title}
      subtitle={subtitle}
      icon={<Truck size={20} />}
      status={status}
      onStatusChange={setStatus}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      isSaving={isSaving}
      submitLabel={isEditing ? "Update Vehicle" : "Save Vehicle"}
    >
      {/* Section 1: Vehicle identity */}
      <section className="space-y-3">
        {sectionHeading("Vehicle Identity")}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="relative">
            {fieldLabel("Vehicle Number", true)}
            <div className="relative">
              <Truck className={iconWrapperClass} size={16} />
              <input
                id={fieldId("Vehicle Number")}
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
                id={fieldId("Vehicle Type")}
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
                id={fieldId("Engine Number")}
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
                id={fieldId("Chassis Number")}
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
                id={fieldId("No. of Boxes")}
                type="number"
                value={noOfBoxes}
                onChange={(e) =>
                  setNoOfBoxes(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
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
                id={fieldId("Bird Capacity")}
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
                id={fieldId("Capacity (Kg)")}
                type="number"
                value={capacityKg}
                onChange={(e) =>
                  setCapacityKg(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
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
                id={fieldId("Fastag Bank")}
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
                id={fieldId("Purchase Date")}
                value={purchaseDate}
                onChange={setPurchaseDate}
                placeholder="Select date"
              />
            </div>
          </div>

          <div className="relative">
            {fieldLabel("Purchase Amount (₹)")}
            <div className="relative">
              <IndianRupee className={iconWrapperClass} size={16} />
              <input
                id={fieldId("Purchase Amount (₹)")}
                ref={purchaseInputRef}
                type="text"
                onFocus={handlePurchaseFocus}
                onBlur={handlePurchaseBlur}
                onChange={handlePurchaseChange}
                placeholder="e.g., 800000"
                className={inputClass()}
                defaultValue={
                  purchaseAmountRaw ? formatIndianNumber(purchaseAmountRaw) : ""
                }
              />
            </div>
          </div>

          <div className="relative">
            {fieldLabel("EMI Start Date")}
            <DatePicker
              id={fieldId("EMI Start Date")}
              value={emiStartDate}
              onChange={setEmiStartDate}
              placeholder="Select date"
            />
          </div>

          <div className="relative">
            {fieldLabel("EMI Day (1–31)")}
            <div className="relative">
              <CalendarDays className={iconWrapperClass} size={16} />
              <input
                id={fieldId("EMI Day (1–31)")}
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
                id={fieldId("Total EMIs (months)")}
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
                id={fieldId("RC Date")}
                value={rcDate}
                onChange={setRcDate}
                placeholder="Select date"
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
                id={fieldId("Tracking ID")}
                value={trackingId}
                onChange={(e) => setTrackingId(e.target.value)}
                placeholder="GPS tracking ID"
                className={inputClass()}
              />
            </div>
          </div>
        </div>
      </section>
    </MasterForm>
  );
}

export default VehicleForm;
