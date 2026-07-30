import React, { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes } from "react";
import { X, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

// 1. Button
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "danger";
  fullWidth?: boolean;
}
export const Button: React.FC<ButtonProps> = ({ children, variant = "primary", fullWidth, className = "", ...props }) => {
  const base = "px-6 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants = {
    primary: "bg-[#6c5ce7] hover:bg-[#5a4bd1] text-white shadow-md shadow-indigo-500/20",
    secondary: "bg-white border border-slate-200 text-slate-700 hover:bg-slate-50",
    outline: "bg-transparent border border-slate-300 text-slate-600 hover:bg-slate-50",
    danger: "bg-rose-500 hover:bg-rose-600 text-white",
  };
  return <button className={`${base} ${variants[variant]} ${fullWidth ? "w-full" : ""} ${className}`} {...props}>{children}</button>;
};

// 2. Input
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  required?: boolean;
}
export const Input: React.FC<InputProps> = ({ label, required, className = "", ...props }) => (
  <div className="flex flex-col gap-1.5">
    {label && <label className="text-xs font-semibold text-slate-600">{label} {required && <span className="text-rose-500">*</span>}</label>}
    <input className={`w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm font-medium text-slate-700 focus:bg-white focus:border-[#6c5ce7] focus:ring-4 focus:ring-[#6c5ce7]/10 outline-none transition-all shadow-sm ${className}`} {...props} />
  </div>
);

// 3. Password Input
export const PasswordInput: React.FC<InputProps> = ({ label, required, ...props }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      {label && <label className="text-xs font-semibold text-slate-600">{label} {required && <span className="text-rose-500">*</span>}</label>}
      <div className="relative">
        <input type={show ? "text" : "password"} className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 pr-10 text-sm font-medium text-slate-700 focus:bg-white focus:border-[#6c5ce7] focus:ring-4 focus:ring-[#6c5ce7]/10 outline-none transition-all shadow-sm" {...props} />
        <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
      </div>
    </div>
  );
};

// 4. Card
interface CardProps { children: ReactNode; className?: string; }
export const Card: React.FC<CardProps> = ({ children, className = "" }) => (
  <div className={`bg-white rounded-2xl border border-slate-200/80 shadow-lg shadow-slate-100 p-6 ${className}`}>{children}</div>
);

// 5. Toast
interface ToastContainerProps { toasts: { id: number; message: string; type: "success" | "error" | "info" }[]; onRemove: (id: number) => void; }
export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => (
  <div className="fixed top-5 right-5 z-50 flex flex-col gap-3 w-80">
    {toasts.map((t) => (
      <div key={t.id} className={`p-4 rounded-xl shadow-xl border border-slate-100 flex justify-between items-start text-sm animate-in slide-in-from-right-2 fade-in duration-300 ${t.type === "success" ? "bg-emerald-50 text-emerald-800" : t.type === "error" ? "bg-red-50 text-red-800" : "bg-blue-50 text-blue-800"}`}>
        <span>{t.message}</span>
        <button onClick={() => onRemove(t.id)} className="ml-4 mt-1 text-slate-400 hover:text-slate-700"><X size={14} /></button>
      </div>
    ))}
  </div>
);

// 6. Select
interface SelectProps { label?: string; required?: boolean; options: string[]; value?: string; onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void; className?: string; }
export const Select: React.FC<SelectProps> = ({ label, required, options, className = "", ...props }) => (
  <div className={`flex flex-col gap-1.5 ${className}`}>
    {label && <label className="text-xs font-semibold text-slate-600">{label} {required && <span className="text-rose-500">*</span>}</label>}
    <select className="w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 text-sm font-medium text-slate-700 focus:bg-white focus:border-[#6c5ce7] focus:ring-4 focus:ring-[#6c5ce7]/10 outline-none transition-all shadow-sm" {...props}>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  </div>
);

// 7. 🟢 SidebarCard
export const SidebarCard: React.FC<{ icon: any; title: string; subtitle: string; to: string }> = ({ icon: Icon, title, subtitle, to }) => (
  <Link to={to} className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-5 flex flex-col gap-4 hover:shadow-md transition-all group cursor-pointer">
    <div className="flex items-start gap-4">
      <div className="h-10 w-10 rounded-xl bg-[#f0f0ff] text-[#6c5ce7] flex items-center justify-center shrink-0 group-hover:bg-[#6c5ce7] group-hover:text-white transition-colors">
        <Icon size={20} />
      </div>
      <div><h4 className="text-sm font-bold text-slate-800">{title}</h4><p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p></div>
    </div>
    <div className="mt-auto pt-2"><span className="inline-block text-[11px] font-semibold text-[#6c5ce7] border border-[#6c5ce7]/30 bg-[#6c5ce7]/5 hover:bg-[#6c5ce7]/10 px-4 py-1.5 rounded-full transition-colors">View</span></div>
  </Link>
);

// 8. 🟢 EXPORT THE TABLE
export * from "./Table";