import { Sidebar } from "@/components/Sidebar";

export default function MatchesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 ml-56">{children}</main>
    </div>
  );
}
