// src/modules/accounts/components/payment-book/NewPaymentModal.tsx

import React, { useState, useMemo, useRef } from 'react';
import { toBusinessDate } from '../../../../utils/businessDate';
import { Modal } from '../../../../ui/Modal';
import { Button } from '../../../../ui/Button';
import { Input } from '../../../../ui/Input';
import { uiTextareaClass } from '../../../../shared/ui/uiTokens';
import MasterDropdown from '../../../masters/components/MasterDropdown';
import '../../../masters/styles/masters.css';
import { parseBusinessDate } from '../../../../utils/businessDate';
import { PAYMENT_TYPES } from '../../utils/paymentRegister';
import type { Payment } from '../../types/payment.types';
import { createPayment } from '../../services/paymentApiService';
import { PaymentService } from '../../services/PaymentService';
import { getBanks } from '../../../masters/banks/services/bankService';
import { DatePicker } from '../../../../components/common/DatePicker';

interface NewPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payment: Payment) => void;
}

const TRANSACTION_METHODS = ['UPI', 'Netbanking', 'RTGS', 'NEFT', 'Cheque'];

const formatIndianCurrencyInput = (value: string): string => {
  const clean = value.replace(/[^0-9.]/g, '');
  const [whole, ...fraction] = clean.split('.');
  const grouped = whole.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{2})*\d{3}(?!\d))/g, ',');
  return grouped + (fraction.length ? '.' + fraction.join('').slice(0, 2) : '');
};

export function NewPaymentModal(props: NewPaymentModalProps) {
  return props.isOpen ? <PaymentForm {...props} /> : null;
}

