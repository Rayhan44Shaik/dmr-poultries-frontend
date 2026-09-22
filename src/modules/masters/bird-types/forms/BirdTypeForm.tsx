import { useCallback, useId, useState } from "react";
import { Bird, FileText, Fuel, Layers3, Phone, User, Weight } from "lucide-react";
import MasterForm, { MasterSectionHeading } from "../../components/MasterForm";
import MasterDropdown from "../../components/MasterDropdown";
import { masterIconClass, masterInputClass, masterLabelClass, masterTextareaClass } from "../../components/masterFormStyles";
import LocationPicker from "../../shops/components/LocationPicker";
import type { BirdType } from "../types/birdType";

type Props = { birdType?: BirdType | null; onSave: (value: Partial<BirdType>) => void; onCancel: () => void; isSaving?: boolean };
type Errors = Partial<Record<"name" | "weight" | "owner" | "mobile" | "address" | "gps", string>>;

export default function BirdTypeForm({ birdType, onSave, onCancel, isSaving = false }: Props) {
  const formId = useId();
  const fieldId = (name: string) => `${formId}-${name.replace(/\s+/g, "-")}`;
  const [category, setCategory] = useState<BirdType["category"]>(birdType?.category ?? "Bird");
  const [name, setName] = useState(birdType?.birdType ?? "");
  const [weight, setWeight] = useState(birdType?.averageWeight ? String(birdType.averageWeight) : "");
  const [owner, setOwner] = useState(birdType?.ownerName ?? "");
  const [mobile, setMobile] = useState(birdType?.mobileNumber ?? "");
  const [address, setAddress] = useState(birdType?.address ?? "");
  const [latitude, setLatitude] = useState(birdType?.latitude == null ? "" : String(birdType.latitude));
  const [longitude, setLongitude] = useState(birdType?.longitude == null ? "" : String(birdType.longitude));
  const [description, setDescription] = useState(birdType?.description ?? "");
  const [status, setStatus] = useState<BirdType["status"]>(birdType?.status ?? "Active");
  const [errors, setErrors] = useState<Errors>({});
  const fuel = category === "Fuel Bunk";
  const label = (text: string, required = false) => <label htmlFor={fieldId(text)} className={masterLabelClass}>{text}{required && <span className="ml-0.5 text-red-500">*</span>}</label>;
  const errorText = (value?: string) => value ? <p className="mt-1 text-xs font-medium text-red-500">{value}</p> : null;
  const handleLocation = useCallback((lat: string, lng: string, resolvedAddress?: string) => {
    setLatitude(lat); setLongitude(lng); if (resolvedAddress !== undefined) setAddress(resolvedAddress);
    setErrors((current) => ({ ...current, gps: "", address: resolvedAddress ? "" : current.address }));
  }, []);
  const submit = () => {
    const next: Errors = {};
    if (name.trim().length < 2) next.name = fuel ? "Bunk name must contain at least 2 characters." : "Bird type must contain at least 2 characters.";
    if (!fuel && !(Number(weight) > 0)) next.weight = "Average weight must be greater than zero.";
    if (fuel && owner.trim().length < 3) next.owner = "Owner name must contain at least 3 characters.";
    if (fuel && !/^\d{10}$/.test(mobile)) next.mobile = "Mobile number must be exactly 10 digits.";
    if (fuel && !address.trim()) next.address = "Bunk address is required.";
    const lat = Number(latitude), lng = Number(longitude);
    if (fuel && (!latitude || !longitude || !Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0))) next.gps = "Capture a valid GPS location.";
    setErrors(next); if (Object.values(next).some(Boolean)) return;
    onSave({ birdType: name.trim(), category, averageWeight: fuel ? 0 : Number(weight), ownerName: fuel ? owner.trim() : "", mobileNumber: fuel ? mobile : "", address: fuel ? address.trim() : "", latitude: fuel ? lat : null, longitude: fuel ? lng : null, description: description.trim(), status });
  };
  const input = (field: string, value: string, change: (value: string) => void, Icon: typeof Bird, placeholder: string, error?: string, maxLength?: number) => <div>{label(field, true)}<div className="relative"><Icon className={masterIconClass} size={16}/><input id={fieldId(field)} value={value} onChange={(e) => change(e.target.value)} placeholder={placeholder} maxLength={maxLength} className={masterInputClass(Boolean(error))} disabled={isSaving}/></div>{errorText(error)}</div>;

  return <MasterForm title={birdType ? "Edit Other" : "Add Other"} subtitle="Manage bird types and fuel bunks" icon={fuel ? <Fuel size={20}/> : <Layers3 size={20}/>} status={status} onStatusChange={setStatus} onSubmit={submit} onCancel={onCancel} isSaving={isSaving} submitLabel={birdType ? "Update" : "Save"}>
    <section className="space-y-4"><MasterSectionHeading>Classification</MasterSectionHeading><div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <MasterDropdown label="Category" value={category} options={[{ value: "Bird", label: "Bird", icon: <Bird size={15} className="text-emerald-500"/> }, { value: "Fuel Bunk", label: "Fuel Bunk", icon: <Fuel size={15} className="text-amber-500"/> }]} onChange={(value) => { setCategory(value as BirdType["category"]); setErrors({}); }} required labelStyle="field" triggerId={fieldId("Category")} disabled={isSaving}/>
      {input(fuel ? "Bunk Name" : "Bird Type", name, setName, fuel ? Fuel : Bird, fuel ? "e.g., Indian Oil - Kodad" : "e.g., Broiler", errors.name)}
      {!fuel && <div>{label("Average Weight (kg)", true)}<div className="relative"><Weight className={masterIconClass} size={16}/><input id={fieldId("Average Weight (kg)")} type="number" min="0.01" step="0.01" value={weight} onChange={(e) => setWeight(e.target.value)} className={masterInputClass(Boolean(errors.weight))} disabled={isSaving}/></div>{errorText(errors.weight)}</div>}
    </div></section>
    {fuel && <section className="space-y-4"><MasterSectionHeading>Fuel Bunk Contact</MasterSectionHeading><div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {input("Owner Name", owner, setOwner, User, "Owner name", errors.owner)}
      {input("Mobile Number", mobile, (value) => setMobile(value.replace(/\D/g, "").slice(0, 10)), Phone, "10-digit mobile number", errors.mobile, 10)}
      <div className="sm:col-span-2">{label("Bunk Address", true)}<textarea id={fieldId("Bunk Address")} value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className={`${masterTextareaClass} ${errors.address ? "border-red-400" : ""}`} disabled={isSaving}/>{errorText(errors.address)}</div>
    </div></section>}
    {fuel && <section className="space-y-3"><MasterSectionHeading>Location & GPS</MasterSectionHeading><LocationPicker id={fieldId("GPS Location")} latitude={latitude} longitude={longitude} address={address} onChange={handleLocation} disabled={isSaving}/>{errorText(errors.gps)}</section>}
    <section className="space-y-3"><MasterSectionHeading>Additional Details</MasterSectionHeading><div>{label("Description")}<div className="relative"><FileText className="absolute left-3 top-3 text-slate-400" size={16}/><textarea id={fieldId("Description")} value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={masterTextareaClass} disabled={isSaving}/></div></div></section>
  </MasterForm>;
}
