import Link from "next/link";
import LoginForm from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="min-h-screen p-6 sm:p-10 max-w-sm mx-auto flex flex-col justify-center">
      <Link href="/" className="text-sm text-neutral-500 hover:underline mb-6">
        ← Back to dashboard
      </Link>
      <h1 className="text-2xl font-bold tracking-tight mb-1">Sign In</h1>
      <p className="text-sm text-neutral-500 mb-8">Sign in to create and edit cases.</p>
      <LoginForm next={next ?? "/"} />
    </main>
  );
}