function PaymentForm({ isOpen, onClose, onSave }: NewPaymentModalProps) {
  const paymentModeOptions = useMemo(() => {
    try {
      const activeBanks = getBanks()
        .filter((b) => b.status === 'Active')
        .map((b) => b.bankName);
      return ['Cash', ...activeBanks];
    } catch {
      return ['Cash'];
    }
  }, []);

  const [form, setForm] = useState({
    paymentDate: toBusinessDate(new Date()),
    paymentType: '',
    paymentMode: '',
    transactionMethod: '',
    paidTo: '',
    amount: '',
    referenceNo: '',
    remarks: '',
  });

  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleChange = (field: keyof typeof form, value: string) => {
    if (field === 'amount') {
      value = formatIndianCurrencyInput(value);
    }
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!parseBusinessDate(form.paymentDate)) newErrors.paymentDate = 'Payment Date is required';
    if (!form.paymentType) newErrors.paymentType = 'Payment Type is required';
    if (!form.paymentMode) newErrors.paymentMode = 'Payment Mode is required';
    if (form.paymentMode && form.paymentMode !== 'Cash' && !form.transactionMethod) {
      newErrors.transactionMethod = 'Transaction Method is required';
    }
    if (!form.paidTo.trim()) newErrors.paidTo = 'Paid To is required';
    
    const rawAmount = Number(form.amount.replace(/,/g, ''));
    if (!form.amount || !Number.isFinite(rawAmount) || rawAmount <= 0) {
      newErrors.amount = 'Amount must be greater than 0';
    }
    
    if (form.referenceNo.trim()) {
      const existing = PaymentService.getPayments().filter(
        (p) => p.referenceNo === form.referenceNo
      );
      if (existing.length > 0) {
        newErrors.referenceNo = 'Reference No must be unique';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (savingRef.current || !validate()) return;
    savingRef.current = true;
    setSaving(true);

    const finalPaymentMode = form.paymentMode === 'Cash'
      ? 'Cash'
      : form.transactionMethod === 'UPI' ? 'UPI' : form.transactionMethod === 'NEFT' ? 'NEFT' : form.transactionMethod === 'RTGS' ? 'RTGS' : form.transactionMethod === 'Cheque' ? 'Cheque' : 'Bank Transfer';

    const rawAmount = Number(form.amount.replace(/,/g, ''));

    const paymentData = {
      paymentDate: form.paymentDate,
      paymentType: form.paymentType,
      paymentMode: finalPaymentMode,
      paidTo: form.paidTo,
      amount: rawAmount,
      referenceNo: form.referenceNo.trim() || `REF-${Date.now().toString().slice(-6)}`,
      category: form.paymentType, 
      remarks: form.remarks,
      status: 'Approved' as const, // Directly Approved / Paid instead of Draft
      createdBy: 'admin',
    };

    try {
      const saved = await createPayment(paymentData);
      onSave(saved);
      onClose();
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : 'Unable to save payment' });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const rawAmount = Number(form.amount.replace(/,/g, ''));
  const valid = Boolean(parseBusinessDate(form.paymentDate) && form.paymentType && form.paymentMode && form.paidTo.trim()
    && Number.isFinite(rawAmount) && rawAmount > 0 && (form.paymentMode === 'Cash' || form.transactionMethod));
  const close = () => { if (!savingRef.current) onClose(); };

  return (
    <Modal isOpen={isOpen} onClose={close} title="New Payment" description="Record an outgoing payment. Required fields are marked with *." size="lg"
      closeOnOverlay={false} closeOnEscape={!saving && !calendarOpen} showCloseButton={!saving}
      footer={<><Button variant="secondary" onClick={close} disabled={saving}>Cancel</Button><Button type="submit" form="new-payment-form" disabled={!valid || saving} loading={saving}>{saving ? 'Saving…' : 'Create Payment'}</Button></>}>
      <form id="new-payment-form" onSubmit={handleSubmit} noValidate className="space-y-5">
        {errors.form && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errors.form}</p>}
        <fieldset disabled={saving} className="space-y-3">
          <legend className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Payment details</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <DatePicker onOpenChange={setCalendarOpen} label="Payment Date" required value={form.paymentDate} onChange={value => handleChange('paymentDate', value)} error={errors.paymentDate} disabled={saving} />
            <MasterDropdown label="Payment Type" labelStyle="field" required value={form.paymentType} options={PAYMENT_TYPES} onChange={value => handleChange('paymentType', value)} placeholder="Select payment type" searchable error={errors.paymentType} disabled={saving} />
            <MasterDropdown label="Payment Mode" labelStyle="field" required value={form.paymentMode} options={paymentModeOptions} onChange={value => handleChange('paymentMode', value)} placeholder="Select cash or bank" searchable error={errors.paymentMode} disabled={saving} />
            {form.paymentMode && form.paymentMode !== 'Cash' && <MasterDropdown label="Transaction Method" labelStyle="field" required value={form.transactionMethod} options={TRANSACTION_METHODS} onChange={value => handleChange('transactionMethod', value)} placeholder="Select transaction method" searchable error={errors.transactionMethod} disabled={saving} />}
            <Input label="Paid To" required value={form.paidTo} onChange={e => handleChange('paidTo', e.target.value)} onBlur={() => { if (!form.paidTo.trim()) setErrors(previous => ({ ...previous, paidTo: 'Paid To is required' })); }} placeholder="Enter vendor, farmer or employee name" error={errors.paidTo} />
          </div>
        </fieldset>
        <fieldset disabled={saving} className="border-t border-slate-100 pt-4">
          <legend className="text-xs font-semibold uppercase tracking-wider text-slate-500">Amount</legend>
          <Input label="Amount (₹)" required inputMode="decimal" value={form.amount} onChange={e => handleChange('amount', e.target.value)} onBlur={() => { if (!Number.isFinite(rawAmount) || rawAmount <= 0) setErrors(previous => ({ ...previous, amount: 'Amount must be greater than 0' })); }} placeholder="0.00" error={errors.amount} className="text-lg font-semibold tabular-nums" helper="Enter the total paid, including paise if applicable." />
        </fieldset>
        <fieldset disabled={saving} className="space-y-4 border-t border-slate-100 pt-4">
          <legend className="text-xs font-semibold uppercase tracking-wider text-slate-500">Reference</legend>
          <Input label="Reference / Bill No" value={form.referenceNo} onChange={e => handleChange('referenceNo', e.target.value)} placeholder="Invoice, bill or transaction reference (optional)" error={errors.referenceNo} />
          <label className="block text-sm font-medium text-slate-700">Remarks / Notes<textarea className={`${uiTextareaClass} mt-1.5`} value={form.remarks} onChange={e => handleChange('remarks', e.target.value)} rows={2} placeholder="Purpose of payment or additional details (optional)" /></label>
        </fieldset>
      </form>
    </Modal>
  );
}
