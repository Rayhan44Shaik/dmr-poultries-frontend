import MasterForm, { MasterSectionHeading } from "../../components/MasterForm";
import MasterDropdown from "../../components/MasterDropdown";
import {
  masterInputClass,
  masterIconClass,
  masterLabelClass,
} from "../../components/masterFormStyles";
import { useId, useRef, useState, useCallback } from "react";
import type { Shop } from "../types/shop";
import { Store, User, Phone, Mail, MapPin, IndianRupee } from "lucide-react";
import { useI18n } from "../../../../i18n";
import { formatINR } from "../../../../utils/format";
import LocationPicker from "../components/LocationPicker";

type ShopFormProps = {
  shop?: Shop | null;
  onSave: (shop: Partial<Shop>) => void;
  onCancel: () => void;
  isSaving?: boolean;
};

const PAPER_RATE_OPTIONS = Array.from({ length: 30 }, (_, i) => i + 1);
const ASSOCIATION_TYPES = ["Vencob Vij", "Vencob Gun", "Ass Vij", "Ass Gun"];

function ShopForm({ shop, onSave, onCancel, isSaving = false }: ShopFormProps) {
  const { t } = useI18n();
  const formId = useId();
  const fieldId = (text: string) => `${formId}-${text.replace(/\s+/g, "-")}`;
  const [shopNumber, setShopNumber] = useState(
    shop?.shopNumber || (shop ? String(shop.shopNo).padStart(6, "0") : ""),
  );
  const [shopName, setShopName] = useState(shop?.shopName ?? "");
  const [ownerName, setOwnerName] = useState(shop?.ownerName ?? "");
  const [phoneNumber, setPhoneNumber] = useState(shop?.phoneNumber ?? "");
  const [secondaryPhoneNumber, setSecondaryPhoneNumber] = useState(
    shop?.secondaryPhoneNumber ?? "",
  );
  const [email, setEmail] = useState(shop?.email ?? "");
  const [city, setCity] = useState(shop?.city ?? "");
  const [address, setAddress] = useState(shop?.address ?? "");
  const [latitude, setLatitude] = useState(
    shop?.latitude !== undefined ? String(shop.latitude) : "",
  );
  const [longitude, setLongitude] = useState(
    shop?.longitude !== undefined ? String(shop.longitude) : "",
  );
  const [paperRate, setPaperRate] = useState(
    shop?.paperRate !== undefined ? String(shop.paperRate) : "1",
  );
  const [associationType, setAssociationType] = useState(
    shop?.associationType ?? "",
  );
  const [openingBalance, setOpeningBalance] = useState(
    shop?.openingBalance !== undefined ? String(shop.openingBalance) : "0",
  );
  const [isBalanceFocused, setIsBalanceFocused] = useState(false);
  const balanceInputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"Active" | "Inactive">(
    shop?.status ?? "Active",
  );

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

  const formatDisplayBalance = useCallback((raw: string): string => {
    const num = parseFloat(raw);
    if (isNaN(num) || raw === "") return "₹0.00";
    return formatINR(num);
  }, []);

  const parseBalanceInput = useCallback((input: string): string => {
    const cleaned = input.replace(/[₹,\s]/g, "");
    const valid = cleaned.replace(/[^0-9.-]/g, "");
    const dotIndex = valid.indexOf(".");
    if (dotIndex !== -1) {
      return (
        valid.substring(0, dotIndex + 1) +
        valid.substring(dotIndex + 1).replace(/\./g, "")
      );
    }
    return valid;
  }, []);

  const handleBalanceChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setOpeningBalance(parseBalanceInput(e.target.value));
    },
    [parseBalanceInput],
  );

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

  const handleLocationChange = useCallback(
    (lat: string, lng: string, addr?: string) => {
      setLatitude(lat);
      setLongitude(lng);
      if (addr !== undefined) setAddress(addr);
    },
    [],
  );

  const handleSubmit = useCallback(() => {
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

    if (shopName.trim().length < 3)
      newErrors.shopName = t("masters.shops.validation.shop_name_min");
    if (ownerName.trim().length < 3)
      newErrors.ownerName = t("masters.shops.validation.owner_name_min");
    if (!/^[0-9]{10}$/.test(phoneNumber))
      newErrors.phoneNumber = t("masters.shops.validation.mobile_10_digits");
    if (
      secondaryPhoneNumber.trim() !== "" &&
      !/^[0-9]{10}$/.test(secondaryPhoneNumber)
    )
      newErrors.secondaryPhoneNumber = t(
        "masters.shops.validation.secondary_mobile_10_digits",
      );
    if (email.trim() !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      newErrors.email = t("masters.shops.validation.email_invalid");
    if (city.trim() === "")
      newErrors.city = t("masters.shops.validation.city_required");

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
      newErrors.associationType = t(
        "masters.shops.validation.association_type_required",
      );

    const parsedBalance = parseFloat(openingBalance);
    if (openingBalance.trim() === "" || isNaN(parsedBalance))
      newErrors.openingBalance = t(
        "masters.shops.validation.opening_balance_required",
      );

    setErrors(newErrors);
    if (Object.values(newErrors).some(Boolean)) return;

    onSave({
      shopNumber: isEditing
        ? shopNumber
        : shopNumber || `SHOP-${String(Date.now()).slice(-6)}`,
      shopName,
      ownerName,
      phoneNumber,
      secondaryPhoneNumber: secondaryPhoneNumber.trim(),
      email,
      city,
      address,
      latitude: latitude.trim() ? Number(latitude) : undefined,
      longitude: longitude.trim() ? Number(longitude) : undefined,
      paperRate: rate,
      associationType,
      status,
      openingBalance: parsedBalance,
    });
  }, [
    shopNumber,
    shopName,
    ownerName,
    phoneNumber,
    secondaryPhoneNumber,
    email,
    city,
    address,
    latitude,
    longitude,
    paperRate,
    associationType,
    openingBalance,
    status,
    isEditing,
    onSave,
    t,
  ]);

  const inputClass = masterInputClass;
  const iconWrapperClass = masterIconClass;

  const fieldLabel = (text: string, required = false) => (
    <label htmlFor={fieldId(text)} className={masterLabelClass}>
      {text}
      {required && (
        <span className="text-red-500 ml-0.5" aria-hidden="true">
          {" "}
          *
        </span>
      )}
    </label>
  );

  const sectionHeading = (label: string) => (
    <MasterSectionHeading>{label}</MasterSectionHeading>
  );

  const title = isEditing
    ? t("masters.shops.dialog.edit_title")
    : t("masters.shops.dialog.add_title");
  const subtitle = isEditing
    ? t("masters.shops.dialog.edit_subtitle")
    : t("masters.shops.dialog.add_subtitle");

  return (
    <MasterForm
      title={title}
      subtitle={subtitle}
      icon={<Store size={20} />}
      status={status}
      onStatusChange={setStatus}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      isSaving={isSaving}
      submitLabel={
        isEditing
          ? t("masters.shops.dialog.update")
          : t("masters.shops.dialog.save")
      }
    >
      {/* SHOP DETAILS */}
      <section className="space-y-3">
        {sectionHeading(t("masters.shops.form.sections.shop_details"))}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {/* Shop Number — read-only when editing */}
          <div>
            {fieldLabel(t("masters.shops.form.shop_number"), true)}
            <div className="relative">
              <div className={iconWrapperClass}>
                <Store size={15} />
              </div>
              <input
                id={fieldId(t("masters.shops.form.shop_number"))}
                value={shopNumber}
                onChange={(e) => setShopNumber(e.target.value.toUpperCase())}
                placeholder={t("masters.shops.form.shop_number_placeholder")}
                className={
                  isEditing
                    ? `${inputClass()} bg-slate-50 text-slate-500 cursor-not-allowed`
                    : inputClass(!!errors.shopNumber)
                }
                disabled={isEditing}
                readOnly={isEditing}
              />
            </div>
            {errors.shopNumber && (
              <p className="text-red-600 text-[11px] mt-0.5">
                {errors.shopNumber}
              </p>
            )}
            {isEditing && (
              <p className="text-[11px] text-slate-400 mt-1">
                Cannot be changed after creation
              </p>
            )}
          </div>

          {/* Shop Name */}
          <div>
            {fieldLabel(t("masters.shops.form.shop_name"), true)}
            <div className="relative">
              <div className={iconWrapperClass}>
                <Store size={15} />
              </div>
              <input
                id={fieldId(t("masters.shops.form.shop_name"))}
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                placeholder={t("masters.shops.form.shop_name_placeholder")}
                className={inputClass(!!errors.shopName)}
              />
            </div>
            {errors.shopName && (
              <p className="text-red-600 text-[11px] mt-0.5">
                {errors.shopName}
              </p>
            )}
          </div>

          {/* Owner Name */}
          <div>
            {fieldLabel(t("masters.shops.form.owner_name"), true)}
            <div className="relative">
              <div className={iconWrapperClass}>
                <User size={15} />
              </div>
              <input
                id={fieldId(t("masters.shops.form.owner_name"))}
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder={t("masters.shops.form.owner_name_placeholder")}
                className={inputClass(!!errors.ownerName)}
              />
            </div>
            {errors.ownerName && (
              <p className="text-red-600 text-[11px] mt-0.5">
                {errors.ownerName}
              </p>
            )}
          </div>

          {/* Mobile Number */}
          <div>
            {fieldLabel(t("masters.shops.form.mobile_number"), true)}
            <div className="relative">
              <div className={iconWrapperClass}>
                <Phone size={15} />
              </div>
              <input
                id={fieldId(t("masters.shops.form.mobile_number"))}
                value={phoneNumber}
                maxLength={10}
                onChange={(e) =>
                  setPhoneNumber(e.target.value.replace(/\D/g, ""))
                }
                placeholder={t("masters.shops.form.mobile_number_placeholder")}
                className={inputClass(!!errors.phoneNumber)}
              />
            </div>
            {errors.phoneNumber && (
              <p className="text-red-600 text-[11px] mt-0.5">
                {errors.phoneNumber}
              </p>
            )}
          </div>

          {/* Secondary Mobile */}
          <div>
            {fieldLabel(t("masters.shops.form.secondary_mobile_number"))}
            <div className="relative">
              <div className={iconWrapperClass}>
                <Phone size={15} />
              </div>
              <input
                id={fieldId(t("masters.shops.form.secondary_mobile_number"))}
                value={secondaryPhoneNumber}
                maxLength={10}
                onChange={(e) =>
                  setSecondaryPhoneNumber(e.target.value.replace(/\D/g, ""))
                }
                placeholder={t(
                  "masters.shops.form.secondary_mobile_number_placeholder",
                )}
                className={inputClass(!!errors.secondaryPhoneNumber)}
              />
            </div>
            {errors.secondaryPhoneNumber && (
              <p className="text-red-600 text-[11px] mt-0.5">
                {errors.secondaryPhoneNumber}
              </p>
            )}
          </div>

          {/* Email */}
          <div>
            {fieldLabel(t("masters.shops.form.email"))}
            <div className="relative">
              <div className={iconWrapperClass}>
                <Mail size={15} />
              </div>
              <input
                id={fieldId(t("masters.shops.form.email"))}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("masters.shops.form.email_placeholder")}
                className={inputClass(!!errors.email)}
              />
            </div>
            {errors.email && (
              <p className="text-red-600 text-[11px] mt-0.5">{errors.email}</p>
            )}
          </div>
        </div>
      </section>

      {/* ADDRESS & BUSINESS DETAILS */}
      <section className="space-y-3">
        {sectionHeading(t("masters.shops.form.sections.address"))}
        <div className="space-y-3">
          {/* Row 1: City | Association Type | Paper Rate */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* City */}
            <div>
              {fieldLabel(t("masters.shops.form.city"), true)}
              <div className="relative">
                <div className={iconWrapperClass}>
                  <MapPin size={15} />
                </div>
                <input
                  id={fieldId(t("masters.shops.form.city"))}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder={t("masters.shops.form.city_placeholder")}
                  className={inputClass(!!errors.city)}
                />
              </div>
              {errors.city && (
                <p className="text-red-600 text-[11px] mt-0.5">{errors.city}</p>
              )}
            </div>

            <MasterDropdown
              label={t("masters.shops.form.association_type")}
              labelStyle="field"
              required
              value={associationType}
              onChange={setAssociationType}
              options={ASSOCIATION_TYPES}
              placeholder={t("masters.shops.form.association_type_placeholder")}
              disabled={isSaving}
              error={errors.associationType}
            />
            <MasterDropdown
              label={t("masters.shops.form.paper_rate")}
              labelStyle="field"
              required
              searchable
              value={paperRate}
              onChange={setPaperRate}
              options={PAPER_RATE_OPTIONS.map(String)}
              placeholder={t("masters.ui.select_paper_rate")}
              disabled={isSaving}
              error={errors.paperRate}
            />
          </div>

          {/* Row 2: Full Address + Get GPS */}
          <div>
            {fieldLabel(t("masters.shops.form.full_address"))}
            <LocationPicker
              id={fieldId(t("masters.shops.form.full_address"))}
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
              <div className={iconWrapperClass}>
                <IndianRupee size={15} />
              </div>
              <input
                id={fieldId(t("masters.shops.form.opening_balance"))}
                ref={balanceInputRef}
                type="text"
                inputMode="decimal"
                value={
                  isBalanceFocused
                    ? openingBalance
                    : formatDisplayBalance(openingBalance)
                }
                onChange={handleBalanceChange}
                onFocus={handleBalanceFocus}
                onBlur={handleBalanceBlur}
                placeholder="₹0.00"
                className={inputClass(!!errors.openingBalance)}
              />
            </div>
            {errors.openingBalance && (
              <p className="text-red-600 text-[11px] mt-0.5">
                {errors.openingBalance}
              </p>
            )}
          </div>
        </div>
      </section>
    </MasterForm>
  );
}

export default ShopForm;
