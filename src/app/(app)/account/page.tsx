// My account: who I am, what I can open, and my password.
import { requireUser } from "@/lib/auth";
import { AREAS } from "@/lib/areas";
import { AccountScreen } from "@/components/account-screen";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <AccountScreen
      name={user.name}
      username={user.username}
      mustChange={user.mustChange}
      areas={AREAS.filter((a) => user.areas.includes(a.id)).map((a) => a.label)}
    />
  );
}
