import { useCallback, useSyncExternalStore } from "react";
import { SUBJECTS } from "./data";
import type { SubjectId } from "./data";

const LESSON_PATH_PREFIX = "/sansu/lesson/";
const CHAPTER_PATH_PREFIX = "/sansu/";

// 道は6種類だけ。/ はログインの有無で /home か /login へ移す入口、/login はログイン（PG-009、D-145）。増える時はここに足す。
// /sansu は章をえらぶ（PG-004）、/sansu/{章の id} は盤面（PG-002）、/sansu/lesson/{マス} は学習（PG-003）、
// 算数以外の教科（生活を含む）は /{教科}（教科の島 PG-005）、/{教科}/{章の id}（盤面）、/{教科}/{章の id}/lesson/{マス}（学習）（D-119）
export type IslandSubjectId = Exclude<SubjectId, "sansu">;
export type LessonPath = `${typeof LESSON_PATH_PREFIX}${string}` | `/${IslandSubjectId}/${string}/lesson/${string}`;
export type ChapterPath = `${typeof CHAPTER_PATH_PREFIX}${string}` | `/${IslandSubjectId}/${string}`;
export type SubjectPath = `/${IslandSubjectId}`;
// /login はログイン画面（PG-009、D-145。#186 のスタート画面を置き換えた）。/home は島の地図（PG-001。D-250 で /map から戻した）、/home/assignments は提出物（PG-007）、
// /home/timetable は時間割（PG-008）、/home/print はプリントの撮影（PG-010、#233）。/map は道から外し、開くと知らない道として /home へ移す（D-250）
export type HomeSubPath = "/home/assignments" | "/home/timetable" | "/home/print" | "/home/handouts";
export type HandoutSharePath = `/home/handouts/${string}`;
export type JoinPath = `/join/${string}`;
export const PRACTICE_PATH = "/practice";
export type RoutePath = "/" | "/login" | "/home" | HomeSubPath | HandoutSharePath | JoinPath | typeof PRACTICE_PATH | "/sansu" | ChapterPath | LessonPath | SubjectPath;
const HOME_PATHS = new Set<string>(["/home/assignments", "/home/timetable", "/home/print", "/home/handouts"]);

/** ログインした後に開く道。島の地図（D-145、D-250） */
export const FIRST_SCREEN_PATH: RoutePath = "/home";

const ROUTE_CHANGE = "sugoroku:routechange";

// 道の形だけを見る。その学年に実施されない教科の道を /home へ移すのは App（FR-002）
const ISLAND_SUBJECT_IDS: readonly IslandSubjectId[] = SUBJECTS.filter((s) => s.id !== "sansu").map((s) => s.id as IslandSubjectId);
const ISLAND_ALTERNATIVES = ISLAND_SUBJECT_IDS.join("|");
const ISLAND_LESSON_PATTERN = new RegExp(`^/(?:${ISLAND_ALTERNATIVES})/[a-z0-9-]+/lesson/[a-z0-9-]+$`);
const ISLAND_CHAPTER_PATTERN = new RegExp(`^/(?:${ISLAND_ALTERNATIVES})/[a-z0-9-]+$`);

export const lessonPath = (key: string): LessonPath => `${LESSON_PATH_PREFIX}${key}`;
/** 算数以外の教科の学習の道。教科を省くと国語 */
export const courseLessonPath = (chapterId: string, key: string, subjectId: SubjectId = "kokugo"): LessonPath => `/${subjectId}/${chapterId}/lesson/${key}` as LessonPath;

export const isLessonPath = (path: string): path is LessonPath => /^\/sansu\/lesson\/[a-z0-9-]+$/.test(path)
  || ISLAND_LESSON_PATTERN.test(path);

const SUBJECT_PATHS = new Set<string>(ISLAND_SUBJECT_IDS.map((id) => `/${id}`));

export const isSubjectPath = (path: string): path is SubjectPath => SUBJECT_PATHS.has(path);

/** 教科の島の道から、教科を取り出す */
export const subjectOfPath = (path: SubjectPath): IslandSubjectId => path.slice(1) as IslandSubjectId;

/** 道のどれからでも、教科を取り出す。/home、/home/… は undefined */
export const subjectOfRoute = (path: string): SubjectId | undefined => {
  const first = path.split("/")[1];
  return first === "sansu" || ISLAND_SUBJECT_IDS.includes(first as IslandSubjectId) ? first as SubjectId : undefined;
};

/** 島を選んだ後に開く道。算数は章をえらぶ（PG-004）、ほかは教科の島（PG-005） */
export const pathOfSubject = (id: SubjectId): RoutePath => (id === "sansu" ? "/sansu" : `/${id}`);

