import { cookies } from "next/headers";
import ActivateAccountForm from "@/app/activate-account/ActivateAccountForm";

export default async function ActivateAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const initialCode =
    params.code ?? cookieStore.get("activation_code")?.value ?? "";

  return <ActivateAccountForm initialCode={initialCode} />;
}
