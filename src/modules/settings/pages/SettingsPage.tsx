import { useLocation } from "react-router-dom";
import Profile from "./Profile_copy";
import AccessManagement from "./AccessManagement";

export default function SettingsPage(){const location=useLocation();const requested=new URLSearchParams(location.search).get("tab");
 return <div className="w-full px-4 pb-10 pt-6 sm:px-6 lg:px-8"><div className="mx-auto max-w-[1480px]">{requested==="access"?<AccessManagement/>:<Profile/>}</div></div>;
}
