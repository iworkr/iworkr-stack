import { describe, it, expect } from "vitest";
import { validateEmail } from "./validation";

describe("validateEmail", () => {
  it("returns true for valid email", () => {
    expect(validateEmail("user@example.com")).toBe(true);
    expect(validateEmail("test+tag@company.co.uk")).toBe(true);
  });

  it("returns false for invalid email", () => {
    expect(validateEmail("")).toBe(false);
    expect(validateEmail("no-at")).toBe(false);
    expect(validateEmail("@nodomain.com")).toBe(false);
    expect(validateEmail("spaces in@email.com")).toBe(false);
  });
});
