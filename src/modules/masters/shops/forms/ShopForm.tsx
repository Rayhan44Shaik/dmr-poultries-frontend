import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import type { Shop } from "../types/shop";
import {
  Store,
  User,
  Phone,
  Mail,
  MapPin,
  IndianRupee,
  Settings,
  Search,
  ChevronDown,
} from "lucide-react";
import { useI18n } from "../../../../i18n";
import { formatINR } from "../../../../utils/format";
import LocationPicker from "../components/LocationPicker";

type ShopFormProps = {
  shop?: Shop | null;
  onSave: (shop: {
    shopNumber: string;
    shopName: string;
    ownerName: string;
    phoneNumber: string;
    secondaryPhoneNumber: string;
    email: string;
    city: string;
    address: string;
    latitude: string;
    longitude: string;
    paperRate: number;
    associationType: string;
    status: "Active" | "Inactive";
    openingBalance: number;
  }) => void;
  onCancel: () => void;
  isSaving?: boolean;
};

const PAPER_RATE_OPTIONS = Array.from({ length: 30 }, (_, i) => i + 1);
const ASSOCIATION_TYPES = ["Vencob Vij", "Vencob Gun", "Ass Vij", "Ass Gun"];

function PaperRateSelect({
  value,
  onChange,
  hasError,
}: {
  value: string;
  onChange: (val: string) => void;
  hasError?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return PAPER_RATE_OPTIONS;
    const q = query.trim().toLowerCase();
    return PAPER_RATE_OPTIONS.filter((o) => String(o).includes(q));
  }, [query]);

  const openUpward = useMemo(() => {
    if (!rootRef.current) return false;
    const rect = rootRef.current.getBoundingClientRect();
    return window.innerHeight - rect.bottom < 220;
  }, []);

  useEffect(() => {
    if (open) {
      setHighlightedIndex(0);
      setQuery("");
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [open]);

  useEffect(() => { setHighlightedIndex(0); }, [query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setOpen(false); return; }
      if (e.key === "ArrowDown") { e.preventDefault(); setHighlightedIndex((i) => Math.min(i + 1, filtered.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setHighlightedIndex((i) => Math.max(i - 1, 0)); }
      if (e.key === "Enter") {
        e.preventDefault();
        if (filtered[highlightedIndex] !== undefined) {
          onChange(String(filtered[highlightedIndex]));
          setOpen(false);
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, highlightedIndex, filtered, onChange]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.children[highlightedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlightedIndex, open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`w-full h-10 flex items-center pl-9 pr-8 text-sm rounded-lg border outline-none transition focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 cursor-pointer text-left ${
          hasError ? "border-red-500" : "border-slate-200"
        } bg-slate-50/60 text-slate-800`}
      >
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
          <IndianRupee size={15} />
        </span>
        <span className={`flex-1 truncate ${!value ? "text-slate-400" : ""}`}>
          {value || "Select Paper Rate"}
        </span>
      </button>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
        <ChevronDown size={14} />
      </div>
      {open && (
        <div
          className={`absolute z-[60] w-full bg-white border border-slate-200 rounded-lg shadow-md overflow-hidden ${
            openUpward ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          <div className="px-1.5 pt-1.5 pb-1">
            <div className="relative">
              <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
                placeholder="Search rate..."
                className="w-full pl-6 pr-2 py-[5px] text-[13px] border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-emerald-400/40 focus:border-emerald-400"
              />
            </div>
          </div>
          <div ref={listRef} className="overflow-y-auto max-h-[160px] px-1 pb-1">
            {filtered.map((rate, idx) => (
              <button
                key={rate}
                type="button"
                onMouseEnter={() => setHighlightedIndex(idx)}
                onClick={() => { onChange(String(rate)); setOpen(false); }}
                className={`w-full px-2.5 py-[7px] text-[14px] text-left rounded transition-colors ${
                  String(rate) === value
                    ? "bg-emerald-50 text-emerald-700 font-medium"
                    : idx === highlightedIndex
                    ? "bg-slate-100 text-slate-800"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                {rate}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-2 py-1.5 text-[12px] text-slate-400 text-center">No rates found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ShopForm({ shop, onSave, onCancel, isSaving = false }: ShopFormProps) {
  const { t } = useI18n();
  const [shopNumber, setShopNumber] = useState("");
  const [shopName, setShopName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [secondaryPhoneNumber, setSecondaryPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [paperRate, setPaperRate] = useState("1");
  const [associationType, setAssociationType] = useState("");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [isBalanceFocused, setIsBalanceFocused] = useState(false);
  const balanceInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");

  const [errors, setErrors] = useState({
    shopNumber: "", shopName: "", ownerName: "", phoneNumber: "",
    secondaryPhoneNumber: "", email: "", city: "", latitude: "", longitude: "",
    paperRate: "", associationType: "", openingBalance: "",
  });

  const isEditing = !!shop;

  useEffect(() => {
    if (shop) {
      setShopNumber(shop.shopNumber || String(shop.shopNo).padStart(6, "0"));
      setShopName(shop.shopName);
      setOwnerName(shop.ownerName);
      setPhoneNumber(shop.phoneNumber);
      setSecondaryPhoneNumber(shop.secondaryPhoneNumber ?? "");
      setEmail(shop.email ?? "");
      setCity(shop.city);
      setAddress(shop.address ?? "");
      setLatitude(shop.latitude !== undefined ? String(shop.latitude) : "");
      setLongitude(shop.longitude !== undefined ? String(shop.longitude) : "");
      setPaperRate(shop.paperRate !== undefined ? String(shop.paperRate) : "1");
      setAssociationType(shop.associationType ?? "");
      setOpeningBalance(shop.openingBalance !== undefined ? String(shop.openingBalance) : "0");
      setStatus(shop.status);
    } else {
      setShopNumber(""); setShopName(""); setOwnerName(""); setPhoneNumber("");
      setSecondaryPhoneNumber(""); setEmail(""); setCity(""); setAddress("");
      setLatitude(""); setLongitude(""); setPaperRate("1"); setAssociationType("");
      setOpeningBalance("0"); setStatus("Active");
    }
    setErrors({ shopNumber: "", shopName: "", ownerName: "", phoneNumber: "",
      secondaryPhoneNumber: "", email: "", city: "", latitude: "", longitude: "",
      paperRate: "", associationType: "", openingBalance: "" });
  }, [shop]);

  const formatDisplayBalance = useCallback((raw: string): string => {
    const num = parseFloat(raw);
    if (isNaN(num) || raw === "") return "₹0.00";
    return formatINR(num);
  }, []);

  const parseBalanceInput = useCallback((input: string): string => {
    const cleaned = input.replace(/[₹,\s]/g, "");
    const valid = cleaned.replace(/[^0-9.\-]/g, "");
    const dotIndex = valid.indexOf(".");
    if (dotIndex !== -1) {
      return valid.substring(0, dotIndex + 1) + valid.substring(dotIndex + 1).replace(/\./g, "");
    }
    return valid;
  }, []);

  const handleBalanceChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setOpeningBalance(parseBalanceInput(e.target.value));
  }, [parseBalanceInput]);

  const handleBalanceFocus = useCallback(() => {
    setIsBalanceFocused(true);
    setTimeout(() => {
      if (balanceInputRef.current) {
        const len = balanceInputRef.current.value.length;
        balanceInputRef.current.setSelectionRange(len, len);
      }
    }, 0);
  }, []);

  const handleBalanceBlur = useCallback(() => setIsBalanceFocused(false), []);

  const handleLocationChange = useCallback((lat: string, lng: string, addr?: string) => {
    setLatitude(lat);
    setLongitude(lng);
    if (addr !== undefined) setAddress(addr);
  }, []);

  const handleSubmit = useCallback(() => {
    const newErrors = { shopNumber: "", shopName: "", ownerName: "", phoneNumber: "",
      secondaryPhoneNumber: "", email: "", city: "", latitude: "", longitude: "",
      paperRate: "", associationType: "", openingBalance: "" };

    if (shopName.trim().length < 3) newErrors.shopName = t("masters.shops.validation.shop_name_min");
    if (ownerName.trim().length < 3) newErrors.ownerName = t("masters.shops.validation.owner_name_min");
    if (!/^[0-9]{10}$/.test(phoneNumber)) newErrors.phoneNumber = t("masters.shops.validation.mobile_10_digits");
    if (secondaryPhoneNumber.trim() !== "" && !/^[0-9]{10}$/.test(secondaryPhoneNumber))
      newErrors.secondaryPhoneNumber = t("masters.shops.validation.secondary_mobile_10_digits");
    if (email.trim() !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      newErrors.email = t("masters.shops.validation.email_invalid");
    if (city.trim() === "") newErrors.city = t("masters.shops.validation.city_required");

    const lat = parseFloat(latitude);
    if (latitude.trim() !== "" && (isNaN(lat) || lat < -90 || lat > 90))
      newErrors.latitude = t("masters.shops.validation.latitude_invalid");
    const lng = parseFloat(longitude);
    if (longitude.trim() !== "" && (isNaN(lng) || lng < -180 || lng > 180))
      newErrors.longitude = t("masters.shops.validation.longitude_invalid");

    const rate = parseInt(paperRate, 10);
    if (paperRate.trim() === "" || isNaN(rate) || rate < 1 || rate > 30)
      newErrors.paperRate = t("masters.shops.validation.paper_rate_invalid");
    if (associationType.trim() === "")
      newErrors.associationType = t("masters.shops.validation.association_type_required");

    const parsedBalance = parseFloat(openingBalance);
    if (openingBalance.trim() === "" || isNaN(parsedBalance))
      newErrors.openingBalance = t("masters.shops.validation.opening_balance_required");

    setErrors(newErrors);
    if (Object.values(newErrors).some(Boolean)) return;

    onSave({
      shopNumber: isEditing ? shopNumber : shopNumber || `SHOP-${String(Date.now()).slice(-6)}`,
      shopName, ownerName, phoneNumber,
      secondaryPhoneNumber: secondaryPhoneNumber.trim(),
      email, city, address,
      latitude: latitude.trim() || "0",
      longitude: longitude.trim() || "0",
      paperRate: rate, associationType, status,
      openingBalance: parsedBalance,
    });
  }, [shop, shopNumber, shopName, ownerName, phoneNumber, secondaryPhoneNumber, email,
    city, address, latitude, longitude, paperRate, associationType, openingBalance, status,
    isEditing, onSave, t]);

  // Form-local design shared with the Vehicle master form: compact 40px
  // fields, slate border, soft background, emerald focus ring. Error state
  // switches the accent to red.
  const inputClass = (hasError = false) =>
    `w-full h-10 pl-9 pr-3 text-sm rounded-lg border bg-slate-50/60 text-slate-800 placeholder:text-slate-400 outline-none transition focus:bg-white ${
      hasError
        ? "border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100"
        : "border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
    } appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`;

  const selectClass = (hasError = false) =>
    `${inputClass(hasError)} pr-8 cursor-pointer`;

  const iconWrapperClass = "absolute left-3 top-1/2 -translate-y-1/2 text-slate-400";

  const fieldLabel = (text: string, required = false) => (
    <label className="block mb-1.5 text-xs font-semibold text-slate-600">
      {text}
      {required && <span className="text-red-500 ml-0.5" aria-hidden="true"> *</span>}
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

  const title = isEditing ? t("masters.shops.dialog.edit_title") : t("masters.shops.dialog.add_title");
  const subtitle = isEditing ? t("masters.shops.dialog.edit_subtitle") : t("masters.shops.dialog.add_subtitle");

  const toggleStatus = useCallback(() => {
    if (!isSaving) setStatus(status === "Active" ? "Inactive" : "Active");
  }, [status, isSaving]);

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200/70 overflow-hidden max-h-[90vh] flex flex-col">
      {/* Header */}
      <div className="px-5 py-3.5 flex items-center justify-between border-b border-slate-200/70 bg-gradient-to-r from-emerald-50/70 via-white to-white shrink-0 gap-4">
        <div className="flex items-center gap-2.5">
          <div className="bg-emerald-100 text-emerald-700 p-2 rounded-lg">
            <Store className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-800 tracking-tight">{title}</h2>
            <p className="text-[11px] text-slate-500 font-medium">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <span className="text-xs font-semibold text-slate-500 hidden sm:inline">{t("masters.shops.form.status")}</span>
          <button
            type="button" onClick={toggleStatus} disabled={isSaving}
            aria-label={t("masters.shops.form.status")}
            className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-200 ${
              status === "Active" ? "bg-emerald-500" : "bg-slate-300"
            } ${isSaving ? "opacity-60 cursor-not-allowed" : ""}`}
          >
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform shadow-sm ${
              status === "Active" ? "translate-x-5" : "translate-x-0.5"
            }`} />
          </button>
          <span className={`text-xs font-semibold hidden sm:inline ${
            status === "Active" ? "text-emerald-600" : "text-slate-400"
          }`}>{status}</span>
        </div>
      </div>

      {/* Form body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* SHOP DETAILS */}
        <section className="space-y-3">
          {sectionHeading(t("masters.shops.form.sections.shop_details"))}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-x-3 gap-y-3">
            {/* Shop Number — read-only when editing */}
            <div>
              {fieldLabel(t("masters.shops.form.shop_number"), true)}
              <div className="relative">
                <div className={iconWrapperClass}><Store size={15} /></div>
                <input
                  value={shopNumber}
                  onChange={(e) => setShopNumber(e.target.value.toUpperCase())}
                  placeholder={t("masters.shops.form.shop_number_placeholder")}
                  className={
                    isEditing
                      ? "w-full h-10 pl-9 pr-3 text-sm rounded-lg border border-slate-200 bg-slate-100 text-slate-500 outline-none cursor-not-allowed"
                      : inputClass(!!errors.shopNumber)
                  }
                  disabled={isEditing}
                  readOnly={isEditing}
                />
              </div>
              {errors.shopNumber && <p className="text-red-600 text-[11px] mt-0.5">{errors.shopNumber}</p>}
              {isEditing && (
                <p className="text-[11px] text-slate-400 mt-1">Cannot be changed after creation</p>
              )}
            </div>

            {/* Shop Name */}
            <div>
              {fieldLabel(t("masters.shops.form.shop_name"), true)}
              <div className="relative">
                <div className={iconWrapperClass}><Store size={15} /></div>
                <input
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder={t("masters.shops.form.shop_name_placeholder")}
                  className={inputClass(!!errors.shopName)}
                />
              </div>
              {errors.shopName && <p className="text-red-600 text-[11px] mt-0.5">{errors.shopName}</p>}
            </div>

            {/* Owner Name */}
            <div>
              {fieldLabel(t("masters.shops.form.owner_name"), true)}
              <div className="relative">
                <div className={iconWrapperClass}><User size={15} /></div>
                <input
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder={t("masters.shops.form.owner_name_placeholder")}
                  className={inputClass(!!errors.ownerName)}
                />
              </div>
              {errors.ownerName && <p className="text-red-600 text-[11px] mt-0.5">{errors.ownerName}</p>}
            </div>

            {/* Mobile Number */}
            <div>
              {fieldLabel(t("masters.shops.form.mobile_number"), true)}
              <div className="relative">
                <div className={iconWrapperClass}><Phone size={15} /></div>
                <input
                  value={phoneNumber}
                  maxLength={10}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
                  placeholder={t("masters.shops.form.mobile_number_placeholder")}
                  className={inputClass(!!errors.phoneNumber)}
                />
              </div>
              {errors.phoneNumber && <p className="text-red-600 text-[11px] mt-0.5">{errors.phoneNumber}</p>}
            </div>

            {/* Secondary Mobile */}
            <div>
              {fieldLabel(t("masters.shops.form.secondary_mobile_number"))}
              <div className="relative">
                <div className={iconWrapperClass}><Phone size={15} /></div>
                <input
                  value={secondaryPhoneNumber}
                  maxLength={10}
                  onChange={(e) => setSecondaryPhoneNumber(e.target.value.replace(/\D/g, ""))}
                  placeholder={t("masters.shops.form.secondary_mobile_number_placeholder")}
                  className={inputClass(!!errors.secondaryPhoneNumber)}
                />
              </div>
              {errors.secondaryPhoneNumber && <p className="text-red-600 text-[11px] mt-0.5">{errors.secondaryPhoneNumber}</p>}
            </div>

            {/* Email */}
            <div>
              {fieldLabel(t("masters.shops.form.email"))}
              <div className="relative">
                <div className={iconWrapperClass}><Mail size={15} /></div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("masters.shops.form.email_placeholder")}
                  className={inputClass(!!errors.email)}
                />
              </div>
              {errors.email && <p className="text-red-600 text-[11px] mt-0.5">{errors.email}</p>}
            </div>
          </div>
        </section>

        {/* ADDRESS & BUSINESS DETAILS */}
        <section className="space-y-3">
          {sectionHeading(t("masters.shops.form.sections.address"))}
          <div className="space-y-3">
            {/* Row 1: City | Association Type | Paper Rate */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-x-3 gap-y-3">
              {/* City */}
              <div>
                {fieldLabel(t("masters.shops.form.city"), true)}
                <div className="relative">
                  <div className={iconWrapperClass}><MapPin size={15} /></div>
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder={t("masters.shops.form.city_placeholder")}
                    className={inputClass(!!errors.city)}
                  />
                </div>
                {errors.city && <p className="text-red-600 text-[11px] mt-0.5">{errors.city}</p>}
              </div>

              {/* Association Type */}
              <div>
                {fieldLabel(t("masters.shops.form.association_type"), true)}
                <div className="relative">
                  <div className={iconWrapperClass}><Settings size={15} /></div>
                  <select
                    value={associationType}
                    onChange={(e) => setAssociationType(e.target.value)}
                    className={selectClass(!!errors.associationType)}
                  >
                    <option value="">{t("masters.shops.form.association_type_placeholder")}</option>
                    {ASSOCIATION_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                </div>
                {errors.associationType && <p className="text-red-600 text-[11px] mt-0.5">{errors.associationType}</p>}
              </div>

              {/* Paper Rate — searchable */}
              <div>
                {fieldLabel(t("masters.shops.form.paper_rate"), true)}
                <PaperRateSelect
                  value={paperRate}
                  onChange={setPaperRate}
                  hasError={!!errors.paperRate}
                />
                {errors.paperRate && <p className="text-red-600 text-[11px] mt-0.5">{errors.paperRate}</p>}
              </div>
            </div>

            {/* Row 2: Full Address + Get GPS */}
            <div>
              {fieldLabel(t("masters.shops.form.full_address"))}
              <LocationPicker
                latitude={latitude}
                longitude={longitude}
                address={address}
                onChange={handleLocationChange}
                disabled={isSaving}
              />
            </div>

            {/* Row 3: Opening Balance */}
            <div className="max-w-xs">
              {fieldLabel(t("masters.shops.form.opening_balance"), true)}
              <div className="relative">
                <div className={iconWrapperClass}><IndianRupee size={15} /></div>
                <input
                  ref={balanceInputRef} type="text" inputMode="decimal"
                  value={isBalanceFocused ? openingBalance : formatDisplayBalance(openingBalance)}
                  onChange={handleBalanceChange}
                  onFocus={handleBalanceFocus} onBlur={handleBalanceBlur}
                  placeholder="₹0.00"
                  className={inputClass(!!errors.openingBalance)}
                />
              </div>
              {errors.openingBalance && <p className="text-red-600 text-[11px] mt-0.5">{errors.openingBalance}</p>}
            </div>
          </div>
        </section>
      </div>

      {/* Footer */}
      <div className="flex justify-end gap-3 px-5 py-3 border-t border-slate-200/70 bg-slate-50/60 shrink-0">
        <button type="button" onClick={onCancel} disabled={isSaving}
          className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
          {t("masters.shops.dialog.cancel")}
        </button>
        <button type="button" onClick={handleSubmit} disabled={isSaving}
          className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          {isSaving && (
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
          {isSaving ? t("masters.shops.dialog.saving") : isEditing ? t("masters.shops.dialog.update") : t("masters.shops.dialog.save")}
        </button>
      </div>
    </div>
  );
}

export default ShopForm;
