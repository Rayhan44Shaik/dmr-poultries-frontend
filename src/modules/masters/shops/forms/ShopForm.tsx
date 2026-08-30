import { useEffect, useState } from "react";
import type { Shop } from "../types/shop";
import {
  Store,
  User,
  Phone,
  Mail,
  MapPin,
  Home,
  IndianRupee,
  Globe,
  Settings,
} from "lucide-react";
import { useI18n } from "../../../../i18n";
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

const ASSOCIATION_TYPES = [
  "Association A",
  "Association B",
  "Association C",
  "Association D",
  "Independent",
  "Other",
];

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
  const [openingBalance, setOpeningBalance] = useState("0.00");
  const [status, setStatus] = useState<"Active" | "Inactive">("Active");

  const [errors, setErrors] = useState({
    shopNumber: "",
    shopName: "",
    ownerName: "",
    phoneNumber: "",
    secondaryPhoneNumber: "",
    email: "",
    city: "",
    latitude: "",
    longitude: "",
    paperRate: "",
    associationType: "",
    openingBalance: "",
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
      setOpeningBalance(shop.openingBalance !== undefined ? String(shop.openingBalance) : "0.00");
      setStatus(shop.status);
    } else {
      setShopNumber("");
      setShopName("");
      setOwnerName("");
      setPhoneNumber("");
      setSecondaryPhoneNumber("");
      setEmail("");
      setCity("");
      setAddress("");
      setLatitude("");
      setLongitude("");
      setPaperRate("1");
      setAssociationType("");
      setOpeningBalance("0.00");
      setStatus("Active");
    }
    setErrors({
      shopNumber: "",
      shopName: "",
      ownerName: "",
      phoneNumber: "",
      secondaryPhoneNumber: "",
      email: "",
      city: "",
      latitude: "",
      longitude: "",
      paperRate: "",
      associationType: "",
      openingBalance: "",
    });
  }, [shop]);

  const handleSubmit = () => {
    const newErrors = {
      shopNumber: "",
      shopName: "",
      ownerName: "",
      phoneNumber: "",
      secondaryPhoneNumber: "",
      email: "",
      city: "",
      latitude: "",
      longitude: "",
      paperRate: "",
      associationType: "",
      openingBalance: "",
    };

    if (shopName.trim().length < 3) {
      newErrors.shopName = t("masters.shops.validation.shop_name_min");
    }
    if (ownerName.trim().length < 3) {
      newErrors.ownerName = t("masters.shops.validation.owner_name_min");
    }
    if (!/^[0-9]{10}$/.test(phoneNumber)) {
      newErrors.phoneNumber = t("masters.shops.validation.mobile_10_digits");
    }
    if (secondaryPhoneNumber.trim() !== "" && !/^[0-9]{10}$/.test(secondaryPhoneNumber)) {
      newErrors.secondaryPhoneNumber = t("masters.shops.validation.secondary_mobile_10_digits");
    }
    if (email.trim() !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = t("masters.shops.validation.email_invalid");
    }
    if (city.trim() === "") {
      newErrors.city = t("masters.shops.validation.city_required");
    }

    const lat = parseFloat(latitude);
    if (latitude.trim() !== "" && (isNaN(lat) || lat < -90 || lat > 90)) {
      newErrors.latitude = t("masters.shops.validation.latitude_invalid");
    }

    const lng = parseFloat(longitude);
    if (longitude.trim() !== "" && (isNaN(lng) || lng < -180 || lng > 180)) {
      newErrors.longitude = t("masters.shops.validation.longitude_invalid");
    }

    const rate = parseInt(paperRate, 10);
    if (paperRate.trim() === "" || isNaN(rate) || rate < 1 || rate > 30) {
      newErrors.paperRate = t("masters.shops.validation.paper_rate_invalid");
    }

    if (associationType.trim() === "") {
      newErrors.associationType = t("masters.shops.validation.association_type_required");
    }

    const parsedBalance = parseFloat(openingBalance);
    if (openingBalance.trim() === "" || isNaN(parsedBalance)) {
      newErrors.openingBalance = t("masters.shops.validation.opening_balance_required");
    }

    setErrors(newErrors);

    if (
      newErrors.shopName ||
      newErrors.ownerName ||
      newErrors.phoneNumber ||
      newErrors.secondaryPhoneNumber ||
      newErrors.email ||
      newErrors.city ||
      newErrors.latitude ||
      newErrors.longitude ||
      newErrors.paperRate ||
      newErrors.associationType ||
      newErrors.openingBalance
    ) {
      return;
    }

    onSave({
      shopNumber: isEditing ? shopNumber : shopNumber || `SHOP-${String(Date.now()).slice(-6)}`,
      shopName,
      ownerName,
      phoneNumber,
      secondaryPhoneNumber: secondaryPhoneNumber.trim(),
      email,
      city,
      address,
      latitude: latitude.trim() || "0",
      longitude: longitude.trim() || "0",
      paperRate: rate,
      associationType,
      status,
      openingBalance: parsedBalance,
    });
  };

  const inputClass = (hasError = false) =>
    `w-full pl-10 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150 ${
      hasError ? "border-red-500" : "border-slate-200"
    } bg-white hover:shadow-sm focus:shadow-md appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`;

  const selectClass = (hasError = false) =>
    `w-full pl-10 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150 ${
      hasError ? "border-red-500" : "border-slate-200"
    } bg-white hover:shadow-sm focus:shadow-md appearance-none cursor-pointer`;

  const textareaClass = (hasError = false) =>
    `w-full pl-10 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-150 ${
      hasError ? "border-red-500" : "border-slate-200"
    } bg-white hover:shadow-sm focus:shadow-md resize-y`;

  const iconWrapperClass = "absolute left-3 top-1/2 -translate-y-1/2 text-slate-400";

  const title = isEditing ? t("masters.shops.dialog.edit_title") : t("masters.shops.dialog.add_title");
  const subtitle = isEditing ? t("masters.shops.dialog.edit_subtitle") : t("masters.shops.dialog.add_subtitle");

  const toggleStatus = () => {
    if (!isSaving) {
      setStatus(status === "Active" ? "Inactive" : "Active");
    }
  };

  const sectionStyle = "mb-5";
  const sectionTitleStyle = "flex items-center gap-1.5 text-sm font-semibold text-slate-700 mb-3 pb-1.5 border-b border-slate-100";
  const labelStyle = "block text-xs font-medium text-slate-600 mb-1";
  const requiredStar = <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>;

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200/60 overflow-hidden max-h-[90vh] flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 px-5 py-3.5 flex items-center justify-between border-b border-slate-200/60 shrink-0 gap-4">
        <div className="flex items-center gap-2.5">
          <div className="bg-blue-100 p-2 rounded-lg">
            <Store className="h-4.5 w-4.5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 tracking-tight">{title}</h2>
            <p className="text-[11px] text-slate-500 font-medium">{subtitle}</p>
          </div>
        </div>

        {/* Status toggle switch in header */}
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <span className="text-xs font-medium text-slate-600 hidden sm:inline">{t("masters.shops.form.status")}</span>
          <button
            type="button"
            onClick={toggleStatus}
            disabled={isSaving}
            className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-200 ${
              status === "Active" ? "bg-emerald-500" : "bg-slate-300"
            } ${isSaving ? "opacity-60 cursor-not-allowed" : ""}`}
            aria-label={t("masters.shops.form.status")}
          >
            <span
              className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                status === "Active" ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
          <span
            className={`text-xs font-medium hidden sm:inline ${
              status === "Active" ? "text-emerald-600" : "text-slate-500"
            }`}
          >
            {status}
          </span>
        </div>
      </div>

      {/* Form body - scrollable */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* SHOP DETAILS */}
        <section className={sectionStyle}>
          <h3 className={sectionTitleStyle}>
            <Store className="h-4 w-4 text-blue-600" />
            {t("masters.shops.form.sections.shop_details")}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Shop Number */}
            <div className="relative">
              <label className={labelStyle}>
                {t("masters.shops.form.shop_number")} {requiredStar}
              </label>
              <div className="relative">
                <div className={iconWrapperClass}>
                  <Store size={15} />
                </div>
                <input
                  value={shopNumber}
                  onChange={(e) => setShopNumber(e.target.value.toUpperCase())}
                  placeholder={t("masters.shops.form.shop_number_placeholder")}
                  className={inputClass(!!errors.shopNumber)}
                  disabled={isEditing}
                  readOnly={isEditing}
                />
              </div>
              {errors.shopNumber && (
                <p className="text-red-600 text-xs mt-1">{errors.shopNumber}</p>
              )}
              {isEditing && (
                <p className="text-[10px] text-slate-400 mt-1">{t("masters.shops.form.shop_number_readonly_hint")}</p>
              )}
            </div>

            {/* Shop Name */}
            <div className="relative">
              <label className={labelStyle}>
                {t("masters.shops.form.shop_name")} {requiredStar}
              </label>
              <div className="relative">
                <div className={iconWrapperClass}>
                  <Store size={15} />
                </div>
                <input
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder={t("masters.shops.form.shop_name_placeholder")}
                  className={inputClass(!!errors.shopName)}
                />
              </div>
              {errors.shopName && (
                <p className="text-red-600 text-xs mt-1">{errors.shopName}</p>
              )}
            </div>

            {/* Owner Name */}
            <div className="relative">
              <label className={labelStyle}>
                {t("masters.shops.form.owner_name")} {requiredStar}
              </label>
              <div className="relative">
                <div className={iconWrapperClass}>
                  <User size={15} />
                </div>
                <input
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                  placeholder={t("masters.shops.form.owner_name_placeholder")}
                  className={inputClass(!!errors.ownerName)}
                />
              </div>
              {errors.ownerName && (
                <p className="text-red-600 text-xs mt-1">{errors.ownerName}</p>
              )}
            </div>

            {/* Mobile Number */}
            <div className="relative">
              <label className={labelStyle}>
                {t("masters.shops.form.mobile_number")} {requiredStar}
              </label>
              <div className="relative">
                <div className={iconWrapperClass}>
                  <Phone size={15} />
                </div>
                <input
                  value={phoneNumber}
                  maxLength={10}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ""))}
                  placeholder={t("masters.shops.form.mobile_number_placeholder")}
                  className={inputClass(!!errors.phoneNumber)}
                />
              </div>
              {errors.phoneNumber && (
                <p className="text-red-600 text-xs mt-1">{errors.phoneNumber}</p>
              )}
            </div>

            {/* Secondary Mobile */}
            <div className="relative">
              <label className={labelStyle}>
                {t("masters.shops.form.secondary_mobile_number")}
              </label>
              <div className="relative">
                <div className={iconWrapperClass}>
                  <Phone size={15} />
                </div>
                <input
                  value={secondaryPhoneNumber}
                  maxLength={10}
                  onChange={(e) => setSecondaryPhoneNumber(e.target.value.replace(/\D/g, ""))}
                  placeholder={t("masters.shops.form.secondary_mobile_number_placeholder")}
                  className={inputClass(!!errors.secondaryPhoneNumber)}
                />
              </div>
              {errors.secondaryPhoneNumber && (
                <p className="text-red-600 text-xs mt-1">{errors.secondaryPhoneNumber}</p>
              )}
            </div>

            {/* Email */}
            <div className="relative">
              <label className={labelStyle}>
                {t("masters.shops.form.email")}
              </label>
              <div className="relative">
                <div className={iconWrapperClass}>
                  <Mail size={15} />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("masters.shops.form.email_placeholder")}
                  className={inputClass(!!errors.email)}
                />
              </div>
              {errors.email && (
                <p className="text-red-600 text-xs mt-1">{errors.email}</p>
              )}
            </div>
          </div>
        </section>

        {/* ADDRESS */}
        <section className={sectionStyle}>
          <h3 className={sectionTitleStyle}>
            <MapPin className="h-4 w-4 text-blue-600" />
            {t("masters.shops.form.sections.address")}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* City */}
            <div className="relative">
              <label className={labelStyle}>
                {t("masters.shops.form.city")} {requiredStar}
              </label>
              <div className="relative">
                <div className={iconWrapperClass}>
                  <MapPin size={15} />
                </div>
                <input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder={t("masters.shops.form.city_placeholder")}
                  className={inputClass(!!errors.city)}
                />
              </div>
              {errors.city && (
                <p className="text-red-600 text-xs mt-1">{errors.city}</p>
              )}
            </div>

            {/* Full Address */}
            <div className="relative sm:col-span-2">
              <label className={labelStyle}>
                {t("masters.shops.form.full_address")}
              </label>
              <div className="relative">
                <div className="absolute left-3 top-2.5 text-slate-400">
                  <Home size={15} />
                </div>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={t("masters.shops.form.full_address_placeholder")}
                  rows={2}
                  className={textareaClass()}
                />
              </div>
            </div>
          </div>
        </section>

        {/* LOCATION */}
        <section className={sectionStyle}>
          <h3 className={sectionTitleStyle}>
            <Globe className="h-4 w-4 text-blue-600" />
            {t("masters.shops.form.sections.location")}
          </h3>

          <LocationPicker
            latitude={latitude}
            longitude={longitude}
            onChange={(lat, lng) => {
              setLatitude(lat);
              setLongitude(lng);
            }}
            onLocationCaptured={() => {}}
            disabled={isSaving}
          />
        </section>

        {/* BUSINESS DETAILS */}
        <section className={sectionStyle}>
          <h3 className={sectionTitleStyle}>
            <Settings className="h-4 w-4 text-blue-600" />
            {t("masters.shops.form.sections.business_details")}
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Association Type */}
            <div className="relative">
              <label className={labelStyle}>
                {t("masters.shops.form.association_type")} {requiredStar}
              </label>
              <div className="relative">
                <div className={iconWrapperClass}>
                  <Settings size={15} />
                </div>
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
              </div>
              {errors.associationType && (
                <p className="text-red-600 text-xs mt-1">{errors.associationType}</p>
              )}
            </div>

            {/* Paper Rate */}
            <div className="relative">
              <label className={labelStyle}>
                {t("masters.shops.form.paper_rate")} {requiredStar}
              </label>
              <div className="relative">
                <div className={iconWrapperClass}>
                  <IndianRupee size={15} />
                </div>
                <select
                  value={paperRate}
                  onChange={(e) => setPaperRate(e.target.value)}
                  className={selectClass(!!errors.paperRate)}
                >
                  {PAPER_RATE_OPTIONS.map((rate) => (
                    <option key={rate} value={String(rate)}>{rate}</option>
                  ))}
                </select>
              </div>
              {errors.paperRate && (
                <p className="text-red-600 text-xs mt-1">{errors.paperRate}</p>
              )}
            </div>

            {/* Opening Balance */}
            <div className="relative sm:col-span-2">
              <label className={labelStyle}>
                {t("masters.shops.form.opening_balance")} {requiredStar}
              </label>
              <div className="relative">
                <div className={iconWrapperClass}>
                  <IndianRupee size={15} />
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  placeholder={t("masters.shops.form.opening_balance_placeholder")}
                  className={inputClass(!!errors.openingBalance)}
                />
              </div>
              {errors.openingBalance && (
                <p className="text-red-600 text-xs mt-1">{errors.openingBalance}</p>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Footer - sticky */}
      <div className="flex justify-end gap-3 px-5 py-3.5 border-t border-slate-200/60 bg-slate-50/50 shrink-0">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t("masters.shops.dialog.cancel")}
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isSaving}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
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