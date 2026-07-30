import React from "react";
import { Card, Button, Input, Select } from "../common";
import { User } from "lucide-react";

export const ProfileCard: React.FC = () => (
  <Card className="flex flex-col gap-6">
    <div className="flex items-center justify-between border-b border-slate-100 pb-4"><span className="text-base font-bold text-slate-800">My Profile</span><span className="text-[10px] text-slate-400">View and update your personal details</span></div>
    <div className="flex flex-col md:flex-row gap-6">
      <div className="flex flex-col items-center gap-3 w-full md:w-32 border-r md:border-slate-100 pr-6">
        <div className="h-24 w-24 rounded-full bg-slate-100 border-4 border-white shadow-inner flex items-center justify-center text-slate-400"><User size={40} /></div>
        <Button variant="secondary" className="text-xs px-4 py-1.5 w-full">Change Photo</Button>
        <span className="text-[9px] text-slate-400 text-center">JPG, PNG (Max 5MB)</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
        <Input label="Full Name" value="Rubulla" className="bg-slate-100" readOnly />
        <Input label="Department" value="Administration" className="bg-slate-100" readOnly />
        <Input label="Email" value="info@dmrpoultries.com" className="bg-slate-100" readOnly />
        <Input label="Designation" value="Owner" className="bg-slate-100" readOnly />
        <Input label="Mobile Number" value="+91 9122456789" className="bg-slate-100" readOnly />
        <Input label="Username" value="rubullaadmin" className="bg-slate-100" readOnly />
        <Input label="Employee ID" value="DMR001" className="bg-slate-100" readOnly />
        <Input label="Date Joined" value="01-Jan-2020" className="bg-slate-100" readOnly />
      </div>
    </div>
    <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-4">
      <div className="flex-1 grid grid-cols-2 gap-4">
        <Select label="Preferred Language" options={["English", "Telugu"]} value="English" />
        <Select label="Theme Preference" options={["Light", "Dark"]} value="Light" />
      </div>
      <div className="flex items-end justify-end gap-3"><Button variant="secondary">Cancel</Button><Button>Save Changes</Button></div>
    </div>
  </Card>
);