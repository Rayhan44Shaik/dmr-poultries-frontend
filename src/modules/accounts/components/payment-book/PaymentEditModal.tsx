import { useRef, useState, type FormEvent } from 'react';
import { parseBusinessDate, toBusinessDate } from '../../../../utils/businessDate';
import type { Payment, PaymentWritePayload } from '../../types/payment.types';
import { createPayment, updatePayment } from '../../services/paymentApiService';
import { canEditItem } from '../../../../utils/dateUtils';
import { Button } from '../../../../ui/Button';
import { Modal } from '../../../../ui/Modal';
import { Input } from '../../../../ui/Input';
import { Field } from '../../../../ui/Field';
import { uiTextareaClass } from '../../../../shared/ui/uiTokens';
import { DatePicker } from '../../../../components/common/DatePicker';
import MasterDropdown from '../../../masters/components/MasterDropdown';
import { PAYMENT_TYPES, PAYMENT_MODES, paymentNoDisplay, paymentStatusLabel } from '../../utils/paymentRegister';

interface PaymentEditModalProps {
  isOpen: boolean;
  payment: Payment | null;
  onClose: () => void;
  onSave: (payment: Payment) => void;
  /**
   * Replaces the API write. The sample preview mutates its own rows in memory,
   * so a preview edit can never reach a payment endpoint. Omitted = the server.
   */
  persist?: (payload: PaymentWritePayload, target: Payment | null) => Promise<Payment>;
}
const CATEGORIES = ['Farmer', 'Fuel', 'Maintenance', 'Salary', 'Loan', 'Office', 'Tax', 'Other'];
const STATUSES = (['Draft', 'Approved', 'Paid', 'Cancelled'] as const).map(value => ({ value, label: paymentStatusLabel(value) }));

export function PaymentEditModal(props: PaymentEditModalProps) {
  return props.isOpen ? <EditForm key={props.payment?.id ?? 'new'} {...props} /> : null;
}

function EditForm({ payment, onClose, onSave, persist }: PaymentEditModalProps) {
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
    const newErrors: Record<string, string> = {};
    if (!parseBusinessDate(form.paymentDate)) newErrors.paymentDate = 'Payment Date is required';
    if (!form.paymentType) newErrors.paymentType = 'Payment Type is required';
    if (!form.paymentMode) newErrors.paymentMode = 'Payment Mode is required';
    if (!form.paidTo.trim()) newErrors.paidTo = 'Paid To is required';
    if (!Number.isFinite(form.amount) || form.amount <= 0) newErrors.amount = 'Amount must be greater than 0';
    if (!form.referenceNo.trim()) newErrors.referenceNo = 'Reference No is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (savingRef.current || !isEditable || !validate()) return;
    savingRef.current = true;
    setSaving(true);

    const paymentData = {
      ...form,
      amount: Number(form.amount),
      createdBy: 'admin',
    };

    try {
      const saved: Payment = persist
        ? await persist(paymentData, payment ?? null)
        : isEditMode && payment
          ? await updatePayment(payment.id, paymentData)
          : await createPayment(paymentData);
      onSave(saved);
      onClose();
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : 'Unable to save payment' });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };


  if (isEditMode && !isEditable) {
    return <Modal isOpen onClose={onClose} title="Edit Not Allowed" footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      <p className="text-sm text-slate-600">This payment is older than 10 days and cannot be edited.</p>
    </Modal>;
  }
  const valid = Boolean(parseBusinessDate(form.paymentDate) && form.paymentType && form.paymentMode && form.paidTo.trim() && form.referenceNo.trim() && Number.isFinite(form.amount) && form.amount > 0);
  return (
    <Modal isOpen onClose={close} title={isEditMode ? 'Edit Payment' : 'New Payment'} description={paymentNoDisplay(payment?.paymentNo)} size="lg"
      closeOnOverlay={false} closeOnEscape={!saving && !calendarOpen} showCloseButton={!saving}
      footer={<><Button variant="secondary" onClick={close} disabled={saving}>Cancel</Button><Button type="submit" form="edit-payment-form" disabled={!valid || saving} loading={saving}>{saving ? 'Saving…' : isEditMode ? 'Update Payment' : 'Create Payment'}</Button></>}>
      <form id="edit-payment-form" onSubmit={handleSubmit} noValidate>
        {errors.form && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errors.form}</p>}
        <fieldset disabled={saving} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DatePicker onOpenChange={setCalendarOpen} label="Payment Date" required value={form.paymentDate} onChange={v => handleChange('paymentDate', v)} error={errors.paymentDate} disabled={saving} />
          <MasterDropdown label="Payment Type" labelStyle="field" required value={form.paymentType} options={[...new Set([...PAYMENT_TYPES, form.paymentType])]} onChange={v => handleChange('paymentType', v)} searchable disabled={saving} error={errors.paymentType} />
          <MasterDropdown label="Payment Mode" labelStyle="field" required value={form.paymentMode} options={[...new Set([...PAYMENT_MODES, form.paymentMode])]} onChange={v => handleChange('paymentMode', v)} searchable disabled={saving} error={errors.paymentMode} />
          <Input label="Paid To" required value={form.paidTo} onChange={e => handleChange('paidTo', e.target.value)} error={errors.paidTo} />
          <Input label="Amount (₹)" required type="number" min="1" step="1" value={form.amount || ''} onChange={e => handleChange('amount', e.target.valueAsNumber || 0)} error={errors.amount} />
          <Input label="Reference / Bill No" required value={form.referenceNo} onChange={e => handleChange('referenceNo', e.target.value)} error={errors.referenceNo} />
          <MasterDropdown label="Category" labelStyle="field" value={form.category} options={[...new Set([...CATEGORIES, form.category])]} onChange={v => handleChange('category', v)} searchable disabled={saving} />
          {isEditMode && <MasterDropdown label="Status" labelStyle="field" value={form.status} options={STATUSES} onChange={v => handleChange('status', v as Payment['status'])} disabled={saving} />}
          <Field label="Remarks" className="sm:col-span-2">{({ id }) => <textarea id={id} className={uiTextareaClass} value={form.remarks} onChange={e => handleChange('remarks', e.target.value)} rows={2} placeholder="Optional remarks" />}</Field>
        </fieldset>
      </form>
    </Modal>
  );
}
