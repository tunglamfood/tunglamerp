// Shown for a web address that does not exist — a mistyped link, or a
// bookmark from before a screen was renamed. Says so plainly and points back
// to the places that do exist, rather than a bare "404".
import Link from "next/link";
import { Btn, Card } from "@/components/ui";

const PLACES = [
  { href: "/home", label: "Dashboard" },
  { href: "/month", label: "Monthly pay" },
  { href: "/workers", label: "Workers" },
  { href: "/sales/orders", label: "Sales orders" },
  { href: "/assistant", label: "Assistant" },
];

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md p-7">
        <h1 className="text-xl font-extrabold tracking-tight">There is no page here</h1>
        <p className="mt-2 text-sm text-mute">
          The address is wrong, or this screen has been renamed since the link was saved.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {PLACES.map((p) => (
            <Link key={p.href} href={p.href}>
              <Btn kind="ghost" size="sm">{p.label}</Btn>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
