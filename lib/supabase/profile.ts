import { createClient } from "@/lib/supabase/server";

export type UserRole = "member" | "reviewer" | "admin";

export interface CurrentUser {
  id: string;
  email: string | null;
  role: UserRole;
}

/** Server-only: resolves the signed-in user + their profile role, or null if anonymous. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  return {
    id: user.id,
    email: user.email ?? null,
    role: (profile?.role as UserRole) ?? "member",
  };
}
