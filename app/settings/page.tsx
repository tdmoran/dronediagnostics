import { Settings } from "lucide-react";

export default function SettingsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2">
        <Settings className="w-6 h-6 text-[#ffbb00]" />
        Settings
      </h1>
      <p className="text-[#8c8c8c] mt-2">Application settings coming soon...</p>
    </div>
  );
}
