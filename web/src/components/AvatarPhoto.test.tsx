import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DEFAULT_LOOK, FACE_IDS, POSE_IDS } from "../photo";
import type { PhotoLook } from "../photo";
import { Avatar } from "./Avatar";
import { AvatarPhoto } from "./AvatarPhoto";
import type { PhotoShape } from "./AvatarPhoto";

const LOOK: PhotoLook = { ...DEFAULT_LOOK, gear: ["hat"] };

describe("AvatarPhoto", () => {
  it("形ごとに描け、すべて読み上げない", () => {
    for (const shape of ["face", "top", "cheki", "roster"] as PhotoShape[]) {
      const { container, unmount } = render(<AvatarPhoto look={LOOK} shape={shape} />);
      const root = container.firstElementChild;
      expect(root?.getAttribute("aria-hidden")).toBe("true");
      expect(container.querySelector("circle")).not.toBeNull();
      unmount();
    }
  });

  it("顔と名簿は頭のあたりの丸、上は全身", () => {
    expect(render(<AvatarPhoto look={LOOK} shape="face" />).container.querySelector("svg")?.getAttribute("viewBox")).toBe("16 0 48 48");
    expect(render(<AvatarPhoto look={LOOK} shape="top" />).container.querySelector("svg")?.getAttribute("viewBox")).toBe("-8 0 96 96");
  });

  it("はいけい：grid は方眼、教科は教科の色", () => {
    expect(render(<AvatarPhoto look={LOOK} shape="top" />).container.querySelector("rect")?.getAttribute("fill")).toBe("var(--color-bg)");
    const { container } = render(<AvatarPhoto look={{ ...LOOK, bg: "rika" }} shape="top" />);
    expect(container.querySelector("rect")?.getAttribute("fill")).toBe("var(--color-subject-rika)");
  });

  it("チェキのフレーム", () => {
    for (const frame of ["none", "cheki", "tape", "star", "cell"] as const) {
      const { container } = render(<AvatarPhoto look={{ ...LOOK, frame }} shape="cheki" />);
      expect(container.firstElementChild?.className).toContain(`avatar-photo-cheki--${frame}`);
    }
  });

  it("スタンプ：subject は教科で出し分ける", () => {
    const stamp = (subject: PhotoLook["stamp"], id?: "sansu" | "kokugo" | "rika" | "eigo") =>
      render(<AvatarPhoto look={{ ...LOOK, stamp: subject }} shape="cheki" stampSubject={id} />).container.querySelector(".avatar-photo__stamp");
    expect(stamp("none")).toBeNull();
    expect(stamp("hanamaru")).not.toBeNull();
    expect(stamp("star")).not.toBeNull();
    expect(stamp("heart")).not.toBeNull();
    expect(stamp("subject", "sansu")?.textContent).toBe("½");
    expect(stamp("subject", "kokugo")?.textContent).toBe("漢");
    expect(stamp("subject", "rika")?.querySelector("path:not([fill])")).toBeNull();
    expect(stamp("subject", "rika")?.querySelectorAll("path")).toHaveLength(1);
    expect(stamp("subject", "eigo")).toBeNull();
    expect(stamp("subject")).toBeNull();
  });

  it("顔の丸・上の写真にはスタンプを描かない", () => {
    expect(render(<AvatarPhoto look={{ ...LOOK, stamp: "heart" }} shape="top" />).container.querySelector(".avatar-photo__stamp")).toBeNull();
  });
});

describe("Avatar のポーズとかお", () => {
  const path = (props: object) => render(<Avatar gear={[]} size="side" {...props} />).container.querySelectorAll("path");

  it("省けば今の絵と同じ線", () => {
    const base = render(<Avatar gear={[]} size="side" />).container.innerHTML;
    expect(render(<Avatar gear={[]} size="side" pose="stand" face="smile" />).container.innerHTML).toBe(base);
    expect(base).toContain("M40 45v26M40 52 25 63M40 52l23 14M40 71 30 91M40 71l10 20");
  });

  it("ポーズ7つ・かお4つは線が違う", () => {
    expect(new Set(POSE_IDS.map((pose) => render(<Avatar gear={[]} size="side" pose={pose} />).container.innerHTML)).size).toBe(7);
    expect(new Set(FACE_IDS.map((face) => path({ face })[0]?.outerHTML + render(<Avatar gear={[]} size="side" face={face} />).container.innerHTML)).size).toBe(4);
  });
});
