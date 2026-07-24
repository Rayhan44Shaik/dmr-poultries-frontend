import { useState, useMemo, useCallback, useEffect } from 'react';
import { useSafeNotification } from '../../../hooks/useSafeNotification';
import { addMaintenance, updateMaintenance } from '../services/storage';
import { getBillNumberPreview, incrementBillCounter } from '../utils/maintenanceHelpers';
import type { MaintenanceEvent, PartItem } from '../types';

interface UseMaintenanceFormProps {
  onSuccess: () => void;
  vehicles: any[];
}

export const useMaintenanceForm = ({ onSuccess, vehicles }: UseMaintenanceFormProps) => {
  const { showNotification } = useSafeNotification();

  const [form, setForm] = useState({
    id: '',
    vehicleId: '',
    date: new Date().toISOString().split('T')[0],
    billNumber: '',
    currentKM: '',
    maintenanceType: [] as string[],
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

  // PREVIEW bill number – read only, no increment
  useEffect(() => {
    if (!form.id && form.vehicleId) {
      const vehicle = vehicles.find((v: any) => String(v.id) === String(form.vehicleId));
      if (vehicle?.vehicleNumber) {
        // Only set if empty or auto-generated
        if (!form.billNumber || form.billNumber.startsWith('Veh-')) {
          const preview = getBillNumberPreview(form.vehicleId, vehicle.vehicleNumber);
          setForm(prev => ({ ...prev, billNumber: preview }));
        }
      }
    }
  }, [form.vehicleId, form.id, vehicles]);

  const validateForm = useCallback(() => {
    if (!form.vehicleId) { showNotification('Please select a vehicle.', 'error'); return false; }
    if (!form.date) { showNotification('Please select a date.', 'error'); return false; }
    if (!form.currentKM) { showNotification('Please enter current KM.', 'error'); return false; }
    if (!form.maintenanceType.length) { showNotification('Please select at least one maintenance type.', 'error'); return false; }
    if (!form.serviceType.trim()) { showNotification('Please enter service type.', 'error'); return false; }
    return true;
  }, [form, showNotification]);

  // Reset to fresh state, keeping vehicle & driver
  const resetToFresh = useCallback(() => {
    setForm(prev => ({
      id: '',
      vehicleId: prev.vehicleId,
      date: new Date().toISOString().split('T')[0],
      billNumber: '', // empty → will trigger preview in useEffect
      currentKM: '',
      maintenanceType: [],
      serviceType: '',
      garage: '',
      mechanic: '',
      driverId: prev.driverId,
      driverName: prev.driverName,
      nextServiceKM: '',
      remarks: '',
      createdAt: '',
    }));
    setParts([{ name: '', specification: '', quantity: 1, rate: 0, amount: 0 }]);
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!validateForm()) return;

    // Determine final bill number – if empty, generate preview (should not happen)
    let finalBillNumber = form.billNumber;
    if (!finalBillNumber && form.vehicleId) {
      const vehicle = vehicles.find((v: any) => String(v.id) === String(form.vehicleId));
      if (vehicle?.vehicleNumber) {
        finalBillNumber = getBillNumberPreview(form.vehicleId, vehicle.vehicleNumber);
      }
    }

    const record: MaintenanceEvent = {
      id: form.id || `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      vehicleId: form.vehicleId,
      date: form.date,
      billNumber: finalBillNumber || '',
      currentKM: parseFloat(form.currentKM) || 0,
      maintenanceType: form.maintenanceType.join(', '),
      serviceType: form.serviceType,
      garage: form.garage,
      mechanic: form.mechanic,
      driverId: form.driverId,
      driverName: form.driverName,
      nextServiceKM: parseFloat(form.nextServiceKM) || 0,
      totalCost: totalCost,
      parts: parts.filter(p => p.name.trim() !== ''),
      remarks: form.remarks,
      createdAt: form.createdAt || new Date().toISOString(),
    };

    try {
      if (form.id) {
        // Update – do NOT increment counter
        const updated = updateMaintenance(form.id, record);
        if (updated) {
          showNotification('Maintenance record updated successfully!', 'success');
          onSuccess();
          resetToFresh();
        } else {
          showNotification('Update failed.', 'error');
        }
      } else {
        // New record – increment counter after successful save
        addMaintenance(record);
        // Increment the counter for this vehicle
        if (record.vehicleId) {
          incrementBillCounter(record.vehicleId);
        }
        showNotification('Maintenance record saved successfully!', 'success');
        onSuccess();
        resetToFresh();
      }
    } catch (err) {
      showNotification(String(err), 'error');
    }
  }, [form, parts, totalCost, validateForm, showNotification, onSuccess, resetToFresh, vehicles]);

  const resetForm = useCallback(() => {
    // Full reset (used by Reset button)
    setForm({
      id: '',
      vehicleId: '',
      date: new Date().toISOString().split('T')[0],
      billNumber: '',
      currentKM: '',
      maintenanceType: [],
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
  }, []);

  const setFormData = useCallback((data: Partial<typeof form>) => {
    setForm(prev => ({ ...prev, ...data }));
  }, []);

  const setPartsData = useCallback((newParts: PartItem[]) => {
    setParts(newParts);
  }, []);

  // Individual setters (same as before)
  const setVehicleId = useCallback((id: string) => setForm(prev => ({ ...prev, vehicleId: id })), []);
  const setDate = useCallback((date: string) => setForm(prev => ({ ...prev, date })), []);
  const setBillNumber = useCallback((bill: string) => setForm(prev => ({ ...prev, billNumber: bill })), []);
  const setCurrentKM = useCallback((km: string) => setForm(prev => ({ ...prev, currentKM: km })), []);
  const setMaintenanceType = useCallback((types: string[]) => setForm(prev => ({ ...prev, maintenanceType: types })), []);
  const setServiceType = useCallback((type: string) => setForm(prev => ({ ...prev, serviceType: type })), []);
  const setGarage = useCallback((garage: string) => setForm(prev => ({ ...prev, garage })), []);
  const setMechanic = useCallback((mech: string) => setForm(prev => ({ ...prev, mechanic: mech })), []);
  const setDriverId = useCallback((id: string, name?: string) =>
    setForm(prev => ({ ...prev, driverId: id, driverName: name || prev.driverName })), []);
  const setNextServiceKM = useCallback((km: string) => setForm(prev => ({ ...prev, nextServiceKM: km })), []);
  const setRemarks = useCallback((remarks: string) => setForm(prev => ({ ...prev, remarks })), []);

  return {
    form,
    setFormData,
    parts,
    setPartsData,
    totalCost,
    handleSubmit,
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
  };
};