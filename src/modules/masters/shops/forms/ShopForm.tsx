import { useEffect, useState } from "react";
import type { Shop } from "../types/shop";

type ShopFormProps = {
  shop?: Shop | null;

  onSave: (shop: {
    shopName: string;
    ownerName: string;
    phoneNumber: string;
    village: string;
    address: string;
    status: "Active" | "Inactive";
  }) => void;

  onCancel: () => void;
};

function ShopForm({
  shop,
  onSave,
  onCancel,
}: ShopFormProps) {

  const [shopName, setShopName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [village, setVillage] = useState("");
  const [address, setAddress] = useState("");
  const [status, setStatus] =
    useState<"Active" | "Inactive">("Active");

  const [errors, setErrors] = useState({
    shopName: "",
    ownerName: "",
    phoneNumber: "",
    village: "",
  });

  useEffect(() => {

    if (shop) {

      setShopName(shop.shopName);
      setOwnerName(shop.ownerName);
      setPhoneNumber(shop.phoneNumber);
      setVillage(shop.village);
      setAddress(shop.address ?? "");
      setStatus(shop.status);

    } else {

      setShopName("");
      setOwnerName("");
      setPhoneNumber("");
      setVillage("");
      setAddress("");
      setStatus("Active");

    }

    setErrors({
      shopName: "",
      ownerName: "",
      phoneNumber: "",
      village: "",
    });

  }, [shop]);

  const handleSubmit = () => {

    const newErrors = {
      shopName: "",
      ownerName: "",
      phoneNumber: "",
      village: "",
    };

    if (shopName.trim().length < 3) {
      newErrors.shopName =
        "Shop Name must contain at least 3 characters.";
    }

    if (ownerName.trim().length < 3) {
      newErrors.ownerName =
        "Owner Name must contain at least 3 characters.";
    }

    if (!/^[0-9]{10}$/.test(phoneNumber)) {
      newErrors.phoneNumber =
        "Mobile Number must be exactly 10 digits.";
    }

    if (village.trim() === "") {
      newErrors.village = "Village is required.";
    }

    setErrors(newErrors);

    if (
      newErrors.shopName ||
      newErrors.ownerName ||
      newErrors.phoneNumber ||
      newErrors.village
    ) {
      return;
    }

    onSave({
      shopName,
      ownerName,
      phoneNumber,
      village,
      address,
      status,
    });

  };

  return (

    <div className="space-y-5">

      <div>

        <label className="block mb-2 text-sm font-medium text-slate-700">
          Shop Name <span className="text-red-500">*</span>
        </label>

        <input
          value={shopName}
          onChange={(e) => setShopName(e.target.value)}
          placeholder="Enter Shop Name"
          className="w-full border rounded-lg p-3"
        />

        {errors.shopName && (
          <p className="text-red-600 text-sm mt-1">
            {errors.shopName}
          </p>
        )}

      </div>

      <div>

        <label className="block mb-2 text-sm font-medium text-slate-700">
          Owner Name <span className="text-red-500">*</span>
        </label>

        <input
          value={ownerName}
          onChange={(e) => setOwnerName(e.target.value)}
          placeholder="Enter Owner Name"
          className="w-full border rounded-lg p-3"
        />

        {errors.ownerName && (
          <p className="text-red-600 text-sm mt-1">
            {errors.ownerName}
          </p>
        )}

      </div>

      <div>

        <label className="block mb-2 text-sm font-medium text-slate-700">
          Mobile Number <span className="text-red-500">*</span>
        </label>

        <input
          value={phoneNumber}
          maxLength={10}
          onChange={(e) =>
            setPhoneNumber(
              e.target.value.replace(/\D/g, "")
            )
          }
          placeholder="Enter Mobile Number"
          className="w-full border rounded-lg p-3"
        />

        {errors.phoneNumber && (
          <p className="text-red-600 text-sm mt-1">
            {errors.phoneNumber}
          </p>
        )}

      </div>

      <div>

        <label className="block mb-2 text-sm font-medium text-slate-700">
          Village <span className="text-red-500">*</span>
        </label>

        <input
          value={village}
          onChange={(e) => setVillage(e.target.value)}
          placeholder="Enter Village"
          className="w-full border rounded-lg p-3"
        />

        {errors.village && (
          <p className="text-red-600 text-sm mt-1">
            {errors.village}
          </p>
        )}

      </div>

      <div>

        <label className="block mb-2 text-sm font-medium text-slate-700">
          Address
        </label>

        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Enter Address"
          className="w-full border rounded-lg p-3"
        />

      </div>

      <div>

        <label className="block mb-2 text-sm font-medium text-slate-700">
          Shop Status
        </label>

        <select
          value={status}
          onChange={(e) =>
            setStatus(e.target.value as "Active" | "Inactive")
          }
          className="w-full border rounded-lg p-3"
        >
          <option value="Active">Active</option>
          <option value="Inactive">Inactive</option>
        </select>

      </div>

      <div className="flex justify-end gap-3 pt-3">

        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border rounded-lg hover:bg-gray-100"
        >
          Cancel
        </button>

        <button
          type="button"
          onClick={handleSubmit}
          className="px-6 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg"
        >
          {shop ? "Update Shop" : "Save Shop"}
        </button>

      </div>

    </div>

  );

}

export default ShopForm;