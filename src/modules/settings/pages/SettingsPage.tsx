import { useMemo } from "react";
import { useLocation,useNavigate } from "react-router-dom";
import Profile from "./Profile_copy";
import AccessManagement from "./AccessManagement";
import { useAuth } from "../../../providers/authContext";

export default function SettingsPage(){const location=useLocation(),navigate=useNavigate(),{user}=useAuth();const mayViewAccess=user?.role==="OWNER"||user?.role==="FULL_ACCESS";const requested=useMemo(()=>new URLSearchParams(location.search).get("tab"),[location.search]);const active=requested==="access"&&mayViewAccess?"access":"profile";const tabs=[{key:"profile",label:"Profile"},...(mayViewAccess?[{key:"access",label:"Access Management"}]:[])];
 return <div className="w-full px-4 pb-10 pt-6 sm:px-6 lg:px-8"><div className="mx-auto max-w-[1480px]"><div className="mb-5"><h1 className="text-xl font-bold text-slate-900 dark:text-white">Settings</h1><p className="mt-1 text-sm text-slate-500">Manage your profile and account preferences.</p></div><div role="tablist" className="mb-5 inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">{tabs.map(tab=><button key={tab.key} role="tab" aria-selected={active===tab.key} onClick={()=>navigate(`/settings?tab=${tab.key}`)} className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${active===tab.key?"bg-emerald-600 text-white shadow-sm":"text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"}`}>{tab.label}</button>)}</div>{active==="access"?<AccessManagement/>:<Profile/>}</div></div>;
}
