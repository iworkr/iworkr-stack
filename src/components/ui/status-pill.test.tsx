import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StatusPill, formatStatus } from "./status-pill";

/* ═══════════════════════════════════════════════════════════════════
   StatusPill + formatStatus — Unit Tests
   ═══════════════════════════════════════════════════════════════════ */

describe("formatStatus", () => {
  describe("mapped statuses (13 entries)", () => {
    const mappedStatuses: [string, string][] = [
      ["backlog", "Draft"],
      ["todo", "To Do"],
      ["scheduled", "Scheduled"],
      ["en_route", "En Route"],
      ["on_site", "On Site"],
      ["in_progress", "In Progress"],
      ["done", "Done"],
      ["completed", "Completed"],
      ["invoiced", "Invoiced"],
      ["archived", "Archived"],
      ["cancelled", "Cancelled"],
      ["urgent", "Urgent"],
      ["on_hold", "On Hold"],
    ];

    it.each(mappedStatuses)(
      'maps "%s" → "%s"',
      (input, expected) => {
        expect(formatStatus(input)).toBe(expected);
      }
    );
  });

  describe("unknown status fallback", () => {
    it('replaces underscores and title-cases: "some_random_status" → "Some Random Status"', () => {
      expect(formatStatus("some_random_status")).toBe("Some Random Status");
    });

    it('handles single word: "custom" → "Custom"', () => {
      expect(formatStatus("custom")).toBe("Custom");
    });

    it('handles multiple underscores: "very_long_custom_status" → "Very Long Custom Status"', () => {
      expect(formatStatus("very_long_custom_status")).toBe("Very Long Custom Status");
    });

    it('handles already title-cased unknown status: "Ready" → "Ready"', () => {
      expect(formatStatus("Ready")).toBe("Ready");
    });

    it("handles empty string by returning empty string", () => {
      expect(formatStatus("")).toBe("");
    });

    it('handles single character: "x" → "X"', () => {
      expect(formatStatus("x")).toBe("X");
    });
  });
});

