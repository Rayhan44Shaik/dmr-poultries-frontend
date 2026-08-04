import React, { memo, useState, useMemo } from 'react';
import Select from 'react-select';
import { DatePicker } from '../../../../components/common/DatePicker';
import { Car, User, Gauge, Wrench, Cog, Building2, UserCog, FileText, Hash } from 'lucide-react';
import PartsTable from './PartsTable';
import type { PartItem } from '../../types';
import { useFuelKMValidator } from "../../../operations/fuel-expenses/hooks/useFuelKMValidator";
import { useSafeNotification } from '../../../../hooks/useSafeNotification';

interface MaintenanceFormProps {
  form: {
    vehicleId: string;
    date: string;
    billNumber: string;
    currentKM: string;
    maintenanceType: string[];   // now an array for multi‑select
    serviceType: string;
    garage: string;
    mechanic: string;
    driverId: string;
    driverName: string;
    nextServiceKM: string;
    remarks: string;
    id?: string;
  };
  parts: PartItem[];
  setParts: (parts: PartItem[]) => void;
  vehicleOptions: { value: string; label: string }[];
  driverOptions: { value: string; label: string }[];
  maintenanceOptions: { value: string; label: string }[];
  onVehicleChange: (selected: any) => void;
  onDriverChange: (selected: any) => void;
  onMaintenanceChange: (selected: any) => void;  // receives array of selected values
  setFormField: (field: string, value: any) => void;
  selectKey: number;
}

