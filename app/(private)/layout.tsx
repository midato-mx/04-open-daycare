import { Suspense } from "react";
import AuthenticatedSidebar from "@/app/components/AuthenticatedSidebar";
import Sidebar from "@/app/components/Sidebar";

export default function PrivateLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen bg-[#F6ECDF]">
      <Suspense fallback={<Sidebar profile={null} />}>
        <AuthenticatedSidebar />
      </Suspense>
      {children}
    </div>
  );
}
