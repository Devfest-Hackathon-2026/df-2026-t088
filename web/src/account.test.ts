import { beforeEach, describe, expect, it, vi } from "vitest";
import { ACCOUNT_KEY, LEGACY_GRADE_KEY, SAMPLE_ACCOUNT_NAME, initialGrade, loadAccount, migrateLegacyGrade, saveAccountGrade, saveLearningGrade } from "./account";

const DEFAULT = { name: SAMPLE_ACCOUNT_NAME, avatarId: "default", grade: 6 };

beforeEach(() => localStorage.clear());

describe("仮アカウントの読み込み（API-001）", () => {
  it("保存が無ければ見本の名前と default", () => {
    expect(loadAccount()).toEqual(DEFAULT);
    expect(loadAccount({ getItem: () => null })).toEqual(DEFAULT);
  });

  it("保存された default を読む。名前は保存していなくても見本", () => {
    localStorage.setItem(ACCOUNT_KEY, '{"avatarId":"default"}');
    expect(loadAccount()).toEqual(DEFAULT);
  });

  it("JSON として読めない値は default", () => {
    for (const value of ["", "abc", "{", '{"avatarId":', "undefined"]) {
      localStorage.setItem(ACCOUNT_KEY, value);
      expect(loadAccount()).toEqual(DEFAULT);
    }
  });

  it("JSON がオブジェクトでなければ default（null・配列・数・文字列）", () => {
    for (const value of ["null", "[]", '["default"]', "1", '"default"', "true"]) {
      localStorage.setItem(ACCOUNT_KEY, value);
      expect(loadAccount()).toEqual(DEFAULT);
    }
  });

  it("avatarId が文字列でなければ default", () => {
    for (const value of ['{"avatarId":1}', '{"avatarId":null}', '{"avatarId":["default"]}', "{}"]) {
      localStorage.setItem(ACCOUNT_KEY, value);
      expect(loadAccount()).toEqual(DEFAULT);
    }
  });

  it("知らない id は default", () => {
    for (const id of ["robot", "Default", "", " default"]) {
      localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ avatarId: id }));
      expect(loadAccount()).toEqual(DEFAULT);
    }
  });

  it("名前を保存していても使わず、見本の名前を返す", () => {
    localStorage.setItem(ACCOUNT_KEY, '{"name":"ほかの人","avatarId":"default"}');
    expect(loadAccount().name).toBe(SAMPLE_ACCOUNT_NAME);
  });

  it("getItem が例外を投げても default（投げない）", () => {
    expect(() =>
      loadAccount({
        getItem: () => {
          throw new Error("denied");
        },
      }),
    ).not.toThrow();
    expect(
      loadAccount({
        getItem: () => {
          throw new Error("denied");
        },
      }),
    ).toEqual(DEFAULT);
  });

  it("storage が null（localStorage が使えない）なら default", () => {
    expect(loadAccount(null)).toEqual(DEFAULT);
  });

  it("差し替えた storage から読める", () => {
    expect(loadAccount({ getItem: (key) => (key === ACCOUNT_KEY ? '{"avatarId":"default"}' : null) })).toEqual(DEFAULT);
  });
});

const thrower = () => {
  throw new Error("denied");
};
const stored = () => JSON.parse(localStorage.getItem(ACCOUNT_KEY) ?? "null");

describe("学年（TBL-001・D-144）", () => {
  it("grade が 1〜6 の整数ならそれを読む", () => {
    for (const grade of [1, 2, 3, 4, 5, 6]) {
      localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ avatarId: "default", grade }));
      expect(loadAccount().grade).toBe(grade);
    }
  });

  it("壊れた grade（0・7・2.5・文字列・null・無い）は古いキー、それも無ければ 6", () => {
    const broken = ['{"grade":0}', '{"grade":7}', '{"grade":2.5}', '{"grade":"3"}', '{"grade":null}', "{}"];
    for (const value of broken) {
      localStorage.setItem(ACCOUNT_KEY, value);
      expect(loadAccount().grade).toBe(6);
      localStorage.setItem(LEGACY_GRADE_KEY, "2");
      expect(loadAccount().grade).toBe(2);
      localStorage.removeItem(LEGACY_GRADE_KEY);
    }
  });

  it("古いキーが壊れていれば 6。アカウントの有効な grade が先", () => {
    for (const value of ["0", "7", "2.5", "abc", ""]) {
      localStorage.setItem(LEGACY_GRADE_KEY, value);
      expect(loadAccount().grade).toBe(6);
    }
    localStorage.setItem(LEGACY_GRADE_KEY, "2");
    localStorage.setItem(ACCOUNT_KEY, '{"grade":4}');
    expect(loadAccount().grade).toBe(4);
  });

  it("古いキーの取り込みはアカウントに書いて古いキーを消す", () => {
    localStorage.setItem(LEGACY_GRADE_KEY, "3");
    migrateLegacyGrade();
    expect(stored()).toEqual({ avatarId: "default", grade: 3 });
    expect(localStorage.getItem(LEGACY_GRADE_KEY)).toBeNull();
  });

  it("取り込みで avatarId を残す。壊れた grade も古いキーで直す", () => {
    localStorage.setItem(ACCOUNT_KEY, '{"avatarId":"default","grade":9}');
    localStorage.setItem(LEGACY_GRADE_KEY, "6");
    migrateLegacyGrade();
    expect(stored()).toEqual({ avatarId: "default", grade: 6 });
    expect(localStorage.getItem(LEGACY_GRADE_KEY)).toBeNull();
  });

  it("アカウントに有効な grade があれば、古いキーで上書きしない（古いキーも触らない）", () => {
    localStorage.setItem(ACCOUNT_KEY, '{"avatarId":"default","grade":4}');
    localStorage.setItem(LEGACY_GRADE_KEY, "2");
    migrateLegacyGrade();
    expect(stored()).toEqual({ avatarId: "default", grade: 4 });
    expect(localStorage.getItem(LEGACY_GRADE_KEY)).toBe("2");
  });

  it("古いキーが無い・壊れていれば何も書かない", () => {
    migrateLegacyGrade();
    expect(localStorage.getItem(ACCOUNT_KEY)).toBeNull();
    localStorage.setItem(LEGACY_GRADE_KEY, "7");
    migrateLegacyGrade();
    expect(localStorage.getItem(ACCOUNT_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_GRADE_KEY)).toBe("7");
  });

  it("saveAccountGrade は avatarId を残して grade を書く。保存が壊れていれば default", () => {
    saveAccountGrade(2);
    expect(stored()).toEqual({ avatarId: "default", grade: 2 });
    localStorage.setItem(ACCOUNT_KEY, '{"avatarId":"default","grade":1,"extra":1}');
    saveAccountGrade(6);
    expect(stored()).toEqual({ avatarId: "default", grade: 6 });
    localStorage.setItem(ACCOUNT_KEY, "{");
    saveAccountGrade(3);
    expect(stored()).toEqual({ avatarId: "default", grade: 3 });
    expect(loadAccount().grade).toBe(3);
  });

  it("storage が投げても投げない", () => {
    expect(() => saveAccountGrade(3, { getItem: () => null, setItem: thrower })).not.toThrow();
    expect(() => saveAccountGrade(3, { getItem: thrower, setItem: thrower })).not.toThrow();
    expect(() => saveAccountGrade(3, null)).not.toThrow();
    const all = { getItem: thrower, setItem: thrower, removeItem: thrower };
    expect(() => migrateLegacyGrade(all)).not.toThrow();
    expect(() => migrateLegacyGrade(null)).not.toThrow();
    expect(() => migrateLegacyGrade({ getItem: () => "3", setItem: thrower, removeItem: thrower })).not.toThrow();
    expect(loadAccount({ getItem: thrower }).grade).toBe(6);
  });
});

