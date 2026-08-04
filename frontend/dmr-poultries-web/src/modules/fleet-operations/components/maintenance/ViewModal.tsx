import React from 'react';
import type { MaintenanceEvent } from '../../types';

interface ViewModalProps {
  record: MaintenanceEvent;
  vehicles: any[];
  onClose: () => void;
}

const ViewModal: React.FC<ViewModalProps> = ({ record, vehicles, onClose }) => {
  const vehicle = vehicles.find((v: any) => String(v.id) === String(record.vehicleId));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm uppercase tracking-wider font-bold text-slate-800">Maintenance Record</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-sm font-semibold">
            Close
          </button>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 bg-slate-50/50 p-4 rounded-xl border border-slate-200">
            <div className="flex justify-between border-b border-slate-200/60 pb-2">
              <span className="text-sm text-slate-500">Vehicle</span>
              <span className="text-sm font-medium text-slate-800">
                {vehicle?.vehicleNumber || record.vehicleId}
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-200/60 pb-2">
              <span className="text-sm text-slate-500">Date</span>
              <span className="text-sm font-medium text-slate-800">
                {new Date(record.date).toLocaleDateString('en-GB')}
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-200/60 pb-2">
              <span className="text-sm text-slate-500">Bill Number</span>
              <span className="text-sm font-medium text-slate-800">
                {record.billNumber || '-'}
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-200/60 pb-2">
              <span className="text-sm text-slate-500">Current KM</span>
              <span className="text-sm font-medium text-slate-800">
                {record.currentKM.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-200/60 pb-2">
              <span className="text-sm text-slate-500">Maintenance Type</span>
              <span className="text-sm font-medium text-slate-800">
                {record.maintenanceType}
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-200/60 pb-2">
              <span className="text-sm text-slate-500">Service Type</span>
              <span className="text-sm font-medium text-slate-800">
                {record.serviceType}
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-200/60 pb-2">
              <span className="text-sm text-slate-500">Garage</span>
              <span className="text-sm font-medium text-slate-800">
                {record.garage || '-'}
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-200/60 pb-2">
              <span className="text-sm text-slate-500">Mechanic</span>
              <span className="text-sm font-medium text-slate-800">
                {record.mechanic || '-'}
              </span>
            </div>
            <div className="flex justify-between border-b border-slate-200/60 pb-2">
              <span className="text-sm text-slate-500">Driver</span>
              <span className="text-sm font-medium text-slate-800">
                {record.driverName || '-'}
              </span>
            </div>
          </div>

          {record.parts && record.parts.length > 0 && (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Item</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {record.parts.map((p, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2.5 text-sm text-slate-800">{p.name}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-800 text-center">{p.quantity}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-800 text-right">
                        ₹{p.amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 transition"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewModal;