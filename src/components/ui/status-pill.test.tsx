import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusPill } from "./status-pill";

describe("StatusPill", () => {
  it("renders Urgent with correct text", () => {
    render(<StatusPill status="urgent" />);
    expect(screen.getByText("Urgent")).toBeTruthy();
  });

  it("renders In Progress for in_progress", () => {
    render(<StatusPill status="in_progress" />);
    expect(screen.getByText("In Progress")).toBeTruthy();
  });

  it("renders Done for done", () => {
    render(<StatusPill status="done" />);
    expect(screen.getByText("Done")).toBeTruthy();
  });

  it("applies status-based class for done", () => {
    const { container } = render(<StatusPill status="done" />);
    const span = container.firstChild as HTMLElement;
    expect(span.className).toContain("text-emerald-400");
  });
});