describe("起動時の学年（FR-012）", () => {
  it("本番の既定学年は VITE_DEFAULT_GRADE が有効な時だけ切り替わる", async () => {
    try {
      vi.stubEnv("VITE_DEFAULT_GRADE", "5");
      vi.resetModules();
      const configuredAccount = await import("./account");
      expect(configuredAccount.DEFAULT_GRADE).toBe(5);
      expect(configuredAccount.initialGrade(true)).toBe(5);

      vi.stubEnv("VITE_DEFAULT_GRADE", undefined);
      vi.resetModules();
      const defaultAccount = await import("./account");
      expect(defaultAccount.DEFAULT_GRADE).toBe(6);
      expect(defaultAccount.initialGrade(true)).toBe(6);
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });

  it("無効な VITE_DEFAULT_GRADE は 6 年に戻す", async () => {
    try {
      for (const value of ["0", "7", "2.5", "5.0", "05", " 5 ", "3年", ""]) {
        vi.stubEnv("VITE_DEFAULT_GRADE", value);
        vi.resetModules();
        const account = await import("./account");
        expect(account.DEFAULT_GRADE).toBe(6);
        expect(account.initialGrade(true)).toBe(6);
      }
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });

  it("本番は保存に grade:5 があっても 6 で、保存を書き換えない。古いキーも取り込まない", () => {
    const saved = JSON.stringify({ avatarId: "default", grade: 5 });
    localStorage.setItem(ACCOUNT_KEY, saved);
    localStorage.setItem(LEGACY_GRADE_KEY, "2");
    expect(initialGrade(true)).toBe(6);
    expect(localStorage.getItem(ACCOUNT_KEY)).toBe(saved);
    expect(localStorage.getItem(LEGACY_GRADE_KEY)).toBe("2");
  });

  it("開発中は保存の grade を読む。無ければ 6、古いキーだけなら取り込む", () => {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ avatarId: "default", grade: 5 }));
    expect(initialGrade(false)).toBe(5);
    localStorage.clear();
    expect(initialGrade(false)).toBe(6);
    localStorage.setItem(LEGACY_GRADE_KEY, "2");
    expect(initialGrade(false)).toBe(2);
  });

  it("引数を省くとテストは開発中扱い（import.meta.env.PROD は false）", () => {
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ avatarId: "default", grade: 4 }));
    expect(initialGrade()).toBe(4);
  });
});

describe("学年を書く時の写真", () => {
  it("saveAccountGrade は photo を残す", () => {
    const photo = { pose: "wave", face: "smile", bg: "grid", frame: "none", stamp: "none", gear: [] };
    localStorage.setItem(ACCOUNT_KEY, JSON.stringify({ avatarId: "default", grade: 5, photo }));
    saveAccountGrade(2);
    expect(JSON.parse(localStorage.getItem(ACCOUNT_KEY) ?? "")).toEqual({ avatarId: "default", grade: 2, photo });
  });

  it("photo が無ければ足さない", () => {
    saveAccountGrade(2);
    expect(JSON.parse(localStorage.getItem(ACCOUNT_KEY) ?? "")).toEqual({ avatarId: "default", grade: 2 });
  });
});

it("公開版も生徒が選んだ教材の学年を使い、仮アカウントの学年は保つ", () => {
  saveAccountGrade(5);
  saveLearningGrade(2);
  expect(initialGrade(true)).toBe(2);
  expect(loadAccount().grade).toBe(5);
});
