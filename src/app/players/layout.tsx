import { Sidebar } from "@/components/Sidebar";

export default function PlayersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen text-slate-100">
      <Sidebar />
      <main className="flex-1 ml-56">{children}</main>
    </div>
  );
}
