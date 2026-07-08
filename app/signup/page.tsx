import Link from "next/link";
import SignupForm from "./SignupForm";

export default function SignupPage() {
  return (
    <main className="min-h-screen p-6 sm:p-10 max-w-sm mx-auto flex flex-col justify-center">
      <Link href="/" className="text-sm text-neutral-500 hover:underline mb-6">
        ← Back to dashboard
      </Link>
      <h1 className="text-2xl font-bold tracking-tight mb-1">Sign Up</h1>
      <p className="text-sm text-neutral-500 mb-8">Create a team account to start creating and editing cases.</p>
      <SignupForm />
    </main>
  );
}
