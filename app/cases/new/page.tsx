import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/profile";
import NewCaseForm from "./NewCaseForm";

export default async function NewCasePage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login?next=/cases/new");
  }

  return <NewCaseForm />;
}
