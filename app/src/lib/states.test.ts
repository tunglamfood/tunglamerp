import { describe, it, expect } from "vitest";
import { stateFromAddress, tidyState } from "./states";

describe("stateFromAddress", () => {
  it("finds Penang written the way the addresses actually write it", () => {
    // Every Penang customer in the Million export says "PULAU PINANG".
    // Searching for "Penang" found none of them.
    expect(
      stateFromAddress(
        "NO 2503, TINGKAT SELAMAT 5,\nKAMPUNG SELAMAT,\n13300 TASEK GELUGOR\nPULAU PINANG, Malaysia",
      ),
    ).toBe("Penang");
    expect(stateFromAddress("11900 Bayan Lepas, P. Pinang")).toBe("Penang");
    expect(stateFromAddress("Georgetown, Penang")).toBe("Penang");
  });

  it("finds a state wherever it sits in the address", () => {
    expect(stateFromAddress("33, JALAN WAWASAN 1/3,\n68000 SELANGOR DARUL EHSAN.\nSelangor"))
      .toBe("Selangor");
    expect(stateFromAddress("NO 1-3, MENGLEMBU, 30020 IPOH\nPERAK, Malaysia")).toBe("Perak");
  });

  it("does not mistake a town or a postcode for a state", () => {
    // This one was being stored as the state: "39100 CAMERON HIGHLANDS ."
    expect(stateFromAddress("NO 17, TAMAN TRINGKAP PUNCAK,\n39100 CAMERON HIGHLANDS.\nMalaysia"))
      .toBe("");
  });

  it("does not let a shorter name win over a longer one", () => {
    expect(stateFromAddress("Seremban, Negeri Sembilan")).toBe("Negeri Sembilan");
  });

  it("copes with an empty or missing address", () => {
    expect(stateFromAddress(null)).toBe("");
    expect(stateFromAddress("")).toBe("");
    expect(stateFromAddress("   ")).toBe("");
  });

  it("does not match a state name buried inside another word", () => {
    expect(stateFromAddress("PERAKAUNAN SDN BHD, Kuala Lumpur")).toBe("Kuala Lumpur");
  });
});

describe("tidyState", () => {
  it("makes one thing of PERAK, perak and Perak", () => {
    for (const written of ["PERAK", "perak", "Perak", " PERAK "]) {
      expect(tidyState(written)).toBe("Perak");
    }
  });

  it("turns the several spellings of Penang into one", () => {
    for (const written of ["PULAU PINANG", "Pulau Pinang", "PENANG", "P. Pinang"]) {
      expect(tidyState(written)).toBe("Penang");
    }
  });

  it("keeps something it does not recognise, but tidily and without the postcode", () => {
    expect(tidyState("39100 CAMERON HIGHLANDS .")).toBe("Cameron Highlands");
  });

  it("gives nothing back for nothing", () => {
    expect(tidyState("")).toBe("");
    expect(tidyState(null)).toBe("");
    expect(tidyState("12345")).toBe("");
  });
});
