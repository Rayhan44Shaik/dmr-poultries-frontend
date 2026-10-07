import { useEffect,useState } from "react";
import { KeyRound,Languages,Moon,Sun,UserRound } from "lucide-react";
import { profileRequest,type UserProfile } from "../../auth/authApi";
import ChangePasswordDialog from "../../auth/ChangePasswordDialog";
import { useI18n } from "../../../i18n";
import { useTheme } from "../../../providers/ThemeProvider";

const date=(value:string|null)=>value?new Intl.DateTimeFormat("en-IN",{day:"2-digit",month:"short",year:"numeric"}).format(new Date(value)):"Not changed yet";
const roleLabel=(role:string)=>role.toLowerCase().split("_").map(x=>x[0].toUpperCase()+x.slice(1)).join(" ");

export default function Profile(){const [profile,setProfile]=useState<UserProfile|null>(null);const [failed,setFailed]=useState(false);const [passwordOpen,setPasswordOpen]=useState(false);const {language,setLanguage}=useI18n();const {theme,setTheme}=useTheme();
 useEffect(()=>{let live=true;profileRequest().then(v=>{if(live)setProfile(v)}).catch(()=>{if(live)setFailed(true)});return()=>{live=false}},[]);
 if(failed)return <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">Unable to load your profile.</div>;
 if(!profile)return <div className="space-y-3" aria-label="Loading profile">{[1,2,3].map(x=><div key={x} className="h-20 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />)}</div>;
 const initials=profile.fullName.split(/\s+/).slice(0,2).map(x=>x[0]).join("").toUpperCase();
 const field=(label:string,value:string|null)=><div><dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</dt><dd className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">{value||"—"}</dd></div>;
 return <div className="space-y-5">
  <div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white">{initials||<UserRound size={18}/>}</span><div><h2 className="text-lg font-bold text-slate-900 dark:text-white">{profile.fullName}</h2><p className="text-xs text-slate-500">{roleLabel(profile.role)}{profile.employeeNumber?` · ${profile.employeeNumber}`:""}</p></div></div>
  <section><h3 className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-100">Personal Information</h3><dl className="grid grid-cols-1 gap-5 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 lg:grid-cols-3 dark:border-slate-700 dark:bg-slate-900">{field("Full Name",profile.fullName)}{field("Employee Number",profile.employeeNumber)}{field("Mobile Number",profile.mobileNumber)}{field("Role",roleLabel(profile.role))}{field("Username",profile.username)}</dl></section>
  <section><h3 className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-100">Security</h3><div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><div className="flex items-center gap-3"><KeyRound size={18} className="text-emerald-600"/><div><p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Password</p><p className="text-xs text-slate-500">Last changed: {date(profile.lastPasswordResetAt)}</p></div></div><button onClick={()=>setPasswordOpen(true)} className="rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700">Change Password</button></div></section>
  <section><h3 className="mb-2 text-sm font-bold text-slate-800 dark:text-slate-100">Preferences</h3><div className="grid gap-5 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-2 dark:border-slate-700 dark:bg-slate-900"><label className="block"><span className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300"><Languages size={15}/>Language</span><select value={language} onChange={e=>setLanguage(e.target.value as "en"|"te")} className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"><option value="en">English</option><option value="te">తెలుగు</option></select></label><div><p className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">{theme==="dark"?<Moon size={15}/>:<Sun size={15}/>}Appearance</p><div className="mt-2 grid grid-cols-2 rounded-lg border border-slate-200 p-1 dark:border-slate-700">{(["light","dark"] as const).map(v=><button key={v} onClick={()=>setTheme(v)} aria-pressed={theme===v} className={`rounded-md px-3 py-2 text-xs font-semibold capitalize ${theme===v?"bg-emerald-600 text-white":"text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"}`}>{v}</button>)}</div></div></div></section>
  <ChangePasswordDialog open={passwordOpen} onClose={()=>setPasswordOpen(false)}/>
 </div>;
}
