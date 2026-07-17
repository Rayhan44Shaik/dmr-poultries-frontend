import { memo, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useVehicles } from '../../masters/vehicles/hooks/useVehicles';
import { useEmployees } from '../../masters/employees/hooks/useEmployees';
import { useToast } from '../hooks/useToast';
import { addMaintenance, updateMaintenance, getMaintenance } from '../services/storage';
// import { validateMaintenance } from '../services/validation'; // ← removed unused
import { MAINTENANCE_TYPES } from '../utils/constants';
import ErrorBoundary from '../components/common/ErrorBoundary';
import PartsTable from '../components/maintenance/PartsTable';
import type { MaintenanceEvent, PartItem } from '../types';
import LatestMaintenanceTable from '../components/maintenance/LatestMaintenanceTable';
import Select from 'react-select';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";

// Helper to check if a record is editable (within 10 days of creation)
const isEditable = (createdAt?: string): boolean => {
  if (!createdAt) return false;
  const created = new Date(createdAt);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= 10;
};

// Safe date creation (handles undefined)
const safeDate = (value?: string | number): Date => {
  if (!value) return new Date();
  const d = new Date(value);
  return isNaN(d.getTime()) ? new Date() : d;
};

const MaintenanceEntryPage = () => {
  const { vehicles } = useVehicles();
  const { employees } = useEmployees();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const datePickerRef = useRef<DatePicker>(null);

  const [form, setForm] = useState({
    id: '',
    vehicleId: '',
    date: new Date(),
    currentKM: '',
    maintenanceType: '',
    serviceType: '',
    garage: '',
    mechanic: '',
    driverId: '',
    driverName: '',
    nextServiceKM: '',
    remarks: '',
    createdAt: '',
  });

  const [parts, setParts] = useState<PartItem[]>([
    { name: '', specification: '', quantity: 1, rate: 0, amount: 0 },
  ]);

  const totalCost = useMemo(() => {
    return parts.reduce((sum, p) => sum + (p.amount || 0), 0);
  }, [parts]);

  const vehicleOptions = useMemo(() => {
    return vehicles.map((v: any) => ({
      value: v.id,
      label: v.vehicleNumber,
    }));
  }, [vehicles]);

  const driverOptions = useMemo(() => {
    return employees
      .filter((e: any) => e.department?.toLowerCase() === 'driver')
      .map((e: any) => ({
        value: e.id,
        label: e.employeeName,
      }));
  }, [employees]);

  const maintenanceOptions = useMemo(() => {
    return MAINTENANCE_TYPES.map((type) => ({
      value: type,
      label: type,
    }));
  }, []);

  const [selectKey, setSelectKey] = useState(0);

  // ----- Bottom table: latest maintenance per vehicle -----
  const [latestRecords, setLatestRecords] = useState<any[]>([]);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewRecord, setViewRecord] = useState<MaintenanceEvent | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  const refreshLatestRecords = useCallback(() => {
    const allRecords = getMaintenance() as MaintenanceEvent[];
    const grouped: Record<string, MaintenanceEvent> = {};
    allRecords.forEach(rec => {
      const key = rec.vehicleId;
      const existing = grouped[key];
      if (!existing) {
        grouped[key] = rec;
      } else {
        const recDate = safeDate(rec.date);
        const existingDate = safeDate(existing.date);
        if (recDate > existingDate) {
          grouped[key] = rec;
        } else if (recDate.getTime() === existingDate.getTime()) {
          const recTime = safeDate(rec.createdAt || rec.id || '').getTime();
          const existingTime = safeDate(existing.createdAt || existing.id || '').getTime();
          if (recTime > existingTime) {
            grouped[key] = rec;
          }
        }
      }
    });
    const latest = Object.values(grouped).sort((a, b) =>
      safeDate(b.date).getTime() - safeDate(a.date).getTime()
    );
    setLatestRecords(latest);
    setCurrentPage(1);
  }, []);

  useEffect(() => {
    refreshLatestRecords();
  }, [refreshLatestRecords]);

  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return latestRecords.slice(start, start + pageSize);
  }, [latestRecords, currentPage, pageSize]);

  // ----- View Modal -----
  const handleView = (record: MaintenanceEvent) => {
    setViewRecord(record);
    setViewModalOpen(true);
  };

  const handleEdit = (record: MaintenanceEvent) => {
    if (!isEditable(record.createdAt)) {
      showToast('This record is older than 10 days and cannot be edited.', 'error');
      return;
    }
    setForm({
      id: record.id || '',
      vehicleId: record.vehicleId,
      date: safeDate(record.date),
      currentKM: String(record.currentKM),
      maintenanceType: record.maintenanceType,
      serviceType: record.serviceType,
      garage: record.garage || '',
      mechanic: record.mechanic || '',
      driverId: record.driverId || '',
      driverName: record.driverName || '',
      nextServiceKM: String(record.nextServiceKM || ''),
      remarks: record.remarks || '',
      createdAt: record.createdAt || '',
    });
    setParts(record.parts || [{ name: '', specification: '', quantity: 1, rate: 0, amount: 0 }]);
    setSelectKey(prev => prev + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('Edit mode – update the details and save.', 'info');
  };

  const handleDelete = (_record: MaintenanceEvent) => {
    showToast('Delete action coming soon.', 'info');
  };

  // ----- Form Validation -----
  const validateForm = () => {
    if (!form.vehicleId) {
      showToast('Please select a vehicle.', 'error');
      return false;
    }
    if (!form.date) {
      showToast('Please select a date.', 'error');
      return false;
    }
    if (!form.currentKM) {
      showToast('Please enter current KM.', 'error');
      return false;
    }
    if (!form.maintenanceType) {
      showToast('Please select maintenance type.', 'error');
      return false;
    }
    if (!form.serviceType.trim()) {
      showToast('Please enter service type.', 'error');
      return false;
    }
    return true;
  };

  // ----- Save -----
  const handleSubmit = useCallback(async () => {
    if (!validateForm()) return;

    const record: MaintenanceEvent = {
      id: form.id || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      vehicleId: form.vehicleId,
      date: form.date.toISOString().split('T')[0],
      currentKM: parseFloat(form.currentKM) || 0,
      maintenanceType: form.maintenanceType as any,
      serviceType: form.serviceType,
      garage: form.garage,
      mechanic: form.mechanic,
      driverId: form.driverId,
      driverName: driverOptions.find(opt => opt.value === form.driverId)?.label || '',
      nextServiceKM: parseFloat(form.nextServiceKM) || 0,
      totalCost: totalCost,
      parts: parts.filter(p => p.name.trim() !== ''),
      remarks: form.remarks,
      createdAt: form.createdAt || new Date().toISOString(),
    };

    try {
      setLoading(true);

      let success = false;
      if (form.id) {
        const updated = updateMaintenance(form.id, record);
        success = !!updated;
        showToast('Maintenance record updated successfully!', 'success');
      } else {
        addMaintenance(record);
        success = true;
        showToast('Maintenance record saved successfully!', 'success');
      }

      if (success) {
        const currentVehicleId = form.vehicleId;
        setForm({
          id: '',
          vehicleId: currentVehicleId,
          date: new Date(),
          currentKM: '',
          maintenanceType: '',
          serviceType: '',
          garage: '',
          mechanic: '',
          driverId: '',
          driverName: '',
          nextServiceKM: '',
          remarks: '',
          createdAt: '',
        });
        setParts([{ name: '', specification: '', quantity: 1, rate: 0, amount: 0 }]);
        setSelectKey(prev => prev + 1);
        refreshLatestRecords();
      }
    } catch (err) {
      showToast(String(err), 'error');
    } finally {
      setLoading(false);
    }
  }, [form, parts, totalCost, showToast, refreshLatestRecords, driverOptions]);

  // ----- Reset -----
  const handleReset = () => {
    setForm({
      id: '',
      vehicleId: '',
      date: new Date(),
      currentKM: '',
      maintenanceType: '',
      serviceType: '',
      garage: '',
      mechanic: '',
      driverId: '',
      driverName: '',
      nextServiceKM: '',
      remarks: '',
      createdAt: '',
    });
    setParts([{ name: '', specification: '', quantity: 1, rate: 0, amount: 0 }]);
    setSelectKey(prev => prev + 1);
    setCurrentPage(1);
    showToast('Form has been reset', 'info');
  };

  // ----- Handlers -----
  const handleVehicleChange = (selected: any) => {
    setForm({ ...form, vehicleId: selected ? selected.value : '' });
    setSelectKey(prev => prev + 1);
  };

  const handleDriverChange = (selected: any) => {
    setForm({ ...form, driverId: selected ? selected.value : '', driverName: selected ? selected.label : '' });
  };

  const handleMaintenanceChange = (selected: any) => {
    setForm({ ...form, maintenanceType: selected ? selected.value : '' });
  };

  // ----- DatePicker Header -----
  const renderDatePickerHeader = ({ date, changeYear, changeMonth, decreaseMonth, increaseMonth, prevMonthButtonDisabled, nextMonthButtonDisabled }: any) => (
    <div className="flex items-center justify-between px-3 py-2 bg-blue-50 border-b">
      <button onClick={decreaseMonth} disabled={prevMonthButtonDisabled} className="px-2 py-1 text-sm hover:bg-blue-100 rounded disabled:opacity-50">◀</button>
      <div className="flex items-center gap-2">
        <select value={date.getFullYear()} onChange={({ target: { value } }) => changeYear(parseInt(value))} className="text-sm border rounded px-1 py-0.5">
          {Array.from({ length: 20 }, (_, i) => new Date().getFullYear() - 10 + i).map(year => <option key={year} value={year}>{year}</option>)}
        </select>
        <select value={date.getMonth()} onChange={({ target: { value } }) => changeMonth(parseInt(value))} className="text-sm border rounded px-1 py-0.5">
          {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((month, i) => <option key={month} value={i}>{month}</option>)}
        </select>
      </div>
      <button onClick={increaseMonth} disabled={nextMonthButtonDisabled} className="px-2 py-1 text-sm hover:bg-blue-100 rounded disabled:opacity-50">▶</button>
    </div>
  );

  // ----- Professional View Modal -----
  const ViewModal = () => {
    if (!viewRecord) return null;

    const vehicle = vehicles.find((v: any) => v.id === viewRecord.vehicleId);

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header with Logo */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 px-6 py-4 rounded-t-xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Maintenance Record</h2>
                <p className="text-blue-100 text-xs">Vehicle Service Details</p>
              </div>
            </div>
            <button
              onClick={() => setViewModalOpen(false)}
              className="text-white/80 hover:text-white hover:bg-white/20 rounded-full p-1.5 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">
            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 bg-gray-50 p-4 rounded-lg border border-gray-200">
              <div className="flex justify-between border-b border-gray-200 pb-1">
                <span className="text-sm font-medium text-gray-500">Vehicle</span>
                <span className="text-sm font-semibold text-gray-800">{vehicle?.vehicleNumber || viewRecord.vehicleId}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-1">
                <span className="text-sm font-medium text-gray-500">Date</span>
                <span className="text-sm font-semibold text-gray-800">{new Date(viewRecord.date).toLocaleDateString('en-GB')}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-1">
                <span className="text-sm font-medium text-gray-500">Current KM</span>
                <span className="text-sm font-semibold text-gray-800">{viewRecord.currentKM.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-1">
                <span className="text-sm font-medium text-gray-500">Maintenance Type</span>
                <span className="text-sm font-semibold text-gray-800">{viewRecord.maintenanceType}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-1">
                <span className="text-sm font-medium text-gray-500">Service Type</span>
                <span className="text-sm font-semibold text-gray-800">{viewRecord.serviceType}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-1">
                <span className="text-sm font-medium text-gray-500">Garage</span>
                <span className="text-sm font-semibold text-gray-800">{viewRecord.garage || '-'}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-1">
                <span className="text-sm font-medium text-gray-500">Mechanic</span>
                <span className="text-sm font-semibold text-gray-800">{viewRecord.mechanic || '-'}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-1">
                <span className="text-sm font-medium text-gray-500">Driver</span>
                <span className="text-sm font-semibold text-gray-800">{viewRecord.driverName || '-'}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-1 col-span-2">
                <span className="text-sm font-medium text-gray-500">Next Service KM</span>
                <span className="text-sm font-semibold text-gray-800">{viewRecord.nextServiceKM ? viewRecord.nextServiceKM.toLocaleString() : '-'}</span>
              </div>
            </div>

            {/* Parts Table */}
            {viewRecord.parts && viewRecord.parts.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Parts Used
                </h4>
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Item</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Spec</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-gray-500 uppercase">Qty</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Rate (₹)</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Amount (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {viewRecord.parts.map((p, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="px-4 py-2 text-sm text-gray-700">{p.name}</td>
                          <td className="px-4 py-2 text-sm text-gray-600">{p.specification || '-'}</td>
                          <td className="px-4 py-2 text-sm text-gray-600 text-center">{p.quantity}</td>
                          <td className="px-4 py-2 text-sm text-gray-600 text-right">₹{p.rate.toFixed(2)}</td>
                          <td className="px-4 py-2 text-sm font-medium text-blue-600 text-right">₹{p.amount.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t border-gray-200">
                      <tr>
                        <td colSpan={4} className="px-4 py-2 text-right font-semibold text-gray-700">Total</td>
                        <td className="px-4 py-2 text-right font-bold text-blue-600">
                          ₹{viewRecord.totalCost?.toFixed(2) || '0.00'}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Remarks */}
            {viewRecord.remarks && (
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <span className="text-sm font-medium text-gray-500">Remarks</span>
                <p className="text-sm text-gray-700 mt-1">{viewRecord.remarks}</p>
              </div>
            )}

            <div className="flex justify-end pt-4 border-t border-gray-200">
              <button
                onClick={() => setViewModalOpen(false)}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm hover:shadow"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <ErrorBoundary>
      {/* Minimal side padding: p-1 md:p-2 (matching TripEntryPage) */}
      <div className="p-1 md:p-2 space-y-4 max-w-6xl mx-auto">
        <h1 className="text-xl font-bold text-gray-900">Maintenance Details</h1>

        {/* Merged Card */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-700">Vehicle Information</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="px-5 py-2 text-sm font-medium border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Reset
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : (form.id ? 'Update' : 'Save')}
              </button>
            </div>
          </div>

          {/* Form Fields */}
          <div className="p-4 space-y-3">
            {/* Row 1 */}
            <div className="flex flex-nowrap items-end gap-3 w-full">
              <div className="w-[30%]">
                <label className="block text-xs font-medium text-gray-700 mb-1">Vehicle <span className="text-red-500">*</span></label>
                <Select
                  key={`vehicle-${selectKey}`}
                  options={vehicleOptions}
                  value={vehicleOptions.find(opt => opt.value === form.vehicleId)}
                  onChange={handleVehicleChange}
                  placeholder="Search Vehicle..."
                  isClearable
                  className="text-sm"
                  classNamePrefix="react-select"
                  styles={{
                    control: (base) => ({ ...base, minHeight: '34px', height: '34px', borderColor: '#d1d5db', boxShadow: 'none', '&:hover': { borderColor: '#9ca3af' } }),
                    valueContainer: (base) => ({ ...base, padding: '0 8px', height: '34px' }),
                    indicatorsContainer: (base) => ({ ...base, height: '34px' }),
                  }}
                />
              </div>
              <div className="w-[20%]">
                <label className="block text-xs font-medium text-gray-700 mb-1">Date <span className="text-red-500">*</span></label>
                <div className="relative">
                  <DatePicker
                    ref={datePickerRef}
                    selected={form.date}
                    onChange={(date: Date | null) => setForm({ ...form, date: date || new Date() })}
                    dateFormat="dd/MM/yyyy"
                    className="w-full rounded-md border border-gray-300 px-3 py-1.5 pr-8 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 h-[34px]"
                    popperClassName="shadow-lg rounded-lg border"
                    renderCustomHeader={renderDatePickerHeader}
                  />
                  <svg
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <div className="w-[20%]">
                <label className="block text-xs font-medium text-gray-700 mb-1">Current KM <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  value={form.currentKM}
                  onChange={(e) => setForm({ ...form, currentKM: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 h-[34px]"
                  placeholder="KM"
                  required
                />
              </div>
              <div className="w-[30%]">
                <label className="block text-xs font-medium text-gray-700 mb-1">Driver</label>
                <Select
                  key={`driver-${selectKey}`}
                  options={driverOptions}
                  value={driverOptions.find(opt => opt.value === form.driverId)}
                  onChange={handleDriverChange}
                  placeholder="Select Driver..."
                  isClearable
                  className="text-sm"
                  classNamePrefix="react-select"
                  styles={{
                    control: (base) => ({ ...base, minHeight: '34px', height: '34px', borderColor: '#d1d5db', boxShadow: 'none', '&:hover': { borderColor: '#9ca3af' } }),
                    valueContainer: (base) => ({ ...base, padding: '0 8px', height: '34px' }),
                    indicatorsContainer: (base) => ({ ...base, height: '34px' }),
                  }}
                />
              </div>
            </div>

            {/* Row 2 */}
            <div className="flex flex-nowrap items-end gap-3 w-full">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">Maintenance Type <span className="text-red-500">*</span></label>
                <Select
                  key={`maintenance-${selectKey}`}
                  options={maintenanceOptions}
                  value={maintenanceOptions.find(opt => opt.value === form.maintenanceType)}
                  onChange={handleMaintenanceChange}
                  placeholder="Search or Select Type..."
                  isClearable
                  className="text-sm"
                  classNamePrefix="react-select"
                  maxMenuHeight={150}
                  styles={{
                    control: (base) => ({ ...base, minHeight: '34px', height: '34px', borderColor: '#d1d5db', boxShadow: 'none', '&:hover': { borderColor: '#9ca3af' } }),
                    valueContainer: (base) => ({ ...base, padding: '0 8px', height: '34px' }),
                    indicatorsContainer: (base) => ({ ...base, height: '34px' }),
                    menu: (base) => ({ ...base, maxHeight: '150px', overflow: 'hidden' }),
                    menuList: (base) => ({ ...base, maxHeight: '150px', overflowY: 'auto' }),
                  }}
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">Service Type <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.serviceType}
                  onChange={(e) => setForm({ ...form, serviceType: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 h-[34px]"
                  placeholder="e.g., Oil Change"
                  required
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">Next Service Due (KM)</label>
                <input
                  type="number"
                  value={form.nextServiceKM}
                  onChange={(e) => setForm({ ...form, nextServiceKM: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 h-[34px]"
                  placeholder="Next service KM"
                />
              </div>
            </div>

            {/* Row 3 */}
            <div className="flex flex-nowrap items-end gap-3 w-full">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">Garage / Workshop</label>
                <input
                  type="text"
                  value={form.garage}
                  onChange={(e) => setForm({ ...form, garage: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 h-[34px]"
                  placeholder="Garage name"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">Mechanic</label>
                <input
                  type="text"
                  value={form.mechanic}
                  onChange={(e) => setForm({ ...form, mechanic: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 h-[34px]"
                  placeholder="Mechanic name"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 mb-1">Remarks</label>
                <input
                  type="text"
                  value={form.remarks}
                  onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 h-[34px]"
                  placeholder="Condition notes, findings, etc."
                />
              </div>
            </div>
          </div>

          {/* Parts Table */}
          <div className="border-t border-gray-200 p-4">
            <PartsTable parts={parts} setParts={setParts} />
          </div>
        </div>

        {/* Bottom Table */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <LatestMaintenanceTable
            records={paginatedRecords}
            vehicles={vehicles}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={handleDelete}
            isEditable={isEditable}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            pageSize={pageSize}
          />
        </div>

        {/* View Modal */}
        {viewModalOpen && <ViewModal />}
      </div>
    </ErrorBoundary>
  );
};

export default memo(MaintenanceEntryPage);