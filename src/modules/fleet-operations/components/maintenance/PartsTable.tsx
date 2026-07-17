import { memo } from 'react';
import { Trash2, Plus } from 'lucide-react';
import type { PartItem } from '../../types';

interface PartsTableProps {
  parts: PartItem[];
  setParts: (parts: PartItem[]) => void;
}

const PartsTable = ({ parts, setParts }: PartsTableProps) => {
  const updatePart = (index: number, field: keyof PartItem, value: any) => {
    const newParts = [...parts];
    newParts[index] = { ...newParts[index], [field]: value };
    
    // Auto-calculate amount
    if (field === 'quantity' || field === 'rate') {
      const quantity = field === 'quantity' ? value : newParts[index].quantity;
      const rate = field === 'rate' ? value : newParts[index].rate;
      newParts[index].amount = (Number(quantity) || 0) * (Number(rate) || 0);
    }
    
    setParts(newParts);
  };

  // Sanitize quantity – only integers, remove leading zeros
  const sanitizeQuantity = (value: string): string => {
    let cleaned = value.replace(/[^0-9]/g, '');
    if (cleaned.length > 1 && cleaned.startsWith('0')) {
      cleaned = cleaned.replace(/^0+/, '');
      if (cleaned === '') cleaned = '0';
    }
    return cleaned;
  };

  // Sanitize rate – only numbers and one decimal point
  const sanitizeRate = (value: string): string => {
    let cleaned = value.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) {
      cleaned = parts[0] + '.' + parts.slice(1).join('');
    }
    if (cleaned.startsWith('.')) {
      cleaned = '0' + cleaned;
    }
    return cleaned;
  };

  const handleQuantityChange = (index: number, value: string) => {
    const sanitized = sanitizeQuantity(value);
    const numValue = sanitized === '' ? 0 : parseInt(sanitized, 10);
    updatePart(index, 'quantity', numValue);
  };

  const handleRateChange = (index: number, value: string) => {
    const sanitized = sanitizeRate(value);
    const numValue = sanitized === '' || sanitized === '.' ? 0 : parseFloat(sanitized);
    updatePart(index, 'rate', numValue);
  };

  const addRow = () => {
    setParts([
      ...parts,
      { name: '', specification: '', quantity: 1, rate: 0, amount: 0 }
    ]);
  };

  const removeRow = (index: number) => {
    if (parts.length > 1) {
      setParts(parts.filter((_, i) => i !== index));
    }
  };

  const totalCost = parts.reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-semibold text-gray-700">
          Parts / Items Used <span className="text-red-500">*</span>
        </h4>
        <button
          onClick={addRow}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors shadow-sm hover:shadow"
        >
          <Plus className="w-4 h-4" />
          Add Row
        </button>
      </div>

      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                Item Name <span className="text-red-500">*</span>
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Specification</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">QTY</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">RATE (₹)</th>
              <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 uppercase">AMOUNT (₹)</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase">ACTION</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {parts.map((part, index) => {
              const amount = part.amount || 0;

              return (
                <tr key={index}>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={part.name}
                      onChange={(e) => updatePart(index, 'name', e.target.value)}
                      placeholder="Part name (required)"
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={part.specification || ''}
                      onChange={(e) => updatePart(index, 'specification', e.target.value)}
                      placeholder="Spec"
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={part.quantity || ''}
                      onChange={(e) => handleQuantityChange(index, e.target.value)}
                      placeholder="0"
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={part.rate || ''}
                      onChange={(e) => handleRateChange(index, e.target.value)}
                      placeholder="0.00"
                      className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-gray-700">
                    {amount > 0 ? `₹${amount.toFixed(2)}` : '—'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => removeRow(index)}
                      disabled={parts.length === 1}
                      className="p-1 text-red-500 hover:bg-red-50 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-50">
            <tr>
              <td colSpan={4} className="px-3 py-2 text-right font-semibold text-gray-700">
                Total Cost:
              </td>
              <td className="px-3 py-2 text-right font-bold text-blue-600">
                ₹{totalCost.toFixed(2)}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

export default memo(PartsTable);