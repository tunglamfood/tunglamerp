// Company public holidays — from "TUNG LAM FOOD INDUSTRIES SDN BHD,
// PUBLIC HOLIDAYS OBSERVED - 2026 FOR OFFICE/FACTORY" (same list for KB & KL).
// Where a holiday falls on Saturday and the company observes a replacement day,
// the replacement day is listed (e.g. Raya 2nd: Sat 21-03 replaced by Mon 23-03).

export interface CompanyHoliday {
  day: number;
  name: string;
}

export const COMPANY_HOLIDAYS: Record<string, CompanyHoliday[]> = {
  "2026-01": [{ day: 1, name: "New Year" }],
  "2026-02": [
    { day: 17, name: "Chinese New Year (1st)" },
    { day: 18, name: "Chinese New Year (2nd)" },
  ],
  "2026-03": [
    { day: 22, name: "Hari Raya Puasa (3rd)" },
    { day: 23, name: "Hari Raya Puasa (2nd — replacement for Sat 21st)" },
  ],
  "2026-05": [{ day: 1, name: "Worker / Labour Day" }],
  "2026-06": [{ day: 1, name: "Agong Birthday" }],
  "2026-08": [{ day: 31, name: "National Day / Merdeka" }],
  "2026-09": [{ day: 16, name: "Malaysia Day" }],
  "2026-11": [
    { day: 6, name: "Perak Sultan Birthday" },
    { day: 8, name: "Deepavali" },
  ],
};

export function holidaysFor(monthKey: string): CompanyHoliday[] {
  return COMPANY_HOLIDAYS[monthKey] ?? [];
}
