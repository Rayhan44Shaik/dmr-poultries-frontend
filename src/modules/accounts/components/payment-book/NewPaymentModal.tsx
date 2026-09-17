// src/modules/accounts/components/payment-book/NewPaymentModal.tsx
//
// Header-free, horizontal entry sheet. The field language (36px rounded-xl
// controls, icon-inset inputs, section rules) is the one the master "shop
// form" uses, so Accounts does not look like a second, older product.
// Business rules — validation, the Cash/bank transaction-method split, the
// reference uniqueness check and the payload — are unchanged.

import React, { useState, useMemo, useRef, useId } from 'react';
import { IndianRupee, ScrollText, UserRound, X } from 'lucide-react';
import { toBusinessDate } from '../../../../utils/businessDate';
import { Modal } from '../../../../ui/Modal';
import { Button } from '../../../../ui/Button';
import { useI18n } from '../../../../i18n';
import MasterDropdown from '../../../masters/components/MasterDropdown';
import { MasterSectionHeading } from '../../../masters/components/MasterForm';
import { masterIconClass, masterInputClass, masterLabelClass } from '../../../masters/components/masterFormStyles';
import '../../../masters/styles/masters.css';
import { parseBusinessDate } from '../../../../utils/businessDate';
import { localizePaymentType, PAYMENT_TYPES } from '../../utils/paymentRegister';
import { inrInWords } from '../../utils/inrInWords';
import { PaymentGlyphChip } from './PaymentGlyphMarks';
import { paymentModeGlyph, paymentTypeGlyph } from '../../utils/paymentRegisterGlyphs';
import type { Payment, PaymentWritePayload } from '../../types/payment.types';
import { createPayment } from '../../services/paymentApiService';
import { PaymentService } from '../../services/PaymentService';
import { getBanks } from '../../../masters/banks/services/bankService';
import { DatePicker } from '../../../../components/common/DatePicker';
import { cn } from '../../../../utils/cn';

interface NewPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payment: Payment) => void;
  /** Replaces the API write; see `PaymentEditModalProps.persist`. */
  persist?: (payload: PaymentWritePayload, target: Payment | null) => Promise<Payment>;
}

const TRANSACTION_METHODS = ['UPI', 'Netbanking', 'RTGS', 'NEFT', 'Cheque'];

/** Light "this is chosen" wash for the type/mode selects (sky = picked). */
const SELECTED_FIELD_CLASS = '[&>button]:border-sky-200 [&>button]:bg-sky-50/70';

const formatIndianCurrencyInput = (value: string): string => {
  const clean = value.replace(/[^0-9.]/g, '');
  const [whole, ...fraction] = clean.split('.');
  const grouped = whole.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{2})\d{3}(?!\d))/g, ',');
  return grouped + (fraction.length ? '.' + fraction.join('').slice(0, 2) : '');
};

export function NewPaymentModal(props: NewPaymentModalProps) {
  return props.isOpen ? <PaymentForm {...props} /> : null;
}

