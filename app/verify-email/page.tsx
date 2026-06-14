import Link from "next/link";
import { redirect } from "next/navigation";
import { prismaAdmin } from "@/lib/prisma";
import { setDbIdentity } from "@/lib/security/db-context";

const VERIFY_IDENTIFIER_PREFIX = "email-verify:";

async function consumeVerificationToken(token: string): Promise<"ok" | "expired" | "invalid"> {
  if (!token) return "invalid";

  const record = await prismaAdmin.verificationToken.findFirst({
    where: {
      token,
      identifier: { startsWith: VERIFY_IDENTIFIER_PREFIX },
    },
  });

  if (!record) return "invalid";

  if (record.expires < new Date()) {
    await prismaAdmin.verificationToken.delete({
      where: { identifier_token: { identifier: record.identifier, token: record.token } },
    });
    return "expired";
  }

  const email = record.identifier.slice(VERIFY_IDENTIFIER_PREFIX.length);

  // Delete the token before updating to prevent reuse
  await prismaAdmin.verificationToken.delete({
    where: { identifier_token: { identifier: record.identifier, token: record.token } },
  });

  // Mark email as verified on UserProfile
  setDbIdentity({ userEmail: email });
  await prismaAdmin.userProfile.update({
    where: { email },
    data: { emailVerified: true },
  });

  return "ok";
}

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const token = typeof params?.token === "string" ? params.token.trim() : "";

  const result = token ? await consumeVerificationToken(token) : "invalid";

  if (result === "ok") {
    redirect("/login?verified=1");
  }

  return (
    <div className="flex min-h-[calc(100dvh-64px)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm text-center">
        <div className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full ${result === "expired" ? "bg-amber-100 text-amber-600" : "bg-rose-100 text-rose-600"}`}>
          <svg aria-hidden="true" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-[color:var(--text-primary)]">
          {result === "expired" ? "Link expired" : "Invalid link"}
        </h1>
        <p className="mt-3 text-sm text-[color:var(--text-secondary)]">
          {result === "expired"
            ? "This confirmation link has expired. Please request a new one."
            : "This confirmation link is invalid or has already been used."}
        </p>

        <div className="mt-6 flex flex-col gap-3">
          <Link
            href="/verify-pending"
            className="block rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-700"
          >
            Request new confirmation email
          </Link>
          <Link
            href="/login"
            className="block text-sm text-[color:var(--text-secondary)] underline hover:text-[color:var(--text-primary)]"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
