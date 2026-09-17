import { useRef, useState, type FormEvent } from 'react';
import { IndianRupee, ScrollText, UserRound, X } from 'lucide-react';
import { parseBusinessDate, toBusinessDate } from '../../../../utils/businessDate';
import type { Payment, PaymentWritePayload } from '../../types/payment.types';
import { createPayment, updatePayment } from '../../services/paymentApiService';
import { canEditItem } from '../../../../utils/dateUtils';
import { Button } from '../../../../ui/Button';
import { Modal } from '../../../../ui/Modal';
import { useI18n } from '../../../../i18n';
import MasterDropdown from '../../../masters/components/MasterDropdown';
import { MasterSectionHeading } from '../../../masters/components/MasterForm';
import { masterIconClass, masterInputClass, masterLabelClass } from '../../../masters/components/masterFormStyles';
import '../../../masters/styles/masters.css';
import { DatePicker } from '../../../../components/common/DatePicker';
import { localizePaymentType, PAYMENT_TYPES, PAYMENT_MODES, paymentNoDisplay } from '../../utils/paymentRegister';
import { PaymentGlyphChip } from './PaymentGlyphMarks';
import { paymentModeGlyph, paymentTypeGlyph } from '../../utils/paymentRegisterGlyphs';
import { cn } from '../../../../utils/cn';

interface PaymentEditModalProps {
  isOpen: boolean;
  payment: Payment | null;
  onClose: () => void;
  onSave: (payment: Payment) => void;
  persist?: (payload: PaymentWritePayload, target: Payment | null) => Promise<Payment>;
}

const CATEGORIES = ['Farmer', 'Fuel', 'Maintenance', 'Salary', 'Loan', 'Office', 'Tax', 'Other'];
// The register workflow exposes only these three choices. The API keeps its
// existing status values: Pending is stored as Draft and Deleted as Cancelled.
const STATUSES: { value: Payment['status']; labelKey: string }[] = [
  { value: 'Draft', labelKey: 'status.pending' },
  { value: 'Approved', labelKey: 'status.approved' },
  { value: 'Cancelled', labelKey: 'accounts.payment.status_deleted' },
];
export function PaymentEditModal(props: PaymentEditModalProps) {
  return props.isOpen ? <EditForm key={props.payment?.id ?? 'new'} {...props} /> : null;
}

