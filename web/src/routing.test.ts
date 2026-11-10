import { describe, expect, it } from "vitest";
import {
  chapterIdOf, chapterPath, courseChapterPath, courseLessonPath, handoutIdOf, isChapterPath, isHandoutSharePath, isJoinPath, joinCodeOf, isLessonPath, isSubjectPath, lessonChapterIdOf, lessonKeyOf, pathOfSubject, FIRST_SCREEN_PATH, resolveInitialPath, subjectOfPath, subjectOfRoute, toRoutePath,
} from "./routing";

describe("toRoutePath", () => {
  it("/home と /sansu と章の道と学習の道を通す", () => {
    expect(toRoutePath("/home")).toBe("/home");
    expect(toRoutePath("/sansu")).toBe("/sansu");
    expect(toRoutePath("/sansu/fraction")).toBe("/sansu/fraction");
    expect(toRoutePath("/sansu/lesson/main-3")).toBe("/sansu/lesson/main-3");
  });

  it("/ はログインの有無で振り分ける入口、/login はログイン画面の道（PG-009、D-145）", () => {
    expect(toRoutePath("/")).toBe("/");
    expect(toRoutePath("/login")).toBe("/login");
    expect(toRoutePath("/login/x")).toBe("/home");
    expect(subjectOfRoute("/login")).toBeUndefined();
    expect(resolveInitialPath(false, "/login")).toBe("/login");
  });

  it("ファーストディスプレイの下の画面と島の地図の道を通す（D-135、D-136）", () => {
    // /map は D-250 で道から外した。知らない道と同じく /home
    expect(toRoutePath("/map")).toBe("/home");
    expect(toRoutePath("/home/assignments")).toBe("/home/assignments");
    expect(toRoutePath("/home/timetable")).toBe("/home/timetable");
    expect(toRoutePath("/home/print")).toBe("/home/print");
    expect(toRoutePath("/home/handouts")).toBe("/home/handouts");
    expect(toRoutePath("/home/handouts/h-1")).toBe("/home/handouts/h-1");
    expect(isHandoutSharePath("/home/handouts/h-1")).toBe(true);
    expect(handoutIdOf("/home/handouts/h-1")).toBe("h-1");
    for (const bad of ["/home/other", "/home/assignments/x", "/home/print/x", "/home/handouts/a/b", "/home/handouts/UPPER", "/map/x"]) expect(toRoutePath(bad)).toBe("/home");
    expect(subjectOfRoute("/map")).toBeUndefined();
    expect(subjectOfRoute("/home/timetable")).toBeUndefined();
    expect(subjectOfRoute("/home/print")).toBeUndefined();
    expect(resolveInitialPath(false, "/map")).toBe("/home");
    expect(resolveInitialPath(false, "/home/assignments")).toBe("/home/assignments");
  });

  it("学級コードの道（/join/{code}）を通し、コードを取り出す", () => {
    expect(toRoutePath("/join/AB23CD")).toBe("/join/AB23CD");
    expect(isJoinPath("/join/AB23CD")).toBe(true);
    expect(joinCodeOf("/join/AB23CD")).toBe("AB23CD");
    expect(resolveInitialPath(false, "/join/AB23CD")).toBe("/join/AB23CD");
    for (const bad of ["/join", "/join/", "/join/a/b", "/join/a-b", "/join/%E3%81%82"]) expect(toRoutePath(bad)).toBe("/home");
  });

  it("形が違う道は /home にする", () => {
    for (const bad of ["/sansu/Fraction!", "/sansu/a/b", "/sansu/lesson", "/sansu/lesson/A", "/other"]) {
      expect(toRoutePath(bad)).toBe("/home");
    }
  });

  it("学習の道は章の道ではない", () => {
    expect(isLessonPath("/sansu/lesson/xxx")).toBe(true);
    expect(isChapterPath("/sansu/lesson/xxx")).toBe(false);
    expect(isChapterPath("/sansu/fraction")).toBe(true);
  });

  it("章の id を取り出せる", () => {
    expect(chapterIdOf(chapterPath("fraction"))).toBe("fraction");
  });

  it("算数と国語の道をそれぞれ認識する", () => {
    expect(courseChapterPath("kokugo-kanji-5", "kokugo")).toBe("/kokugo/kokugo-kanji-5");
    expect(courseLessonPath("kokugo-kanji-5", "main-0")).toBe("/kokugo/kokugo-kanji-5/lesson/main-0");
    expect(toRoutePath("/kokugo/kokugo-kanji-5")).toBe("/kokugo/kokugo-kanji-5");
    expect(toRoutePath("/kokugo/kokugo-kanji-5/lesson/main-0")).toBe("/kokugo/kokugo-kanji-5/lesson/main-0");
    expect(chapterIdOf(courseChapterPath("kokugo-kanji-5", "kokugo"))).toBe("kokugo-kanji-5");
    expect(lessonKeyOf(courseLessonPath("kokugo-kanji-5", "main-0"))).toBe("main-0");
    expect(lessonChapterIdOf(courseLessonPath("kokugo-kanji-5", "main-0"))).toBe("kokugo-kanji-5");
    expect(isChapterPath("/kokugo/kokugo-kanji-5/lesson/main-0")).toBe(false);
    expect(isLessonPath("/kokugo/kokugo-kanji-5/lesson/main-0")).toBe(true);
  });
});

