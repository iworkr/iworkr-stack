import { describe, it, expect } from "vitest";
import { formatCurrency } from "./format";

describe("formatCurrency", () => {
  it("formats positive number", () => {
    expect(formatCurrency(1234.56)).toBe("$1,234.56");
  });

  it("formats zero", () => {
    expect(formatCurrency(0)).toBe("$0");
  });

  it("formats negative number", () => {
    expect(formatCurrency(-100)).toBe("$-100");
  });

  it("formats large number", () => {
    expect(formatCurrency(1_000_000)).toBe("$1,000,000");
  });
});
