// Staff logins — who can sign in, and what each person can open.
import { requireArea } from "@/lib/auth";
import { listStaff, type StaffLogin } from "@/lib/store-staff";
import { Notice } from "@/components/ui";
import { StaffScreen } from "@/components/staff-screen";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const me = await requireArea("admin");
  let staff: StaffLogin[] | null = null;
  let problem: string | null = null;
  try {
    staff = await listStaff();
  } catch (e) {
    problem = (e as Error).message;
  }
  if (!staff) return <Notice tone="bad">Could not load the staff logins. {problem}</Notice>;
  return <StaffScreen staff={staff} meId={me.id} />;
}
