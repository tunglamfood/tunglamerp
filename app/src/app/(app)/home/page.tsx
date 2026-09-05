import Link from "next/link";
import { Card } from "@/components/ui";

const ROUTINE = [
  {
    n: 1,
    title: "Export from the scanner",
    body: "In CheckTime, run the In Out Report for the month and save it. That is the only file the system needs.",
  },
  {
    n: 2,
    title: "Drop it into Monthly pay",
    body: "Pick the month, choose the file, press Read the file. The system works out basic days, overtime, rest days and holidays for everyone.",
  },
  {
    n: 3,
    title: "Work down the check list",
    body: "Any day it cannot read — someone forgot to scan out, a day looks far too long — is listed with a suggested time. Accept it or correct it.",
  },
  {
    n: 4,
    title: "Download and import",
    body: "Once the list is empty the download unlocks. Bring that file into Million and it makes the payslips.",
  },
];

export default function HomePage() {
  return (
    <>
      <div className="mb-8">
        <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-faint">
          Tung Lam Food Industries
        </div>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight">
          One place for the whole factory.
        </h1>
        <p className="mt-2 max-w-2xl text-[15px] text-mute">
          Being built one module at a time. HR turns the scanner file into the file Million needs,
          and refuses to hand it over until every day adds up. Sales holds the customers, the
          products, and what each dealer pays for each of them.
        </p>
      </div>

      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">
        What you do each month
      </h2>
      <div className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ROUTINE.map((s) => (
          <Card key={s.n} className="rise p-5" >
            <div className="nums mb-3 flex h-7 w-7 items-center justify-center rounded-full bg-accent-soft text-[13px] font-bold text-accent">
              {s.n}
            </div>
            <div className="text-sm font-bold tracking-tight">{s.title}</div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-mute">{s.body}</p>
          </Card>
        ))}
      </div>

      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.14em] text-faint">
        Where everything lives
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          {
            href: "/month",
            title: "Monthly pay",
            body: "The scanner file and the check list, and the allowances and advances that go out with it. Start here on pay day.",
          },
          {
            href: "/workers",
            title: "Workers",
            body: "Everyone on the payroll — and behind tabs on the same page, their documents and permits, leave, hostel and transport, warnings and notes.",
          },
          {
            href: "/sales/orders",
            title: "Sales orders",
            body: "Write an order and it prices itself from what that dealer pays.",
          },
          {
            href: "/sales/prices",
            title: "Price lists",
            body: "What each dealer pays for each product, and from when. Change one and old orders keep the price they were sold at.",
          },
        ].map((c) => (
          <Link key={c.href} href={c.href} className="group">
            <Card className="h-full p-5 transition group-hover:border-accent-line group-hover:shadow-sm">
              <div className="flex items-center justify-between">
                <div className="text-base font-bold tracking-tight">{c.title}</div>
                <span className="text-accent transition group-hover:translate-x-0.5">&rarr;</span>
              </div>
              <p className="mt-1.5 text-[13px] text-mute">{c.body}</p>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-10 rounded-2xl border border-line bg-white p-5">
        <div className="text-sm font-bold tracking-tight">Two things worth knowing</div>
        <ul className="mt-3 space-y-2.5 text-[13px] text-mute">
          <li className="flex gap-2.5">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            <span>
              <strong className="text-ink">Nothing wrong gets through.</strong> If even one day
              cannot be read, the download stays locked. That is deliberate &mdash; a wrong file
              in Million means wrong payslips.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
            <span>
              <strong className="text-ink">The old spreadsheet is still there</strong>, untouched.
              Nothing here changes it. Compare the two for a month or two before you trust this
              one on its own.
            </span>
          </li>
        </ul>
      </div>
    </>
  );
}
