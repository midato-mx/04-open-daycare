import Sidebar from "@/app/components/Sidebar";
import { getAuthenticatedUserProfile } from "@/app/lib/authenticated-user";

export default async function AuthenticatedSidebar() {
  const profile = await getAuthenticatedUserProfile();

  return <Sidebar profile={profile} />;
}
