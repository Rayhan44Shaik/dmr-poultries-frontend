import React, { memo, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useEmployees } from '../../masters/employees/hooks/useEmployees';
import { useMaintenanceData } from '../hooks/useMaintenanceData';
import { useMaintenanceForm } from '../hooks/useMaintenanceForm';
import { isEditable, safeDate } from '../utils/maintenanceHelpers';
import { maintenanceApi } from '../services/maintenanceApi';
import { useSafeNotification } from '../../../hooks/useSafeNotification';
import { useFuelKMValidator } from "../../operations/fuel-expenses/hooks/useFuelKMValidator";
import ErrorBoundary from '../components/common/ErrorBoundary';
import MaintenanceForm from '../components/maintenance/MaintenanceForm';
import LatestMaintenanceTable, { ViewMode } from '../components/maintenance/LatestMaintenanceTable';
import ViewModal from '../components/maintenance/ViewModal';
import { MAINTENANCE_TYPES } from '../utils/constants';
import type { MaintenanceEvent } from '../types';
import { RotateCcw, Save, Wrench, AlertTriangle, X, AlertCircle, CheckCircle2 } from 'lucide-react';

const MaintenanceEntryPage = ({ embedded = false }: { embedded?: boolean }) => {
  const { employees } = useEmployees();
  const { showNotification } = useSafeNotification();
  const { vehicles, maintenance, approvedMaintenance, deletedRecords, refresh: refreshMaintenance } = useMaintenanceData();
  const [loading, setLoading] = useState(false);
  const [selectKey, setSelectKey] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  // Updated view mode to support Pending, Approved, and Deleted
  const [viewMode, setViewMode] = useState<ViewMode>('pending');

  // --- Approval Dialog State ---
  const [approveDialog, setApproveDialog] = useState<{
    open: boolean;
    record: MaintenanceEvent | null;
    message?: string;
  }>({
    open: false,
    record: null,
  });

  // --- Confirmation Dialog State ---
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    step: 'confirm' | 'countdown' | null;
    message: string;
    recordId: string | null;
    countdown: number | null;
  }>({
    open: false,
    step: null,
    message: '',
    recordId: null,
    countdown: null,
  });

  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  // --- Deleted records (soft-deleted from backend, exposed by the hook) ---
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 5;

  // --- Form hook ---
  const {
    form,
    setFormData,
    parts,
    setPartsData,
    handleSubmit: submitForm,
    resetForm,
    setVehicleId,
    setDate,
    setBillNumber,
    setCurrentKM,
    setMaintenanceType,
    setServiceType,
    setGarage,
    setMechanic,
    setDriverId,
    setNextServiceKM,
    setRemarks,
    documents,
    addDocumentFiles,
    removeDocument,
    markDocumentRemoval,
    setExistingDocuments,
  } = useMaintenanceForm({
    onSuccess: () => {
      refreshMaintenance();
      setCurrentPage(1);
      setSelectedId(null);
    },
  });

  // --- Get vehicle number for validator ---
  const selectedVehicle = useMemo(
    () => vehicles.find((v: any) => String(v.id) === String(form.vehicleId)),
    [vehicles, form.vehicleId]
  );
  const vehicleNumber = selectedVehicle?.vehicleNumber || '';

  // --- Fuel KM Validator ---
  const validator = useFuelKMValidator(Number(form.vehicleId) || null, vehicleNumber);
  const pendingWarning = validator.getPendingWarning();

  // --- Record Filtering (Pending vs Approved vs Deleted) ---
  const pendingRecords = useMemo(() => {
    // Treat records without an explicit "approved" status as pending
    const pending = maintenance.filter(rec => rec.paymentStatus !== 'approved');
    return pending.sort((a, b) => safeDate(b.date).getTime() - safeDate(a.date).getTime());
  }, [maintenance]);

  const approvedRecords = useMemo(() => {
    // Approved tab shows ONLY the latest approved maintenance record per vehicle
    // (computed at the backend with DISTINCT ON).
    return approvedMaintenance;
  }, [approvedMaintenance]);

  const displayRecords = useMemo(() => {
    if (viewMode === 'pending') return pendingRecords;
    if (viewMode === 'approved') return approvedRecords;
    return deletedRecords;
  }, [viewMode, pendingRecords, approvedRecords, deletedRecords]);

  // --- View modal ---
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewRecord, setViewRecord] = useState<MaintenanceEvent | null>(null);

  // --- Options ---
  const vehicleOptions = useMemo(() => {
    return vehicles.map((v: any) => ({ value: v.id, label: v.vehicleNumber }));
  }, [vehicles]);

  const driverOptions = useMemo(() => {
    return employees
      .filter((e: any) => e.department?.toLowerCase() === 'driver')
      .map((e: any) => ({ value: e.id, label: e.employeeName }));
  }, [employees]);

  const maintenanceOptions = useMemo(() => {
    return MAINTENANCE_TYPES.map((type) => ({ value: type, label: type }));
  }, []);

  // --- Handlers ---
  const handleVehicleChange = (selected: any) => {
    setVehicleId(selected ? selected.value : '');
    setSelectKey(prev => prev + 1);
  };

  const handleDriverChange = (selected: any) => {
    setDriverId(selected ? selected.value : '', selected ? selected.label : '');
  };

  const handleMaintenanceChange = (selected: any) => {
    setMaintenanceType(selected ? selected.map((opt: any) => opt.value) : []);
  };

  const setFormField = (field: string, value: any) => {
    setFormData({ [field]: value });
  };

  const handleReset = () => {
    resetForm();
    setSelectKey(prev => prev + 1);
    setCurrentPage(1);
    setSelectedId(null);
    showNotification('Form has been reset', 'info');
  };

  const handleView = (record: MaintenanceEvent) => {
    setViewRecord(record);
    setViewModalOpen(true);
  };

  const handleEdit = (record: MaintenanceEvent) => {
    // Anchored on the record's business date (matches the backend's 10-day
    // lock in fleetMaintenanceLock.ts — "10 days after this maintenance
    // happened", not 10 days after it was typed in).
    if (!isEditable(record.date)) {
      showNotification('This record is older than 10 days and cannot be edited.', 'error');
      return;
    }

    const maintTypes = record.maintenanceType
      ? record.maintenanceType.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    setFormData({
      id: record.id || '',
      vehicleId: record.vehicleId,
      date: record.date || new Date().toISOString().split('T')[0],
      billNumber: record.billNumber || '',
      currentKM: String(record.currentKM),
      maintenanceType: maintTypes,
      serviceType: record.serviceType,
      garage: record.garage || '',
      mechanic: record.mechanic || '',
      driverId: record.driverId || '',
      driverName: record.driverName || '',
      nextServiceKM: String(record.nextServiceKM || ''),
      remarks: record.remarks || '',
      createdAt: record.createdAt || '',
    });
    setPartsData(record.parts || [{ name: '', specification: '', quantity: 1, rate: 0, amount: 0 }]);
    setExistingDocuments(record.documents || []);
    setSelectKey(prev => prev + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showNotification('Edit mode – update the details and save.', 'info');
  };

  // ===== DELETE: Two‑step confirmation =====
  const startDeletion = useCallback((record: MaintenanceEvent) => {
    if (!record.id) {
      showNotification('Invalid record – cannot delete.', 'error');
      return;
    }

    const vehicle = vehicles.find((v: any) => v.id === record.vehicleId);
    const vehicleDisplay = vehicle?.vehicleNumber || record.vehicleId || 'Unknown Vehicle';
    const dateDisplay = record.date ? new Date(record.date).toLocaleDateString() : 'Unknown Date';

    setConfirmDialog({
      open: true,
      step: 'confirm',
      message: `Are you sure you want to delete the record for "${vehicleDisplay}" on ${dateDisplay}?`,
      recordId: record.id,
      countdown: null,
    });
  }, [vehicles, showNotification]);

  const startCountdown = (id: string) => {
    setConfirmDialog(prev => ({
      ...prev,
      step: 'countdown',
      message: 'Deletion will proceed in 10 seconds. You can cancel anytime.',
      countdown: 10,
    }));

    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = setInterval(() => {
      setConfirmDialog(prev => {
        if (prev.countdown === null || prev.countdown <= 1) {
          clearInterval(countdownIntervalRef.current!);
          setTimeout(() => {
            if (prev.open) {
              performDeletion(prev.recordId!);
            }
          }, 100);
          return { ...prev, countdown: 0 };
        }
        return { ...prev, countdown: prev.countdown - 1 };
      });
    }, 1000);
  };

  const performDeletion = async (id: string) => {
    try {
      await maintenanceApi.remove(id);
      showNotification('Record deleted.', 'success');
      refreshMaintenance();
      setSelectedId(null);
      const remaining = displayRecords.length - 1;
      const maxPage = Math.ceil(remaining / pageSize);
      if (currentPage > maxPage && maxPage > 0) {
        setCurrentPage(maxPage);
      } else if (remaining === 0) {
        setCurrentPage(1);
      }
    } catch (err) {
      showNotification(String(err), 'error');
    } finally {
      setConfirmDialog(prev => ({ ...prev, open: false, step: null, countdown: null }));
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    }
  };

  const cancelDeletion = () => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setConfirmDialog(prev => ({ ...prev, open: false, step: null, countdown: null }));
    showNotification('Deletion cancelled.', 'info');
  };

  // ===== APPROVE: two-step confirmation =====
  const handleApprove = (record: MaintenanceEvent) => {
    if (record.paymentStatus === 'approved') {
      showNotification('This record is already approved.', 'info');
      return;
    }
    if (!record.id) {
      showNotification('Invalid record – cannot approve.', 'error');
      return;
    }
    const vehicle = vehicles.find((v: any) => String(v.id) === String(record.vehicleId));
    const vehicleDisplay = vehicle?.vehicleNumber || record.vehicleNo || record.vehicleId || 'Unknown Vehicle';
    setApproveDialog({
      open: true,
      record,
      message: `Approve maintenance record "${record.billNumber || '-'}" for vehicle "${vehicleDisplay}"?`,
    });
  };

  const confirmApprove = async () => {
    const record = approveDialog.record;
    if (!record || !record.id) return;
    try {
      await maintenanceApi.approve(record.id, 'system');
      showNotification('Maintenance record approved.', 'success');
      refreshMaintenance();
      setSelectedId(null);
      setViewMode('approved');
      setCurrentPage(1);
    } catch (err) {
      showNotification(String(err), 'error');
    } finally {
      setApproveDialog({ open: false, record: null });
    }
  };

  // ===== Validate KM against approved fuel reading =====
  const validateKM = (): string | null => {
    if (!vehicleNumber) return null;
    if (!form.currentKM) return null;
    
    const km = parseFloat(form.currentKM);
    if (isNaN(km)) return null;
    
    const { valid, message } = validator.validateKM(km);
    if (!valid) {
      return message || 'Invalid KM';
    }
    return null;
  };

  // ===== Validate pending fuel before save =====
  const validatePendingFuel = (): string | null => {
    if (pendingWarning && vehicleNumber) {
      return `Cannot save maintenance: ${pendingWarning}`;
    }
    return null;
  };

  const onSave = async () => {
    const pendingFuelError = validatePendingFuel();
    if (pendingFuelError) {
      showNotification(pendingFuelError, 'error');
      return;
    }

    const kmError = validateKM();
    if (kmError) {
      showNotification(kmError, 'error');
      return;
    }

    setLoading(true);
    await submitForm();
    setLoading(false);
  };

  const handleViewToggle = (mode: ViewMode) => {
    setViewMode(mode);
    setCurrentPage(1);
    setSelectedId(null);
  };

  return (
    <ErrorBoundary>
      <div className="w-full space-y-4">
        {/* Form Card */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-xl border border-blue-100 text-blue-600">
                <Wrench size={18} />
              </div>
              <h2 className="text-base font-bold text-slate-800">Vehicle Maintenance Entry</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold text-slate-700 border border-slate-300 rounded-xl hover:bg-slate-50 transition shadow-xs"
              >
                <RotateCcw size={14} />
                Reset
              </button>
              <button
                onClick={onSave}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition shadow-sm hover:shadow disabled:opacity-50"
              >
                <Save size={14} />
                {loading ? 'Saving...' : (form.id ? 'Update' : 'Save')}
              </button>
            </div>
          </div>

          {/* Pending Fuel Warning Banner */}
          {pendingWarning && vehicleNumber && (
            <div className="mx-6 mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <span>{pendingWarning}</span>
            </div>
          )}

          <div className="p-6">
            <MaintenanceForm
              form={form}
              parts={parts}
              setParts={setPartsData}
              vehicleOptions={vehicleOptions}
              driverOptions={driverOptions}
              maintenanceOptions={maintenanceOptions}
              onVehicleChange={handleVehicleChange}
              onDriverChange={handleDriverChange}
              onMaintenanceChange={handleMaintenanceChange}
              setFormField={setFormField}
              selectKey={selectKey}
              documents={documents}
              onAddDocuments={addDocumentFiles}
              onRemoveDocument={removeDocument}
              onMarkDocumentRemoval={markDocumentRemoval}
            />
          </div>
        </div>

        {/* Latest Records Table */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden p-5">
          <LatestMaintenanceTable
            records={displayRecords}
            vehicles={vehicles}
            viewMode={viewMode}
            onView={handleView}
            onEdit={handleEdit}
            onDelete={startDeletion}
            onApprove={handleApprove}
            isEditable={isEditable}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            pageSize={pageSize}
            onToggleView={handleViewToggle}
          />
        </div>

        {/* View Modal */}
        {viewModalOpen && viewRecord && (
          <ViewModal
            record={viewRecord}
            vehicles={vehicles}
            onClose={() => setViewModalOpen(false)}
          />
        )}

        {/* ===== APPROVAL CONFIRMATION MODAL ===== */}
        {approveDialog.open && approveDialog.record && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3 text-emerald-600">
                  <CheckCircle2 size={20} />
                  <h3 className="text-sm font-bold text-slate-800">Confirm Approval</h3>
                </div>
                <button
                  onClick={() => setApproveDialog({ open: false, record: null })}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-6">
                <p className="text-sm text-slate-600">{approveDialog.message}</p>
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setApproveDialog({ open: false, record: null })}
                    className="px-4 py-2 text-sm font-semibold border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmApprove}
                    className="px-4 py-2 text-sm font-semibold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition shadow-sm"
                  >
                    Approve
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== CONFIRMATION / COUNTDOWN MODAL ===== */}
        {confirmDialog.open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full">
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-3 text-red-500">
                  <AlertTriangle size={20} />
                  <h3 className="text-sm font-bold text-slate-800">
                    {confirmDialog.step === 'confirm' ? 'Confirm Deletion' : 'Final Countdown'}
                  </h3>
                </div>
                <button
                  onClick={cancelDeletion}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="p-6">
                <p className="text-sm text-slate-600">{confirmDialog.message}</p>

                {confirmDialog.step === 'confirm' ? (
                  <div className="flex justify-end gap-3 mt-6">
                    <button
                      onClick={cancelDeletion}
                      className="px-4 py-2 text-sm font-semibold border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 transition"
                    >
                      No
                    </button>
                    <button
                      onClick={() => startCountdown(confirmDialog.recordId!)}
                      className="px-4 py-2 text-sm font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 transition shadow-sm"
                    >
                      Yes, Delete
                    </button>
                  </div>
                ) : (
                  <>
                    {confirmDialog.countdown !== null && confirmDialog.countdown > 0 && (
                      <div className="mt-4 flex items-center gap-3">
                        <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-red-500 transition-all duration-1000 ease-linear"
                            style={{ width: `${(confirmDialog.countdown / 10) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-bold text-slate-700">
                          {confirmDialog.countdown}s
                        </span>
                      </div>
                    )}
                    <div className="flex justify-end gap-3 mt-6">
                      <button
                        onClick={cancelDeletion}
                        className="px-4 py-2 text-sm font-semibold border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
};

export default memo(MaintenanceEntryPage);