import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MeasurementActivity } from "./MeasurementActivity";

describe("ながさをくらべる操作", () => {
  it("テープは操作するまで左端がそろわず、戻せる", () => {
    const { container } = render(<MeasurementActivity kind="length" />);
    const blue = container.querySelector(".measurement__tape--blue");
    expect(blue?.classList.contains("is-aligned")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "はしを そろえる" }));
    expect(blue?.classList.contains("is-aligned")).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "もとに もどす" }));
    expect(blue?.classList.contains("is-aligned")).toBe(false);
  });
  it("ブロックは0個から1個ずつ置き、やり直せる", () => {
    render(<MeasurementActivity kind="measure" />);
    expect(screen.queryAllByLabelText("ブロック1こ")).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: "1こ おく" }));
    fireEvent.click(screen.getByRole("button", { name: "1こ おく" }));
    expect(screen.getAllByLabelText("ブロック1こ")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "はじめから" }));
    expect(screen.queryAllByLabelText("ブロック1こ")).toHaveLength(0);
  });
});
