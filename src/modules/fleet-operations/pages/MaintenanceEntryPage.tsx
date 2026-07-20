import { memo, useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useVehicles } from '../../masters/vehicles/hooks/useVehicles';
import { useEmployees } from '../../masters/employees/hooks/useEmployees';
import { useToast } from '../hooks/useToast';
import { addMaintenance, updateMaintenance, getMaintenance } from '../services/storage';
import { MAINTENANCE_TYPES } from '../utils/constants';
import ErrorBoundary from '../components/common/ErrorBoundary';
import PartsTable from '../components/maintenance/PartsTable';
import type { MaintenanceEvent, PartItem } from '../types';
import LatestMaintenanceTable from '../components/maintenance/LatestMaintenanceTable';
import Select from 'react-select';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { Calendar, Car, User, Gauge, Wrench, Cog, Building2, UserCog, FileText, RotateCcw, Save } from 'lucide-react';

// --- Helper functions (unchanged) ---
const isEditable = (createdAt?: string): boolean => {
  if (!createdAt) return false;
  const created = new Date(createdAt);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= 10;
};

const safeDate = (value?: string | number): Date => {
  if (!value) return new Date();
  const d = new Date(value);
  return isNaN(d.getTime()) ? new Date() : d;
};

// --- Component ---
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

  const validateForm = () => {
    if (!form.vehicleId) { showToast('Please select a vehicle.', 'error'); return false; }
    if (!form.date) { showToast('Please select a date.', 'error'); return false; }
    if (!form.currentKM) { showToast('Please enter current KM.', 'error'); return false; }
    if (!form.maintenanceType) { showToast('Please select maintenance type.', 'error'); return false; }
    if (!form.serviceType.trim()) { showToast('Please enter service type.', 'error'); return false; }
    return true;
  };

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
        setForm({ id: '', vehicleId: currentVehicleId, date: new Date(), currentKM: '', maintenanceType: '', serviceType: '', garage: '', mechanic: '', driverId: '', driverName: '', nextServiceKM: '', remarks: '', createdAt: '' });
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

  const handleReset = () => {
    setForm({ id: '', vehicleId: '', date: new Date(), currentKM: '', maintenanceType: '', serviceType: '', garage: '', mechanic: '', driverId: '', driverName: '', nextServiceKM: '', remarks: '', createdAt: '' });
    setParts([{ name: '', specification: '', quantity: 1, rate: 0, amount: 0 }]);
    setSelectKey(prev => prev + 1);
    setCurrentPage(1);
    showToast('Form has been reset', 'info');
  };

  const handleVehicleChange = (selected: any) => { setForm({ ...form, vehicleId: selected ? selected.value : '' }); setSelectKey(prev => prev + 1); };
  const handleDriverChange = (selected: any) => { setForm({ ...form, driverId: selected ? selected.value : '', driverName: selected ? selected.label : '' }); };
  const handleMaintenanceChange = (selected: any) => { setForm({ ...form, maintenanceType: selected ? selected.value : '' }); };

  const renderDatePickerHeader = ({ date, changeYear, changeMonth, decreaseMonth, increaseMonth, prevMonthButtonDisabled, nextMonthButtonDisabled }: any) => (
    <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-300">
      <button onClick={decreaseMonth} disabled={prevMonthButtonDisabled} className="px-2 py-1 text-sm hover:bg-gray-100 rounded disabled:opacity-50">◀</button>
      <div className="flex items-center gap-2">
        <select value={date.getFullYear()} onChange={({ target: { value } }) => changeYear(parseInt(value))} className="text-sm border border-gray-300 rounded px-1 py-0.5">
          {Array.from({ length: 20 }, (_, i) => new Date().getFullYear() - 10 + i).map(year => <option key={year} value={year}>{year}</option>)}
        </select>
        <select value={date.getMonth()} onChange={({ target: { value } }) => changeMonth(parseInt(value))} className="text-sm border border-gray-300 rounded px-1 py-0.5">
          {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((month, i) => <option key={month} value={i}>{month}</option>)}
        </select>
      </div>
      <button onClick={increaseMonth} disabled={nextMonthButtonDisabled} className="px-2 py-1 text-sm hover:bg-gray-100 rounded disabled:opacity-50">▶</button>
    </div>
  );

  const ViewModal = () => {
    if (!viewRecord) return null;
    const vehicle = vehicles.find((v: any) => v.id === viewRecord.vehicleId);
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white rounded-lg border border-gray-300 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          <div className="px-5 py-3 border-b border-gray-300 flex items-center justify-between">
            <h3 className="text-sm uppercase tracking-wider text-black">Maintenance Record</h3>
            <button onClick={() => setViewModalOpen(false)} className="text-black hover:text-gray-600">Close</button>
          </div>
          <div className="p-5 space-y-6">
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 bg-gray-50 p-4 rounded border border-gray-300">
              <div className="flex justify-between border-b border-gray-200 pb-1">
                <span className="text-sm text-gray-500">Vehicle</span>
                <span className="text-sm text-black">{vehicle?.vehicleNumber || viewRecord.vehicleId}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-1">
                <span className="text-sm text-gray-500">Date</span>
                <span className="text-sm text-black">{new Date(viewRecord.date).toLocaleDateString('en-GB')}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-1">
                <span className="text-sm text-gray-500">Current KM</span>
                <span className="text-sm text-black">{viewRecord.currentKM.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-1">
                <span className="text-sm text-gray-500">Maintenance Type</span>
                <span className="text-sm text-black">{viewRecord.maintenanceType}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-1">
                <span className="text-sm text-gray-500">Service Type</span>
                <span className="text-sm text-black">{viewRecord.serviceType}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-1">
                <span className="text-sm text-gray-500">Garage</span>
                <span className="text-sm text-black">{viewRecord.garage || '-'}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-1">
                <span className="text-sm text-gray-500">Mechanic</span>
                <span className="text-sm text-black">{viewRecord.mechanic || '-'}</span>
              </div>
              <div className="flex justify-between border-b border-gray-200 pb-1">
                <span className="text-sm text-gray-500">Driver</span>
                <span className="text-sm text-black">{viewRecord.driverName || '-'}</span>
              </div>
            </div>
            {viewRecord.parts && viewRecord.parts.length > 0 && (
              <div className="border border-gray-300 rounded">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs text-gray-500 uppercase">Item</th>
                      <th className="px-4 py-2 text-center text-xs text-gray-500 uppercase">Qty</th>
                      <th className="px-4 py-2 text-right text-xs text-gray-500 uppercase">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-300">
                    {viewRecord.parts.map((p, i) => (
                      <tr key={i}>
                        <td className="px-4 py-2 text-sm text-black">{p.name}</td>
                        <td className="px-4 py-2 text-sm text-black text-center">{p.quantity}</td>
                        <td className="px-4 py-2 text-sm text-black text-right">₹{p.amount.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex justify-end pt-4">
              <button onClick={() => setViewModalOpen(false)} className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <ErrorBoundary>
      {/* 👇 Outer container – padding now reduced further to px-2 md:px-4 */}
      <div className="px-1 md:px-3 py-6 md:py-8 space-y-6 max-w-7xl mx-auto bg-slate-50 min-h-screen">
        {/* Main Form Card */}
        <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200/60 bg-slate-50/40 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-xl border border-blue-100 text-blue-600">
                <Wrench size={18} />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-800">Vehicle Maintenance Entry</h2>
                <p className="text-xs text-slate-400">Record maintenance details and parts used</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition shadow-sm"
              >
                <RotateCcw size={14} />
                Reset
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition shadow-md hover:shadow-lg disabled:opacity-50"
              >
                <Save size={14} />
                {loading ? 'Saving...' : (form.id ? 'Update' : 'Save')}
              </button>
            </div>
          </div>

          {/* Form Body */}
          <div className="p-6 space-y-6">
            {/* First Row: Vehicle, Date, Current KM, Driver */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Vehicle <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Car size={16} className="text-slate-400" />
                  </div>
                  <Select
                    key={`vehicle-${selectKey}`}
                    options={vehicleOptions}
                    value={vehicleOptions.find(opt => opt.value === form.vehicleId)}
                    onChange={handleVehicleChange}
                    placeholder="Select vehicle"
                    isClearable
                    className="text-sm"
                    styles={{
                      control: (base) => ({
                        ...base,
                        minHeight: '40px',
                        paddingLeft: '28px',
                        borderColor: '#d1d5db',
                        boxShadow: 'none',
                        borderRadius: '0.5rem',
                      }),
                      placeholder: (base) => ({ ...base, color: '#9ca3af' }),
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Date <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                    <Calendar size={16} className="text-slate-400" />
                  </div>
                  <DatePicker
                    ref={datePickerRef}
                    selected={form.date}
                    onChange={(date: Date | null) => setForm({ ...form, date: date || new Date() })}
                    dateFormat="dd/MM/yyyy"
                    className="w-full h-10 pl-10 pr-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    renderCustomHeader={renderDatePickerHeader}
                    placeholderText="Select date"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Current KM <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Gauge size={16} className="text-slate-400" />
                  </div>
                  <input
                    type="number"
                    value={form.currentKM}
                    onChange={(e) => setForm({ ...form, currentKM: e.target.value })}
                    placeholder="e.g. 45000"
                    className="w-full h-10 pl-10 pr-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Driver
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User size={16} className="text-slate-400" />
                  </div>
                  <Select
                    key={`driver-${selectKey}`}
                    options={driverOptions}
                    value={driverOptions.find(opt => opt.value === form.driverId)}
                    onChange={handleDriverChange}
                    placeholder="Select driver"
                    isClearable
                    className="text-sm"
                    styles={{
                      control: (base) => ({
                        ...base,
                        minHeight: '40px',
                        paddingLeft: '28px',
                        borderColor: '#d1d5db',
                        boxShadow: 'none',
                        borderRadius: '0.5rem',
                      }),
                      placeholder: (base) => ({ ...base, color: '#9ca3af' }),
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Second Row: Maintenance Type, Service Type, Next Service KM, Garage */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Maintenance Type <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Cog size={16} className="text-slate-400" />
                  </div>
                  <Select
                    key={`maintenance-${selectKey}`}
                    options={maintenanceOptions}
                    value={maintenanceOptions.find(opt => opt.value === form.maintenanceType)}
                    onChange={handleMaintenanceChange}
                    placeholder="Select type"
                    isClearable
                    className="text-sm"
                    styles={{
                      control: (base) => ({
                        ...base,
                        minHeight: '40px',
                        paddingLeft: '28px',
                        borderColor: '#d1d5db',
                        boxShadow: 'none',
                        borderRadius: '0.5rem',
                      }),
                      placeholder: (base) => ({ ...base, color: '#9ca3af' }),
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Service Type <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Wrench size={16} className="text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={form.serviceType}
                    onChange={(e) => setForm({ ...form, serviceType: e.target.value })}
                    placeholder="e.g. Oil Change"
                    className="w-full h-10 pl-10 pr-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Next Service KM
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Gauge size={16} className="text-slate-400" />
                  </div>
                  <input
                    type="number"
                    value={form.nextServiceKM}
                    onChange={(e) => setForm({ ...form, nextServiceKM: e.target.value })}
                    placeholder="e.g. 50000"
                    className="w-full h-10 pl-10 pr-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Garage
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Building2 size={16} className="text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={form.garage}
                    onChange={(e) => setForm({ ...form, garage: e.target.value })}
                    placeholder="Garage name"
                    className="w-full h-10 pl-10 pr-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>
              </div>
            </div>

            {/* Third Row: Mechanic, Remarks (full width) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Mechanic
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <UserCog size={16} className="text-slate-400" />
                  </div>
                  <input
                    type="text"
                    value={form.mechanic}
                    onChange={(e) => setForm({ ...form, mechanic: e.target.value })}
                    placeholder="Mechanic name"
                    className="w-full h-10 pl-10 pr-3 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                  Remarks
                </label>
                <div className="relative">
                  <div className="absolute top-2.5 left-3 pointer-events-none">
                    <FileText size={16} className="text-slate-400" />
                  </div>
                  <textarea
                    value={form.remarks}
                    onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                    rows={1}
                    placeholder="Any additional notes..."
                    className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition resize-y"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Parts Table Section */}
          <div className="border-t border-slate-200/60 p-6 bg-slate-50/20">
            <PartsTable parts={parts} setParts={setParts} />
          </div>
        </div>

        {/* Latest Maintenance Records Table */}
        <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden p-5">
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

        {viewModalOpen && <ViewModal />}
      </div>
    </ErrorBoundary>
  );
};

export default memo(MaintenanceEntryPage);