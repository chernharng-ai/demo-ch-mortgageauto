import { getCurrentUser } from "@/lib/supabase/profile";
import { signOut } from "@/lib/actions/auth";

// Sign in / sign up links are temporarily hidden — the app is fully open
// right now (see supabase/migrations/0005_temporary_reopen.sql). Still shows
// signed-in state for anyone who navigates to /login directly.
export default async function Header() {
  const user = await getCurrentUser();

  if (!user) return null;

  return (
    <div className="border-b border-neutral-200">
      <div className="max-w-5xl mx-auto px-6 sm:px-10 h-12 flex items-center justify-end gap-4 text-sm">
        <span className="text-neutral-500">
          {user.email} <span className="text-neutral-400 capitalize">({user.role})</span>
        </span>
        <form action={signOut}>
          <button type="submit" className="text-neutral-600 hover:text-neutral-900 hover:underline">
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
