import React, { memo, useState } from 'react';
import Select from 'react-select';
import { useI18n } from '../../../../i18n';
import { DatePicker } from '../../../../components/common/DatePicker';
import { Gauge, Wrench, Cog, Building2, UserCog, FileText, Paperclip, Upload, Trash2, File as FileIcon, AlertTriangle, Truck } from 'lucide-react';
import PartsTable from './PartsTable';
import type { PartItem } from '../../types';
import { maintenanceApi } from '../../services/maintenanceApi';
// Trip-List field chrome — identical labels, inputs and dropdowns.
import { opsFilterLabelClass, opsInputClass } from '../../../../shared/ui/operationsStyles';
import { localizeMaintenanceText } from '../../utils/maintenanceLocalization';
import MasterDropdown from '../../../masters/components/MasterDropdown';

export interface FormDocumentItem {
  key: string;
  existingId?: number;
  fileName: string;
  mimeType: string;
  fileSize: number;
  file?: File;
  objectUrl?: string;
  markedForRemoval?: boolean;
}

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
    nextServiceByType?: Record<string, string>;
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
  documents: FormDocumentItem[];
  onAddDocuments: (files: File[]) => void;
  onRemoveDocument: (key: string) => void;
  onMarkDocumentRemoval: (key: string) => void;
  validateKM?: (km: number) => { valid: boolean; message?: string };
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
  documents,
  onAddDocuments,
  onRemoveDocument,
  onMarkDocumentRemoval,
  validateKM,
}) => {
  const { t, language } = useI18n();
  const [kmError, setKmError] = useState<string | null>(null);

  const inputClass = `${opsInputClass} pl-10`;

  // Maintenance Type multi-select — same chrome as the shared MasterDropdown
  // used by the Trip List filters: 40px control, 12px menu, 36px quiet rows
  // with a brand-tinted selection and subtle slate chips.
  const maintenanceSelectStyles = {
    control: (base: Record<string, unknown>) => ({
      ...base,
      minHeight: '36px',
      borderColor: '#cbd5e1',
      boxShadow: 'none',
      borderRadius: '0.75rem',
      fontSize: '13px',
      '&:hover': { borderColor: '#94a3b8' },
    }),
    menu: (base: Record<string, unknown>) => ({
      ...base,
      borderRadius: '0.75rem',
      overflow: 'hidden',
      zIndex: 40,
      boxShadow: '0 12px 32px -12px rgb(15 23 42 / 0.25)',
      border: '1px solid #e2e8f0',
    }),
    menuList: (base: Record<string, unknown>) => ({ ...base, padding: '4px', maxHeight: '240px' }),
    option: (base: Record<string, unknown>, state: { isSelected: boolean; isFocused: boolean }) => ({
      ...base,
      fontSize: '13px',
      fontWeight: state.isSelected ? 600 : 500,
      padding: '8px 10px',
      borderRadius: '0.5rem',
      cursor: 'pointer',
      backgroundColor: state.isSelected ? '#ecfdf5' : state.isFocused ? '#f8fafc' : 'transparent',
      color: state.isSelected ? '#047857' : '#334155',
      '&:active': { backgroundColor: '#ecfdf5' },
    }),
    multiValue: (base: Record<string, unknown>) => ({
      ...base,
      backgroundColor: '#f1f5f9',
      borderRadius: '0.5rem',
      border: '1px solid #e2e8f0',
    }),
    multiValueLabel: (base: Record<string, unknown>) => ({
      ...base,
      fontSize: '12px',
      fontWeight: 600,
      color: '#334155',
      padding: '2px 6px',
    }),
    multiValueRemove: (base: Record<string, unknown>) => ({
      ...base,
      color: '#94a3b8',
      cursor: 'pointer',
      ':hover': { backgroundColor: '#fee2e2', color: '#b91c1c' },
    }),
    placeholder: (base: Record<string, unknown>) => ({ ...base, color: '#9ca3af' }),
    clearIndicator: (base: Record<string, unknown>) => ({ ...base, color: '#94a3b8', cursor: 'pointer' }),
    dropdownIndicator: (base: Record<string, unknown>) => ({ ...base, color: '#94a3b8', cursor: 'pointer' }),
  };

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
      setKmError(t('validation.invalid_number'));
      return;
    }
    
    // Always update the form field with the raw value
    setFormField('currentKM', val);
    
    // Validate the value
    if (validateKM) {
      const { valid, message } = validateKM(num);
      if (!valid) {
        setKmError(message || t('fleet.maintenance_form.invalid_km'));
      } else {
        setKmError(null);
      }
    } else {
      setKmError(null);
    }
  };

  const handleDocumentInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) onAddDocuments(files);
    e.target.value = '';
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes) return '';
    if (bytes > 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  };

  const isImageDoc = (doc: FormDocumentItem): boolean =>
    doc.mimeType?.startsWith('image/') || /\.(png|jpe?g)$/i.test(doc.fileName);

  const documentPreviewUrl = (doc: FormDocumentItem): string | undefined => {
    if (doc.objectUrl) return doc.objectUrl;
    if (doc.existingId != null && form.id) {
      return maintenanceApi.documentUrl(form.id, doc.existingId);
    }
    return undefined;
  };

  return (
    <div className="space-y-5">
      {/* Row 1: Vehicle, Date, Driver */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 1. Vehicle */}
        <div>
          <label className={opsFilterLabelClass}>
            <Truck size={17} className="text-emerald-500 flex-shrink-0" />
            <span>{t('common.vehicle')}</span>
            <span className="text-rose-500">*</span>
          </label>
          <MasterDropdown
            key={`vehicle-${selectKey}`}
            hideLabel
            label={t('common.vehicle')}
            value={form.vehicleId}
            options={vehicleOptions}
            onChange={(next) => onVehicleChange(next ? { value: next } : null)}
            placeholder={t('operations.select_vehicle')}
            searchable
            allowClear
            className="w-full"
          />
        </div>

        {/* 3. Date */}
        <div>
          <DatePicker
            label={t('common.date')}
            required
            value={form.date}
            onChange={(dateStr) => setFormField('date', dateStr)}
            placeholder={t('placeholder.enter_date')}
          />
        </div>

        {/* 4. Driver */}
        <div>
          <label className={opsFilterLabelClass}>
            <UserCog size={17} className="text-violet-500 flex-shrink-0" />
            <span>{t('common.driver')}</span>
          </label>
          <MasterDropdown
            key={`driver-${selectKey}`}
            hideLabel
            label={t('common.driver')}
            value={form.driverId}
            options={driverOptions}
            onChange={(next) => {
              const match = driverOptions.find((opt) => String(opt.value) === String(next));
              onDriverChange(next ? { value: next, label: match?.label ?? next } : null);
            }}
            placeholder={t('operations.select_driver')}
            searchable
            allowClear
            className="w-full"
          />
        </div>
      </div>

      {/* Row 2: Current KM, Garage, Mechanic */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 5. Current KM */}
        <div>
          <label className={opsFilterLabelClass}>
            <Gauge size={17} className="text-orange-500 flex-shrink-0" />
            <span>{t('fleet.maintenance_form.current_km')}</span>
            <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Gauge size={16} className="text-slate-400" />
            </div>
            <input
              type="number"
              value={form.currentKM}
              onChange={handleCurrentKMChange}
              placeholder={t('fleet.maintenance_form.number_placeholder', { value: '45000' })}
              className={`${inputClass} ${kmError ? 'border-red-500' : ''} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
            />
          </div>
          {kmError && <p className="mt-1 text-xs text-red-500">{kmError}</p>}
        </div>

        {/* 7. Garage */}
        <div>
          <label className={opsFilterLabelClass}>
            <Building2 size={17} className="text-amber-500 flex-shrink-0" />
            <span>{t('operations.maintenance_garage')}</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Building2 size={16} className="text-slate-400" />
            </div>
            <input
              type="text"
              value={form.garage}
              onChange={(e) => setFormField('garage', e.target.value)}
              placeholder={t('fleet.maintenance_form.garage_placeholder')}
              className={inputClass}
            />
          </div>
        </div>

        {/* 8. Mechanic */}
        <div>
          <label className={opsFilterLabelClass}>
            <UserCog size={17} className="text-indigo-500 flex-shrink-0" />
            <span>{t('fleet.maintenance_form.mechanic')}</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <UserCog size={16} className="text-slate-400" />
            </div>
            <input
              type="text"
              value={form.mechanic}
              onChange={(e) => setFormField('mechanic', e.target.value)}
              placeholder={t('fleet.maintenance_form.mechanic_placeholder')}
              className={inputClass}
            />
          </div>
        </div>
      </div>

      {/* Row 3: Maintenance Type (multi‑select), Service Type, Remarks */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 9. Maintenance Type - big box (multi) */}
        <div>
          <label className={opsFilterLabelClass}>
            <Cog size={17} className="text-slate-400 flex-shrink-0" />
            <span>{t('operations.maintenance_type')}</span>
            <span className="text-rose-500">*</span>
          </label>
          <Select
            key={`maintenance-${selectKey}`}
            options={maintenanceOptions.map((opt) => ({ ...opt, label: localizeMaintenanceText(opt.label, language) }))}
            getOptionValue={(opt) => opt.value}
            value={maintenanceOptions.filter(opt => form.maintenanceType.includes(opt.value)).map((opt) => ({ ...opt, label: localizeMaintenanceText(opt.label, language) }))}
            onChange={onMaintenanceChange}
            placeholder={t('fleet.maintenance_form.select_types')}
            isMulti
            isClearable
            closeMenuOnSelect={false}
            hideSelectedOptions={false}
            className="text-sm"
            styles={maintenanceSelectStyles}
          />

          {/* Next Service KM — one target per selected maintenance type */}
          <label className={`${opsFilterLabelClass} mt-3`}>
            <Gauge size={17} className="text-cyan-500 flex-shrink-0" />
            <span>{t('fleet.maintenance_form.next_service_km')}</span>
          </label>
          {form.maintenanceType.length === 0 ? (
            <div className="flex h-10 items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 text-xs text-slate-400">
              {t('fleet.maintenance_form.select_types_first')}
            </div>
          ) : form.maintenanceType.length === 1 ? (
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Gauge size={16} className="text-slate-400" />
              </div>
              <input
                type="number"
                value={form.nextServiceByType?.[form.maintenanceType[0]] ?? ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormField('nextServiceByType', { ...(form.nextServiceByType || {}), [form.maintenanceType[0]]: value });
                  if (value !== '') setFormField('nextServiceKM', value);
                }}
                placeholder={t('fleet.maintenance_form.number_placeholder', { value: '50000' })}
                className={`${inputClass} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
              />
            </div>
          ) : (
            <div className="space-y-2">
              {form.maintenanceType.map((type) => (
                <div key={type} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600">
                    {localizeMaintenanceText(type, language)}
                  </span>
                  <div className="relative w-36 shrink-0">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                      <Gauge size={14} className="text-slate-400" />
                    </div>
                    <input
                      type="number"
                      value={form.nextServiceByType?.[type] ?? ''}
                      onChange={(e) => setFormField('nextServiceByType', { ...(form.nextServiceByType || {}), [type]: e.target.value })}
                      placeholder="KM"
                      className={`h-9 w-full pl-8 pr-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 10. Service Type */}
        <div>
          <label className={opsFilterLabelClass}>
            <Wrench size={17} className="text-purple-500 flex-shrink-0" />
            <span>{t('fleet.maintenance_form.service_type')}</span>
            <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Wrench size={16} className="text-slate-400" />
            </div>
            <input
              type="text"
              value={form.serviceType}
              onChange={(e) => setFormField('serviceType', e.target.value)}
              placeholder={t('fleet.maintenance_form.service_type_example')}
              className={inputClass}
            />
          </div>
        </div>

        {/* 11. Remarks */}
        <div>
          <label className={opsFilterLabelClass}>
            <FileText size={17} className="text-emerald-500 flex-shrink-0" />
            <span>{t('common.remarks')}</span>
          </label>
          <div className="relative">
            <div className="absolute top-2.5 left-3 pointer-events-none">
              <FileText size={16} className="text-slate-400" />
            </div>
            <textarea
              value={form.remarks}
              onChange={(e) => setFormField('remarks', e.target.value)}
              rows={1}
              placeholder={t('fleet.maintenance_form.remarks_placeholder')}
              className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 transition resize-y bg-white"
            />
          </div>
        </div>
      </div>

      {/* Parts Table */}
      <div className="border-t border-slate-200 pt-5">
        <PartsTable parts={parts} setParts={setParts} hideSubline={true} />
      </div>

      {/* Bill / Spare‑part Documents */}
      <div className="border-t border-slate-200 pt-5">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Paperclip size={16} className="text-slate-500" />
              {t('fleet.maintenance_form.documents_title')} <span className="text-red-500">*</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('fleet.maintenance_form.documents_hint')}
            </p>
          </div>
          <label
            className="group relative inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition cursor-pointer shrink-0 active:scale-95"
          >
            <span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-add)]"><Upload size={14} /></span>
            {t('fleet.maintenance_form.add_document')}
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.pdf"
              multiple
              hidden
              onChange={handleDocumentInput}
            />
          </label>
        </div>

        {documents.length === 0 ? (
          <p className="text-sm text-slate-400 italic">
            {t('fleet.maintenance_form.no_documents')}
          </p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {documents.map((doc) => {
              const previewUrl = documentPreviewUrl(doc);
              const isImage = isImageDoc(doc);
              return (
                <div
                  key={doc.key}
                  className={`relative group border rounded-xl overflow-hidden bg-slate-50 ${
                    doc.markedForRemoval ? 'border-red-300 opacity-60' : 'border-slate-200'
                  }`}
                >
                  <div className="h-24 w-full bg-slate-100 flex items-center justify-center overflow-hidden">
                    {isImage && previewUrl ? (
                      <img
                        src={previewUrl}
                        alt={doc.fileName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex flex-col items-center text-slate-400">
                        <FileIcon size={26} />
                        <span className="text-[10px] mt-1 uppercase text-slate-400">PDF</span>
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium text-slate-700 truncate" title={doc.fileName}>
                      {doc.fileName}
                    </p>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-slate-400">
                        {formatFileSize(doc.fileSize)}
                      </span>
                      {doc.markedForRemoval ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-red-500">
                          <AlertTriangle size={10} /> {t('fleet.maintenance_form.will_remove')}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() =>
                            doc.existingId != null && !doc.file
                              ? onMarkDocumentRemoval(doc.key)
                              : onRemoveDocument(doc.key)
                          }
                          className="text-slate-400 hover:text-red-500 transition"
                          title={t('fleet.maintenance_form.remove_document')}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(MaintenanceForm);
