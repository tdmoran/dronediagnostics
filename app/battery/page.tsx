import { Battery } from "lucide-react";

export default function BatteryPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2">
        <Battery className="w-6 h-6 text-[#ffbb00]" />
        Battery
      </h1>
      <p className="text-[#8c8c8c] mt-2">Battery monitoring coming soon...</p>
    </div>
  );
}
