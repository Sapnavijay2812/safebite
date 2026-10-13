// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { CompareToggle } from "./compare-toggle";
import { CompareTray } from "./compare-tray";

describe("CompareToggle", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("adds and removes a restaurant from the comparison selection", async () => {
    render(<CompareToggle slug="harvest-table" name="Harvest Table" />);
    const button = await screen.findByRole("button", { name: /add harvest table to comparison/i });
    expect(button.getAttribute("aria-pressed")).toBe("false");

    await act(async () => {
      fireEvent.click(button);
    });
    expect(JSON.parse(window.localStorage.getItem("safebite.compare") ?? "[]")).toEqual(["harvest-table"]);
    expect((await screen.findByRole("button", { name: /remove harvest table/i })).getAttribute("aria-pressed")).toBe("true");
  });

  it("stops at three selections so comparisons stay readable", async () => {
    window.localStorage.setItem("safebite.compare", JSON.stringify(["a", "b", "c"]));
    render(<CompareToggle slug="d" name="Delta Diner" />);
    const button = await screen.findByRole("button", { name: /add delta diner/i });
    expect((button as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows the tray with a link to compare once two restaurants are selected", async () => {
    window.localStorage.setItem("safebite.compare", JSON.stringify(["a", "b"]));
    render(<CompareTray />);
    const link = await screen.findByRole("link", { name: /compare now/i });
    expect(link.getAttribute("href")).toBe("/compare?slugs=a,b");
  });
});
