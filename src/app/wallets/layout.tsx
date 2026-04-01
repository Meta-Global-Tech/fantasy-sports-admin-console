import { Sidebar } from "@/components/Sidebar";

export default function WalletsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-56 bg-[#0a0a0f]">{children}</main>
    </div>
  );
}
