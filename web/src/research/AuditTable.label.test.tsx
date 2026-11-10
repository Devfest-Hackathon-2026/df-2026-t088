import { render } from "@testing-library/react";
import { expect, test } from "vitest";
import { AuditTable } from "./AuditTable";

test("shows the chosen candidate in a readable form", () => {
  const entry = { at: "2026-11-09", role: "teacher", action: "decide", targetId: "suggestion-1", detail: "approved;candidate:2;source:gemini", reason: "分かりやすい", result: "allowed" };
  const { container } = render(<AuditTable entries={[entry] as never} onLoad={() => {}} notice={null} />);
  expect(container.textContent).toContain("承認・案 2（Gemini）");
  expect(container.textContent).not.toContain("approved;candidate");
});
