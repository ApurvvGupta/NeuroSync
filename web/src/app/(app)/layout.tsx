import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import TelemetryProvider from "@/components/TelemetryProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <TelemetryProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </TelemetryProvider>
  );
}