describe("resolveInitialPath", () => {
  it("記録が無ければ /home（/ と /login は App が振り分ける）", () => {
    expect(resolveInitialPath(false, "/sansu/fraction")).toBe("/home");
    expect(resolveInitialPath(false, "/")).toBe("/");
    expect(resolveInitialPath(false)).toBe("/home");
  });

  it("記録があれば開いた道のまま", () => {
    expect(resolveInitialPath(true, "/sansu")).toBe("/sansu");
    expect(resolveInitialPath(true, "/sansu/lesson/main-3")).toBe("/sansu/lesson/main-3");
    expect(resolveInitialPath(true, "/sansu/fraction")).toBe("/sansu/fraction");
    expect(resolveInitialPath(true, "/zzz")).toBe("/home");
    expect(resolveInitialPath(true, "/")).toBe("/");
    expect(resolveInitialPath(true)).toBe("/home");
  });
});

describe("教科の島の道（D-91、D-119）", () => {
  it("算数以外のどの教科（生活を含む）も教科の島の道にする", () => {
    for (const id of ["kokugo", "rika", "shakai", "eigo", "ongaku", "taiiku", "zuko", "katei", "seikatsu"] as const) {
      expect(isSubjectPath(`/${id}`)).toBe(true);
      expect(toRoutePath(`/${id}`)).toBe(`/${id}`);
      expect(pathOfSubject(id)).toBe(`/${id}`);
      expect(subjectOfPath(`/${id}`)).toBe(id);
      expect(subjectOfRoute(`/${id}`)).toBe(id);
    }
  });

  it("道の形は学年を見ない。実施されない教科の道を /home へ移すのは App（FR-002）", () => {
    expect(toRoutePath("/seikatsu")).toBe("/seikatsu");
    expect(resolveInitialPath(true, "/rika")).toBe("/rika");
  });

  it("算数以外のどの教科も、章の道と学習の道を持つ", () => {
    for (const id of ["rika", "seikatsu"] as const) {
      expect(courseChapterPath(`${id}-3-01`, id)).toBe(`/${id}/${id}-3-01`);
      expect(courseLessonPath(`${id}-3-01`, "main-0", id)).toBe(`/${id}/${id}-3-01/lesson/main-0`);
      expect(toRoutePath(`/${id}/${id}-3-01`)).toBe(`/${id}/${id}-3-01`);
      expect(toRoutePath(`/${id}/${id}-3-01/lesson/main-0`)).toBe(`/${id}/${id}-3-01/lesson/main-0`);
      expect(isChapterPath(`/${id}/${id}-3-01`)).toBe(true);
      expect(isLessonPath(`/${id}/${id}-3-01`)).toBe(false);
      expect(isChapterPath(`/${id}/${id}-3-01/lesson/main-0`)).toBe(false);
      expect(isLessonPath(`/${id}/${id}-3-01/lesson/main-0`)).toBe(true);
      expect(chapterIdOf(courseChapterPath(`${id}-3-01`, id))).toBe(`${id}-3-01`);
      expect(lessonChapterIdOf(courseLessonPath(`${id}-3-01`, "test", id))).toBe(`${id}-3-01`);
      expect(lessonKeyOf(courseLessonPath(`${id}-3-01`, "test", id))).toBe("test");
      expect(subjectOfRoute(`/${id}/${id}-3-01/lesson/test`)).toBe(id);
    }
    expect(subjectOfRoute("/sansu/lesson/main-0")).toBe("sansu");
    expect(subjectOfRoute("/home")).toBeUndefined();
    expect(lessonChapterIdOf("/sansu/lesson/main-0")).toBeUndefined();
  });

  it("知らない教科や形の違う道は /home にする", () => {
    for (const bad of ["/nanika/x", "/rika/A", "/rika/a/b", "/rika/a/lesson", "/rika/a/lesson/B", "/rika/a/lesson/b/c"]) {
      expect(toRoutePath(bad)).toBe("/home");
    }
  });

  it("算数と知らない道は教科の島の道にしない", () => {
    expect(isSubjectPath("/sansu")).toBe(false);
    expect(isSubjectPath("/nanika")).toBe(false);
    expect(toRoutePath("/nanika")).toBe("/home");
    expect(pathOfSubject("sansu")).toBe("/sansu");
  });

  it("教科の島で読み直すと、算数を選んだ記録が無くてもそのまま", () => {
    expect(resolveInitialPath(false, "/kokugo")).toBe("/kokugo");
    expect(resolveInitialPath(false, "/rika/rika-3-01")).toBe("/rika/rika-3-01");
    expect(resolveInitialPath(false, "/seikatsu")).toBe("/seikatsu");
    expect(resolveInitialPath(false, "/sansu")).toBe("/home");
    expect(resolveInitialPath(false, "/kokugo/kokugo-kanji-5")).toBe("/kokugo/kokugo-kanji-5");
    expect(resolveInitialPath(false, "/kokugo/kokugo-kanji-5/lesson/main-0")).toBe("/kokugo/kokugo-kanji-5/lesson/main-0");
  });
});

describe("FIRST_SCREEN_PATH", () => {
  it("今は島の地図", () => {
    expect(FIRST_SCREEN_PATH).toBe("/home");
  });
});