describe("StatusPill", () => {
  describe("renders correct text for each major status", () => {
    it("renders 'Draft' for backlog", () => {
      render(<StatusPill status="backlog" />);
      expect(screen.getByText("Draft")).toBeTruthy();
    });

    it("renders 'To Do' for todo", () => {
      render(<StatusPill status="todo" />);
      expect(screen.getByText("To Do")).toBeTruthy();
    });

    it("renders 'Scheduled' for scheduled", () => {
      render(<StatusPill status="scheduled" />);
      expect(screen.getByText("Scheduled")).toBeTruthy();
    });

    it("renders 'En Route' for en_route", () => {
      render(<StatusPill status="en_route" />);
      expect(screen.getByText("En Route")).toBeTruthy();
    });

    it("renders 'On Site' for on_site", () => {
      render(<StatusPill status="on_site" />);
      expect(screen.getByText("On Site")).toBeTruthy();
    });

    it("renders 'In Progress' for in_progress", () => {
      render(<StatusPill status="in_progress" />);
      expect(screen.getByText("In Progress")).toBeTruthy();
    });

    it("renders 'Done' for done", () => {
      render(<StatusPill status="done" />);
      expect(screen.getByText("Done")).toBeTruthy();
    });

    it("renders 'Completed' for completed", () => {
      render(<StatusPill status="completed" />);
      expect(screen.getByText("Completed")).toBeTruthy();
    });

    it("renders 'Invoiced' for invoiced", () => {
      render(<StatusPill status="invoiced" />);
      expect(screen.getByText("Invoiced")).toBeTruthy();
    });

    it("renders 'Archived' for archived", () => {
      render(<StatusPill status="archived" />);
      expect(screen.getByText("Archived")).toBeTruthy();
    });

    it("renders 'Cancelled' for cancelled", () => {
      render(<StatusPill status="cancelled" />);
      expect(screen.getByText("Cancelled")).toBeTruthy();
    });

    it("renders 'Urgent' for urgent", () => {
      render(<StatusPill status="urgent" />);
      expect(screen.getByText("Urgent")).toBeTruthy();
    });

    it("renders 'On Hold' for on_hold", () => {
      render(<StatusPill status="on_hold" />);
      expect(screen.getByText("On Hold")).toBeTruthy();
    });
  });

  describe("applies correct color classes", () => {
    it("applies emerald classes for done", () => {
      const { container } = render(<StatusPill status="done" />);
      const span = container.firstChild as HTMLElement;
      expect(span.className).toContain("bg-emerald-500/10");
      expect(span.className).toContain("text-emerald-400");
      expect(span.className).toContain("border-emerald-500/20");
    });

    it("applies emerald classes for completed", () => {
      const { container } = render(<StatusPill status="completed" />);
      const span = container.firstChild as HTMLElement;
      expect(span.className).toContain("text-emerald-400");
    });

    it("applies rose classes for urgent", () => {
      const { container } = render(<StatusPill status="urgent" />);
      const span = container.firstChild as HTMLElement;
      expect(span.className).toContain("bg-rose-500/10");
      expect(span.className).toContain("text-rose-400");
      expect(span.className).toContain("border-rose-500/20");
    });

    it("applies amber classes for in_progress", () => {
      const { container } = render(<StatusPill status="in_progress" />);
      const span = container.firstChild as HTMLElement;
      expect(span.className).toContain("bg-amber-500/10");
      expect(span.className).toContain("text-amber-400");
      expect(span.className).toContain("border-amber-500/20");
    });

    it("applies amber classes for en_route", () => {
      const { container } = render(<StatusPill status="en_route" />);
      const span = container.firstChild as HTMLElement;
      expect(span.className).toContain("text-amber-400");
    });

    it("applies sky classes for scheduled", () => {
      const { container } = render(<StatusPill status="scheduled" />);
      const span = container.firstChild as HTMLElement;
      expect(span.className).toContain("bg-sky-500/10");
      expect(span.className).toContain("text-sky-400");
      expect(span.className).toContain("border-sky-500/20");
    });

    it("applies violet classes for on_site", () => {
      const { container } = render(<StatusPill status="on_site" />);
      const span = container.firstChild as HTMLElement;
      expect(span.className).toContain("text-violet-400");
    });

    it("applies blue classes for invoiced", () => {
      const { container } = render(<StatusPill status="invoiced" />);
      const span = container.firstChild as HTMLElement;
      expect(span.className).toContain("text-blue-400");
    });

    it("applies orange classes for on_hold", () => {
      const { container } = render(<StatusPill status="on_hold" />);
      const span = container.firstChild as HTMLElement;
      expect(span.className).toContain("text-orange-400");
    });

    it("applies zinc classes for backlog", () => {
      const { container } = render(<StatusPill status="backlog" />);
      const span = container.firstChild as HTMLElement;
      expect(span.className).toContain("text-zinc-500");
    });

    it("applies zinc classes for todo", () => {
      const { container } = render(<StatusPill status="todo" />);
      const span = container.firstChild as HTMLElement;
      expect(span.className).toContain("text-zinc-400");
    });
  });

  describe("unknown status fallback", () => {
    it("uses backlog (zinc) styles for unknown status", () => {
      const { container } = render(<StatusPill status="something_unknown" />);
      const span = container.firstChild as HTMLElement;
      expect(span.className).toContain("bg-zinc-500/8");
      expect(span.className).toContain("text-zinc-500");
      expect(span.className).toContain("border-zinc-500/15");
    });

    it("renders formatted text for unknown status", () => {
      render(<StatusPill status="something_unknown" />);
      expect(screen.getByText("Something Unknown")).toBeTruthy();
    });
  });

  describe("renders as a span with base classes", () => {
    it("renders a span element", () => {
      const { container } = render(<StatusPill status="done" />);
      expect(container.firstChild?.nodeName).toBe("SPAN");
    });

    it("includes base layout classes", () => {
      const { container } = render(<StatusPill status="done" />);
      const span = container.firstChild as HTMLElement;
      expect(span.className).toContain("inline-flex");
      expect(span.className).toContain("rounded-full");
      expect(span.className).toContain("font-semibold");
    });
  });
});
