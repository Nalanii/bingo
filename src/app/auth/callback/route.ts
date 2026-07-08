import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

/**
 * OAuth callback. Supabase redirects here with a `code` we exchange for a
 * session, then we upsert a local Profile row and send the user to /dashboard.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await prisma.profile.upsert({
          where: { id: user.id },
          create: {
            id: user.id,
            email: user.email,
            displayName:
              (user.user_metadata?.full_name as string | undefined) ?? null,
            avatarUrl:
              (user.user_metadata?.avatar_url as string | undefined) ?? null,
          },
          update: {
            email: user.email,
            displayName:
              (user.user_metadata?.full_name as string | undefined) ?? undefined,
            avatarUrl:
              (user.user_metadata?.avatar_url as string | undefined) ?? undefined,
          },
        });
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/?error=auth`);
}