/** 学習の道から、学習の名前を取り出す */
export const lessonKeyOf = (path: LessonPath): string => path.includes("/lesson/")
  ? path.slice(path.lastIndexOf("/lesson/") + "/lesson/".length)
  : path.slice(LESSON_PATH_PREFIX.length);
/** 算数以外の学習の道から、章の id を取り出す。算数の学習の道は章を持たないので undefined */
export const lessonChapterIdOf = (path: LessonPath): string | undefined => path.startsWith(LESSON_PATH_PREFIX)
  ? undefined
  : path.split("/")[2];

export const chapterPath = (chapterId: string, subjectId: SubjectId = "sansu"): ChapterPath =>
  (subjectId === "sansu" ? `${CHAPTER_PATH_PREFIX}${chapterId}` : `/${subjectId}/${chapterId}`) as ChapterPath;
export const courseChapterPath = (chapterId: string, subjectId: SubjectId): ChapterPath => chapterPath(chapterId, subjectId);

// 形だけを見る。知らない章や鍵の章を章えらびへ送り直すのは App（D-100）。学習の道は章の道より先に分ける
export const isChapterPath = (path: string): path is ChapterPath => (
  !isLessonPath(path) && (/^\/sansu\/[a-z0-9-]+$/.test(path) && path !== "/sansu/lesson"
    || ISLAND_CHAPTER_PATTERN.test(path))
);

/** 章の道から、章の id を取り出す */
export const chapterIdOf = (path: ChapterPath): string => path.split("/")[2] as string;

export function toRoutePath(pathname: string): RoutePath {
  return pathname === "/" || pathname === "/login" || pathname === "/sansu" || pathname === PRACTICE_PATH || HOME_PATHS.has(pathname) || isHandoutSharePath(pathname) || isJoinPath(pathname) || isLessonPath(pathname) || isChapterPath(pathname) || isSubjectPath(pathname)
    ? pathname as RoutePath
    : "/home";
}

/** 共有リンクの説明の道。説明 ID は UUID の英小文字・数字・ハイフン */
export const isHandoutSharePath = (path: string): path is HandoutSharePath => /^\/home\/handouts\/[a-z0-9-]+$/.test(path);

/** 学級コードで開く道（/join/{code}）。ログインしていなくても開ける。コードは英数字 6 文字だが、形は server が決めるので、ここでは英数字だけを見る */
export const isJoinPath = (path: string): path is JoinPath => /^\/join\/[A-Za-z0-9]{1,32}$/.test(path);

/** 学級コードの道から学級コードを取り出す */
export const joinCodeOf = (path: JoinPath): string => path.slice("/join/".length);

/** 共有リンクの道から説明 ID を取り出す */
export const handoutIdOf = (path: HandoutSharePath): string => path.slice("/home/handouts/".length);

function subscribe(onChange: () => void): () => void {
  window.addEventListener("popstate", onChange);
  window.addEventListener(ROUTE_CHANGE, onChange);
  return () => {
    window.removeEventListener("popstate", onChange);
    window.removeEventListener(ROUTE_CHANGE, onChange);
  };
}

const getSnapshot = (): RoutePath => toRoutePath(window.location.pathname);

/** 部品の外（lesson-gateway）からも移れるように、フックの外に置く */
export function pushRoute(to: RoutePath): void {
  if (to === getSnapshot()) return;
  window.history.pushState(null, "", to);
  window.dispatchEvent(new Event(ROUTE_CHANGE));
}

export function useRoute() {
  const path = useSyncExternalStore(subscribe, getSnapshot);

  const navigate = useCallback((to: RoutePath) => pushRoute(to), []);

  // 戻るボタンで戻れない場所へ送る時に使う（記録が無いのに /sansu を開いた時など）
  const replace = useCallback((to: RoutePath) => {
    window.history.replaceState(null, "", to);
    window.dispatchEvent(new Event(ROUTE_CHANGE));
  }, []);

  return { path, navigate, replace };
}

/** 開いた時の道。/ と /login は App がログインの有無で /home か /login へ振り分ける（D-145）。算数を選んだ記録があれば、盤面や学習で読み直した時はそのまま。
 * 算数以外の教科の道（教科の島・盤面・学習）は記録が要らないので、読み直してもそのまま。
 * その学年に実施されない教科の道は、学年が分かる App が /home へ移す。知らない道は /home */
export function resolveInitialPath(sansuSelected: boolean, pathname = "/home"): RoutePath {
  const route = toRoutePath(pathname);
  if (route === "/" || route === "/login" || route === "/home") return route;
  return subjectOfRoute(route) !== "sansu" || sansuSelected ? route : "/home";
}