function PaymentForm({ isOpen, onClose, onSave, persist }: NewPaymentModalProps) {
  const { t } = useI18n();
  const formId = useId();
  // ids are ASCII-safe: the rupee sign in "Amount (₹)" must not reach an id.
  const fieldId = (text: string) => `${formId}-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

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

  // Every option carries the same chip the register rows use, so the list and
  // the table speak one visual language.
  // Option labels read in the active language; the value stays the raw stored
  // type so the write path is untouched.
  const typeOptions = useMemo(
    () => PAYMENT_TYPES.map((value) => ({ value, label: localizePaymentType(value, t), icon: <PaymentGlyphChip glyph={paymentTypeGlyph(value)} size={16} icon={10} /> })),
    [t],
  );
  const modeOptions = useMemo(
    () => paymentModeOptions.map((value) => ({ value, label: value, icon: <PaymentGlyphChip glyph={paymentModeGlyph(value)} size={16} icon={10} /> })),
    [paymentModeOptions],
  );
  const transactionOptions = useMemo(
    () => TRANSACTION_METHODS.map((value) => ({ value, label: value, icon: <PaymentGlyphChip glyph={paymentModeGlyph(value)} size={16} icon={10} /> })),
    [],
  );

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
    if (!parseBusinessDate(form.paymentDate)) newErrors.paymentDate = t('accounts.payment.err_date_required');
    if (!form.paymentType) newErrors.paymentType = t('accounts.payment.err_type_required');
    if (!form.paymentMode) newErrors.paymentMode = t('accounts.payment.err_mode_required');
    if (form.paymentMode && form.paymentMode !== 'Cash' && !form.transactionMethod) {
      newErrors.transactionMethod = t('accounts.payment.err_transaction_required');
    }
    if (!form.paidTo.trim()) newErrors.paidTo = t('accounts.payment.err_paidto_required');

    const rawAmount = Number(form.amount.replace(/,/g, ''));
    if (!form.amount || !Number.isFinite(rawAmount) || rawAmount <= 0) {
      newErrors.amount = t('accounts.payment.err_amount_positive');
    }

    if (form.referenceNo.trim()) {
      const existing = PaymentService.getPayments().filter(
        (p) => p.referenceNo === form.referenceNo
      );
      if (existing.length > 0) {
        newErrors.referenceNo = t('accounts.payment.err_reference_unique');
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
      const saved = persist ? await persist(paymentData, null) : await createPayment(paymentData);
      onSave(saved);
      onClose();
    } catch (error) {
      setErrors({ form: error instanceof Error ? error.message : t('accounts.payment.err_save_failed') });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const rawAmount = Number(form.amount.replace(/,/g, ''));
  const amountInWords = Number.isFinite(rawAmount) && rawAmount > 0 ? inrInWords(rawAmount) : '';
  const valid = Boolean(parseBusinessDate(form.paymentDate) && form.paymentType && form.paymentMode && form.paidTo.trim()
    && Number.isFinite(rawAmount) && rawAmount > 0 && (form.paymentMode === 'Cash' || form.transactionMethod));
  const close = () => { if (!savingRef.current) onClose(); };

  const fieldLabel = (text: string, required = false) => (
    <label htmlFor={fieldId(text)} className={masterLabelClass}>
      {text}
      {required && (
        <span className="ml-0.5 text-red-500" aria-hidden="true">
          {" "}*
        </span>
      )}
    </label>
  );

  const fieldError = (message?: string) =>
    message ? <p className="mt-0.5 text-[11px] text-red-600">{message}</p> : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      // No title strip: the dialog is labelled for assistive tech only. The
      // top X stays — it plays the shared dismiss twist on hover.
      aria-label={t('accounts.payment.new')}
      size="xl"
      overlayClassName="backdrop-blur-none bg-slate-900/25"
      closeOnOverlay={false}
      closeOnEscape={!saving && !calendarOpen}
      footer={<>
        {/* Close, not Cancel — bigger, with the same dismiss twist the top X
            plays, so both exits say the same thing in the same language. */}
        <Button variant="secondary" size="lg" className="group" disabled={saving} onClick={close}
          icon={<span className="inline-flex motion-safe:group-hover:animate-[var(--animate-action-close)]"><X size={16} /></span>}>
          {t('common.close')}
        </Button>
        <Button size="lg" type="submit" form="new-payment-form" disabled={!valid || saving} loading={saving}>{saving ? t('accounts.payment.saving') : t('accounts.payment.create')}</Button>
      </>}
    >
      <form id="new-payment-form" onSubmit={handleSubmit} noValidate className={cn('master-form space-y-4', saving && 'opacity-95')}>
        {errors.form && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errors.form}</p>}

        {/* WHO, WHEN, HOW */}
        <section className="space-y-3">
          <MasterSectionHeading>{t('accounts.payment.section_payment')}</MasterSectionHeading>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className={cn('rounded-xl border border-transparent p-[1px]', errors.paymentDate && 'border-red-200 bg-red-50/40')}>
              <DatePicker
                onOpenChange={setCalendarOpen}
                openOnFocus={false}
                label={t('accounts.payment.field_payment_date')}
                required
                className="[&_input]:h-9 [&_input]:rounded-xl [&_input]:border-slate-200 [&_input]:text-sm [&_input]:hover:border-slate-300"
                value={form.paymentDate}
                onChange={value => handleChange('paymentDate', value)}
                error={errors.paymentDate}
                disabled={saving}
              />
            </div>
            <div>
              <MasterDropdown
                label={t('accounts.payment.type')}
                labelStyle="field"
                required
                className={cn(form.paymentType && !errors.paymentType && SELECTED_FIELD_CLASS)}
                value={form.paymentType}
                options={typeOptions}
                onChange={value => handleChange('paymentType', value)}
                placeholder={t('accounts.payment.select_type')}
                searchable
                error={errors.paymentType}
                disabled={saving}
              />
            </div>
            <div>
              <MasterDropdown
                label={t('accounts.payment.mode')}
                labelStyle="field"
                required
                className={cn(form.paymentMode && !errors.paymentMode && SELECTED_FIELD_CLASS)}
                value={form.paymentMode}
                options={modeOptions}
                onChange={value => handleChange('paymentMode', value)}
                placeholder={t('accounts.payment.select_mode')}
                searchable
                error={errors.paymentMode}
                disabled={saving}
              />
            </div>
            {form.paymentMode && form.paymentMode !== 'Cash' ? (
              <MasterDropdown
                label={t('accounts.payment.field_transaction')}
                labelStyle="field"
                required
                className={cn(form.transactionMethod && !errors.transactionMethod && SELECTED_FIELD_CLASS)}
                value={form.transactionMethod}
                options={transactionOptions}
                onChange={value => handleChange('transactionMethod', value)}
                placeholder={t('accounts.payment.select_transaction')}
                searchable
                error={errors.transactionMethod}
                disabled={saving}
              />
            ) : (
              <p className="hidden self-center text-[11px] leading-snug text-slate-400 xl:block">
                {t('accounts.payment.cash_hint')}
              </p>
            )}
          </div>
        </section>

        {/* WHO GETS PAID, HOW MUCH */}
        <section className="space-y-3">
          <MasterSectionHeading>{t('accounts.payment.section_payee')}</MasterSectionHeading>
          <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-12">
            <div className="md:col-span-5">
              {fieldLabel(t('accounts.payment.col_paid_to'), true)}
              <div className="relative">
                <span className={masterIconClass}><UserRound size={15} /></span>
                <input
                  id={fieldId('paid-to')}
                  value={form.paidTo}
                  onChange={e => handleChange('paidTo', e.target.value)}
                  onBlur={() => { if (!form.paidTo.trim()) setErrors(previous => ({ ...previous, paidTo: t('accounts.payment.err_paidto_required') })); }}
                  placeholder={t('accounts.payment.paid_to_placeholder')}
                  disabled={saving}
                  className={masterInputClass(Boolean(errors.paidTo))}
                />
              </div>
              {fieldError(errors.paidTo)}
            </div>
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3 md:col-span-7">
              <label htmlFor={fieldId('amount')} className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-emerald-900">
                {t('accounts.payment.field_amount')}
                <span className="text-red-500" aria-hidden="true">*</span>
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500">
                  <IndianRupee size={16} strokeWidth={2.2} />
                </span>
                <input
                  id={fieldId('amount')}
                  inputMode="decimal"
                  value={form.amount}
                  onChange={e => handleChange('amount', e.target.value)}
                  onBlur={() => { if (!Number.isFinite(rawAmount) || rawAmount <= 0) setErrors(previous => ({ ...previous, amount: t('accounts.payment.err_amount_positive') })); }}
                  placeholder="0.00"
                  disabled={saving}
                  className={cn(
                    'h-11 w-full rounded-xl border bg-white pl-9 pr-3 text-lg font-semibold tabular-nums text-slate-900 outline-none transition',
                    'placeholder:font-normal placeholder:text-slate-400',
                    '[&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none',
                    errors.amount
                      ? 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                      : 'border-emerald-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/25',
                  )}
                />
              </div>
              {/* The voucher line: what will be printed under the figure. */}
              <p className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-snug text-emerald-900/70">
                <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-emerald-400" aria-hidden="true" />
                <span className={cn('italic', !amountInWords && 'text-emerald-900/40 not-italic')}>
                  {amountInWords || t('accounts.payment.amount_words_placeholder')}
                </span>
              </p>
              {fieldError(errors.amount)}
            </div>
          </div>
        </section>

        {/* PAPER TRAIL */}
        <section className="space-y-3">
          <MasterSectionHeading>{t('accounts.payment.section_reference')}</MasterSectionHeading>
          <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-12">
            <div className="md:col-span-5">
              {fieldLabel(t('accounts.payment.col_reference'))}
              <div className="relative">
                <span className={masterIconClass}><ScrollText size={15} /></span>
                <input
                  id={fieldId('reference')}
                  value={form.referenceNo}
                  onChange={e => handleChange('referenceNo', e.target.value)}
                  placeholder={t('accounts.payment.ref_placeholder')}
                  disabled={saving}
                  className={cn(masterInputClass(Boolean(errors.referenceNo)), 'font-medium tracking-tight uppercase')}
                />
              </div>
              {errors.referenceNo
                ? fieldError(errors.referenceNo)
                : <p className="mt-0.5 text-[11px] text-slate-400">{t('accounts.payment.ref_optional')}</p>}
            </div>
            <div className="md:col-span-7">
              <label htmlFor={fieldId('remarks')} className={masterLabelClass}>{t('accounts.payment.field_remarks')}</label>
              <textarea
                id={fieldId('remarks')}
                value={form.remarks}
                onChange={e => handleChange('remarks', e.target.value)}
                rows={2}
                placeholder={t('accounts.payment.remarks_placeholder')}
                disabled={saving}
                className="w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:bg-slate-50"
              />
            </div>
          </div>
        </section>
      </form>
    </Modal>
  );
}
