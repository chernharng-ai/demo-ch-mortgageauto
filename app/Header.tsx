import Link from "next/link";
import { getCurrentUser } from "@/lib/supabase/profile";
import { signOut } from "@/lib/actions/auth";

export default async function Header() {
  const user = await getCurrentUser();

  return (
    <div className="border-b border-neutral-200">
      <div className="max-w-5xl mx-auto px-6 sm:px-10 h-12 flex items-center justify-end gap-4 text-sm">
        {user ? (
          <>
            <span className="text-neutral-500">
              {user.email} <span className="text-neutral-400 capitalize">({user.role})</span>
            </span>
            <form action={signOut}>
              <button type="submit" className="text-neutral-600 hover:text-neutral-900 hover:underline">
                Sign out
              </button>
            </form>
          </>
        ) : (
          <>
            <Link href="/login" className="text-neutral-600 hover:text-neutral-900 hover:underline">
              Sign in
            </Link>
            <Link href="/signup" className="text-neutral-900 font-medium hover:underline">
              Sign up
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