const MaintenanceForm: React.FC<MaintenanceFormProps> = ({
  form,
  parts,
  setParts,
  vehicleOptions,
  driverOptions,
  maintenanceOptions,
  onVehicleChange,
  onDriverChange,
  onMaintenanceChange,
  setFormField,
  selectKey,
}) => {
  const { showNotification } = useSafeNotification();
  const [kmError, setKmError] = useState<string | null>(null);

  // Get vehicle number from selected vehicle option
  const selectedVehicleOption = useMemo(
    () => vehicleOptions.find(opt => opt.value === form.vehicleId),
    [vehicleOptions, form.vehicleId]
  );
  const vehicleNumber = selectedVehicleOption?.label || '';

  const validator = useFuelKMValidator(vehicleNumber);
  const pendingWarning = validator.getPendingWarning();

  const inputClass =
    'w-full h-10 pl-10 pr-3 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition bg-white';

  const handleCurrentKMChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    
    // Allow empty value
    if (val === '') {
      setFormField('currentKM', '');
      setKmError(null);
      return;
    }
    
    const num = parseFloat(val);
    if (isNaN(num)) {
      setKmError('Please enter a valid number');
      return;
    }
    
    // Always update the form field with the raw value
    setFormField('currentKM', val);
    
    // Validate the value
    const { valid, message } = validator.validateKM(num);
    if (!valid) {
      setKmError(message || 'Invalid KM');
    } else {
      setKmError(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Row 1: Bill Number, Vehicle, Date, Driver */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* 1. Bill Number */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
            Bill Number
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Hash size={16} className="text-slate-400" />
            </div>
            <input
              type="text"
              value={form.billNumber}
              onChange={(e) => setFormField('billNumber', e.target.value)}
              placeholder="Auto‑generated"
              className={inputClass}
            />
          </div>
        </div>

        {/* 2. Vehicle */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
            Vehicle <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
              <Car size={16} className="text-slate-400" />
            </div>
            <Select
              key={`vehicle-${selectKey}`}
              options={vehicleOptions}
              value={vehicleOptions.find(opt => opt.value === form.vehicleId)}
              onChange={onVehicleChange}
              placeholder="Select vehicle"
              isClearable
              className="text-sm"
              styles={{
                control: (base) => ({
                  ...base,
                  minHeight: '40px',
                  paddingLeft: '28px',
                  borderColor: '#cbd5e1',
                  boxShadow: 'none',
                  borderRadius: '0.75rem',
                  '&:hover': { borderColor: '#94a3b8' }
                }),
                placeholder: (base) => ({ ...base, color: '#9ca3af' }),
              }}
            />
          </div>
        </div>

        {/* 3. Date */}
        <div>
          <DatePicker
            label="Date"
            required
            value={form.date}
            onChange={(dateStr) => setFormField('date', dateStr)}
            placeholder="Select date"
          />
        </div>

        {/* 4. Driver */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
            Driver
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
              <User size={16} className="text-slate-400" />
            </div>
            <Select
              key={`driver-${selectKey}`}
              options={driverOptions}
              value={driverOptions.find(opt => opt.value === form.driverId)}
              onChange={onDriverChange}
              placeholder="Select driver"
              isClearable
              className="text-sm"
              styles={{
                control: (base) => ({
                  ...base,
                  minHeight: '40px',
                  paddingLeft: '28px',
                  borderColor: '#cbd5e1',
                  boxShadow: 'none',
                  borderRadius: '0.75rem',
                  '&:hover': { borderColor: '#94a3b8' }
                }),
                placeholder: (base) => ({ ...base, color: '#9ca3af' }),
              }}
            />
          </div>
        </div>
      </div>

      {/* Row 2: Current KM, Next KM, Garage, Mechanic */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* 5. Current KM */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
            Current KM <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Gauge size={16} className="text-slate-400" />
            </div>
            <input
              type="number"
              value={form.currentKM}
              onChange={handleCurrentKMChange}
              placeholder="e.g. 45000"
              className={`${inputClass} ${kmError ? 'border-red-500' : ''} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
            />
          </div>
          {kmError && <p className="mt-1 text-xs text-red-500">{kmError}</p>}
        </div>

        {/* 6. Next Service KM */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
            Next Service KM
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Gauge size={16} className="text-slate-400" />
            </div>
            <input
              type="number"
              value={form.nextServiceKM}
              onChange={(e) => setFormField('nextServiceKM', e.target.value)}
              placeholder="e.g. 50000"
              className={`${inputClass} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
            />
          </div>
        </div>

        {/* 7. Garage */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
            Garage
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Building2 size={16} className="text-slate-400" />
            </div>
            <input
              type="text"
              value={form.garage}
              onChange={(e) => setFormField('garage', e.target.value)}
              placeholder="Garage name"
              className={inputClass}
            />
          </div>
        </div>

        {/* 8. Mechanic */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
            Mechanic
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <UserCog size={16} className="text-slate-400" />
            </div>
            <input
              type="text"
              value={form.mechanic}
              onChange={(e) => setFormField('mechanic', e.target.value)}
              placeholder="Mechanic name"
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Row 3: Maintenance Type (multi‑select), Service Type, Remarks */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 9. Maintenance Type - big box (multi) */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
            Maintenance Type <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
              <Cog size={16} className="text-slate-400" />
            </div>
            <Select
              key={`maintenance-${selectKey}`}
              options={maintenanceOptions}
              value={maintenanceOptions.filter(opt => form.maintenanceType.includes(opt.value))}
              onChange={onMaintenanceChange}
              placeholder="Select types"
              isMulti
              isClearable
              className="text-sm"
              styles={{
                control: (base) => ({
                  ...base,
                  minHeight: '40px',
                  paddingLeft: '28px',
                  borderColor: '#cbd5e1',
                  boxShadow: 'none',
                  borderRadius: '0.75rem',
                  '&:hover': { borderColor: '#94a3b8' }
                }),
                placeholder: (base) => ({ ...base, color: '#9ca3af' }),
              }}
            />
          </div>
        </div>

        {/* 10. Service Type */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
            Service Type <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Wrench size={16} className="text-slate-400" />
            </div>
            <input
              type="text"
              value={form.serviceType}
              onChange={(e) => setFormField('serviceType', e.target.value)}
              placeholder="e.g. Oil Change"
              className={inputClass}
            />
          </div>
        </div>

        {/* 11. Remarks */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
            Remarks
          </label>
          <div className="relative">
            <div className="absolute top-2.5 left-3 pointer-events-none">
              <FileText size={16} className="text-slate-400" />
            </div>
            <textarea
              value={form.remarks}
              onChange={(e) => setFormField('remarks', e.target.value)}
              rows={1}
              placeholder="Any additional notes..."
              className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition resize-y bg-white"
            />
          </div>
        </div>
      </div>

      {/* Parts Table */}
      <div className="border-t border-slate-200 pt-5">
        <PartsTable parts={parts} setParts={setParts} hideSubline={true} />
      </div>
    </div>
  );
};

export default memo(MaintenanceForm);