function EditForm({ isOpen, payment, onClose, onSave, persist }: PaymentEditModalProps) {
  const { t } = useI18n();
  const [form, setForm] = useState(() => ({
    paymentDate: payment?.paymentDate ?? toBusinessDate(new Date()),
    paymentType: payment?.paymentType ?? PAYMENT_TYPES[0],
    paymentMode: payment?.paymentMode ?? PAYMENT_MODES[0],
    paidTo: payment?.paidTo ?? '',
    amount: payment?.amount ?? 0,
    referenceNo: payment?.referenceNo ?? '',
    category: payment?.category ?? CATEGORIES[0],
    remarks: payment?.remarks ?? '',
    status: payment?.status ?? 'Draft' as Payment['status'],
  }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const savingRef = useRef(false);
  const isEditMode = !!payment?.id;
  const isEditable = !payment?.createdAt || canEditItem(payment.createdAt);
  const close = () => { if (!savingRef.current) onClose(); };
  const handleChange = <K extends keyof typeof form>(field: K, value: (typeof form)[K]) => {
    setForm(previous => ({ ...previous, [field]: value }));
    setErrors(previous => ({ ...previous, [field]: '' }));
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!parseBusinessDate(form.paymentDate)) next.paymentDate = t('accounts.payment.err_date_required');
    if (!form.paymentType) next.paymentType = t('accounts.payment.err_type_required');
    if (!form.paymentMode) next.paymentMode = t('accounts.payment.err_mode_required');
    if (!form.paidTo.trim()) next.paidTo = t('accounts.payment.err_paidto_required');
    if (!Number.isFinite(form.amount) || form.amount <= 0) next.amount = t('accounts.payment.err_amount_positive');
    if (!form.referenceNo.trim()) next.referenceNo = t('accounts.payment.err_reference_required');
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (savingRef.current || !isEditable || !validate()) return;
    savingRef.current = true;
    setSaving(true);
    const paymentData = { ...form, amount: Number(form.amount), createdBy: 'admin' };
    try {
      const saved: Payment = persist
        ? await persist(paymentData, payment ?? null)
        : isEditMode && payment ? await updatePayment(payment.id, paymentData) : await createPayment(paymentData);
      onSave(saved);
      onClose();
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : t('accounts.payment.err_save_failed') });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (isEditMode && !isEditable) {
    return <Modal isOpen onClose={onClose} title={t('accounts.payment.edit_not_allowed')} footer={<Button variant="secondary" onClick={onClose}>{t('common.close')}</Button>}>
      <p className="text-sm text-slate-600">{t('accounts.payment.edit_not_allowed_desc')}</p>
    </Modal>;
  }

  const valid = Boolean(parseBusinessDate(form.paymentDate) && form.paymentType && form.paymentMode && form.paidTo.trim() && form.referenceNo.trim() && Number.isFinite(form.amount) && form.amount > 0);
  // Option labels read in the active language; the value stays the raw stored
  // type so the write path is untouched.
  const typeOptions = PAYMENT_TYPES.map(value => ({ value, label: localizePaymentType(value, t), icon: <PaymentGlyphChip glyph={paymentTypeGlyph(value)} size={16} icon={10} /> }));
  const modeOptions = PAYMENT_MODES.map(value => ({ value, label: value, icon: <PaymentGlyphChip glyph={paymentModeGlyph(value)} size={16} icon={10} /> }));
  const statusOptions = STATUSES.map(entry => ({ value: entry.value, label: t(entry.labelKey) }));
  const fieldId = (name: string) => `edit-payment-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const error = (message?: string) => message ? <p className="mt-0.5 text-[11px] text-red-600">{message}</p> : null;
  const selectedClass = (field: keyof typeof form, errorKey: string) => cn(form[field] && !errors[errorKey] && '[&>button]:border-sky-200 [&>button]:bg-sky-50/70');

  return (
    <Modal isOpen={isOpen} onClose={close} aria-label={t('accounts.payment.edit_title')} size="xl" overlayClassName="backdrop-blur-none bg-slate-900/25"
      closeOnOverlay={false} closeOnEscape={!saving && !calendarOpen}
      footer={<>
        {/* Close, not Cancel — bigger, with the shared dismiss twist. */}
        <Button variant="secondary" size="lg" className="group" disabled={saving} onClick={close}
          icon={<span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-close)]"><X size={16} /></span>}>
          {t('common.close')}
        </Button>
        <Button size="lg" type="submit" form="edit-payment-form" disabled={!valid || saving} loading={saving}>{saving ? t('accounts.payment.saving') : isEditMode ? t('accounts.payment.update') : t('accounts.payment.create')}</Button>
      </>}>
      <form id="edit-payment-form" onSubmit={handleSubmit} noValidate className={cn('master-form space-y-4', saving && 'opacity-95')}>
        {errors.form && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errors.form}</p>}
        <section className="space-y-3">
          <MasterSectionHeading>
            <span>{t('accounts.payment.section_payment')}</span>
            {isEditMode && payment && <span className="ml-2 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold normal-case tracking-normal text-slate-600">{t('accounts.payment.payment_no_chip', { no: paymentNoDisplay(payment.paymentNo) || t('accounts.payment.not_assigned') })}</span>}
          </MasterSectionHeading>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <DatePicker onOpenChange={setCalendarOpen} openOnFocus={false} label={t('accounts.payment.field_payment_date')} required className="[&_input]:h-9 [&_input]:rounded-xl [&_input]:border-slate-200 [&_input]:text-sm [&_input]:hover:border-slate-300" value={form.paymentDate} onChange={v => handleChange('paymentDate', v)} error={errors.paymentDate} disabled={saving} />
            <MasterDropdown label={t('accounts.payment.type')} labelStyle="field" required className={selectedClass('paymentType', 'paymentType')} value={form.paymentType} options={typeOptions} onChange={v => handleChange('paymentType', v)} searchable disabled={saving} error={errors.paymentType} />
            <MasterDropdown label={t('accounts.payment.mode')} labelStyle="field" required className={selectedClass('paymentMode', 'paymentMode')} value={form.paymentMode} options={modeOptions} onChange={v => handleChange('paymentMode', v)} searchable disabled={saving} error={errors.paymentMode} />
            <p className="hidden self-center text-[11px] leading-snug text-slate-400 xl:block">{form.paymentMode && form.paymentMode !== 'Cash' ? t('accounts.payment.bank_hint') : t('accounts.payment.cash_hint_short')}</p>
          </div>
        </section>
        <section className="space-y-3">
          <MasterSectionHeading>{t('accounts.payment.section_payee')}</MasterSectionHeading>
          <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-12">
            <div className="md:col-span-5"><label htmlFor={fieldId('Paid To')} className={masterLabelClass}>{t('accounts.payment.col_paid_to')}<span className="ml-0.5 text-red-500"> *</span></label><div className="relative"><span className={masterIconClass}><UserRound size={15} /></span><input id={fieldId('Paid To')} value={form.paidTo} onChange={e => handleChange('paidTo', e.target.value)} placeholder={t('accounts.payment.paid_to_placeholder')} disabled={saving} className={masterInputClass(Boolean(errors.paidTo))} /></div>{error(errors.paidTo)}</div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 md:col-span-7"><label htmlFor={fieldId('Amount')} className={masterLabelClass}>{t('accounts.payment.field_amount')}<span className="ml-0.5 text-red-500"> *</span></label><div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500"><IndianRupee size={16} /></span><input id={fieldId('Amount')} inputMode="decimal" value={form.amount || ''} onChange={e => handleChange('amount', e.target.valueAsNumber || 0)} placeholder="0.00" disabled={saving} className={cn('h-11 w-full rounded-xl border bg-white pl-9 pr-3 text-lg font-semibold tabular-nums text-slate-900 outline-none transition', errors.amount ? 'border-red-400' : 'border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/25')} /></div>{error(errors.amount)}</div>
          </div>
        </section>
        <section className="space-y-3">
          <MasterSectionHeading>{t('accounts.payment.section_reference')}</MasterSectionHeading>
          <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-12">
            <div className="md:col-span-5"><label htmlFor={fieldId('Reference')} className={masterLabelClass}>{t('accounts.payment.col_reference')}<span className="ml-0.5 text-red-500"> *</span></label><div className="relative"><span className={masterIconClass}><ScrollText size={15} /></span><input id={fieldId('Reference')} value={form.referenceNo} onChange={e => handleChange('referenceNo', e.target.value)} placeholder={t('accounts.payment.ref_placeholder')} disabled={saving} className={cn(masterInputClass(Boolean(errors.referenceNo)), 'font-medium tracking-tight uppercase')} /></div>{error(errors.referenceNo)}</div>
            <div className="md:col-span-3"><MasterDropdown label={t('accounts.payment.field_category')} labelStyle="field" value={form.category} options={[...new Set([...CATEGORIES, form.category])]} onChange={v => handleChange('category', v)} searchable disabled={saving} /></div>
            {isEditMode && <div className="md:col-span-4"><MasterDropdown label={t('accounts.payment.field_status')} labelStyle="field" value={form.status} options={statusOptions} onChange={v => handleChange('status', v as Payment['status'])} disabled={saving} /></div>}
            <div className={cn(isEditMode ? 'md:col-span-12' : 'md:col-span-7')}><label htmlFor={fieldId('Remarks')} className={masterLabelClass}>{t('accounts.payment.field_remarks')}</label><textarea id={fieldId('Remarks')} value={form.remarks} onChange={e => handleChange('remarks', e.target.value)} rows={2} placeholder={t('accounts.payment.remarks_placeholder')} disabled={saving} className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-50" /></div>
          </div>
        </section>
      </form>
    </Modal>
  );
}
