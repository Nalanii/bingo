import { Button } from "@/components/ui/button";

/** Posts to the sign-out route handler and clears the Supabase session. */
export function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <Button type="submit" variant="ghost" size="sm">
        Sign out
      </Button>
    </form>
  );
}
