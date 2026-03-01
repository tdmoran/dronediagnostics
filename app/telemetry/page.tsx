import { Activity } from "lucide-react";

export default function TelemetryPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white flex items-center gap-2">
        <Activity className="w-6 h-6 text-[#ffbb00]" />
        Telemetry
      </h1>
      <p className="text-[#8c8c8c] mt-2">Full telemetry data coming soon...</p>
    </div>
  );
}
