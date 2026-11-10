import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, LazyExoticComponent } from "react";
import { flushSync } from "react-dom";
import { useBgm } from "./audio/use-bgm";
import { CornerControls } from "./components/CornerControls";
import { Toast } from "./components/Toast";
import { COPY } from "./copy";
import { AccountPanel } from "./pages/home/AccountPanel";
import { DEFAULT_GRADE, GradeProvider, useGrade } from "./grade";
import { useGame } from "./game/use-game";
import { IslandMapPage } from "./pages/island-map/IslandMapPage";
import { BoardPage } from "./pages/board/BoardPage";
import { SharedPracticePage, TileLessonPage } from "./pages/lesson/TileLessonPage";
import { QuizLessonPage } from "./pages/lesson/QuizLessonPage";
import { LoginPage } from "./pages/login/LoginPage";
import { useLoggedIn } from "./login";
import { SubjectIslandPage } from "./pages/subject-island/SubjectIslandPage";
import { HomeEntries } from "./pages/home/HomeEntries";
import { AssignmentsPage } from "./pages/home/AssignmentsPage";
import { TimetablePage } from "./pages/home/TimetablePage";
import { PrintPage } from "./pages/print/PrintPage";
import { HandoutPage } from "./pages/print/HandoutPage";
import { printReadIsReal } from "./pages/print/api";
import { chaptersOf, shownSubjectsOf } from "./data";
import type { Chapter, SubjectId } from "./data";
import type { Grade } from "./data/kanji-grades";
import { KOKUGO_COURSE, findKokugoLesson } from "./lesson/kokugo-lessons";
import { findLesson } from "./lesson/fraction-lessons";
import { initPlanOverrides } from "./lesson/plan-source";
import { useCourseGame } from "./game/course";
import type { Course } from "./game/course";
import { releaseBoot } from "./loading";
import { focusPageHeading } from "./focus-heading";
import { playBackFade, playBackWave } from "./back-wave/back-wave";
import { BackWave } from "./back-wave/BackWave";
import { areaOf, type MapArea } from "./pages/island-map/diorama/layout";
import { hasWebGL2, loadDioramaScene, reducesMotion } from "./pages/island-map/diorama/use-diorama";
import {
  chapterIdOf, handoutIdOf, isChapterPath, isHandoutSharePath, isJoinPath, joinCodeOf, isLessonPath, isSubjectPath, lessonChapterIdOf, lessonKeyOf, pathOfSubject, PRACTICE_PATH, subjectOfPath, subjectOfRoute, toRoutePath, useRoute,
} from "./routing";
import type { IslandSubjectId } from "./routing";

// CMP-027 デバッグの学年。開発中だけ。本番のビルドに入れないため、DEV の分岐の中で lazy に読む（静的な import にしない）
// 読む時に DEV を見るので、テストが vi.stubEnv で切り替えられる。lazy の部品は1度だけ作る
let debugGrade: LazyExoticComponent<ComponentType> | undefined;
function debugGradeComponent() {
  if (!import.meta.env.DEV) return undefined;
  debugGrade ??= lazy(() => import("./components/DebugGrade"));
  return debugGrade;
}

// 問題がある算数以外の章は、今は5年国語の漢字の章だけ。ほかの章は「じゅんび中」（FR-006）
const KANJI_CHAPTER_ID = "kokugo-kanji-5";

export function App() {
  // 学年は App の中身が読む。テストは <App /> をそのまま描くので、Provider はここに置く
  const DebugGrade = debugGradeComponent();
  return (
    <GradeProvider>
      <AppBody />
      {DebugGrade && <Suspense fallback={null}><DebugGrade /></Suspense>}
    </GradeProvider>
  );
}

/** 今の学年と道の教科から作る課程。章は chaptersOf、問題があるのは国語の漢字の章だけ */
function courseOf(grade: Grade, subjectId: SubjectId): Course {
  return {
    subjectId,
    chapters: chaptersOf(grade, subjectId),
    hasLesson: (chapterId, target) => chapterId === KANJI_CHAPTER_ID && KOKUGO_COURSE.hasLesson(chapterId, target),
  };
}

function AppBody() {
  const grade = useGrade() ?? DEFAULT_GRADE;
  const game = useGame();
  // 先生の出題表の差し込み口を起動の時に1回読む。今は何も差し込まないので、読み終えても画面は変わらない（09_api.md）
  useEffect(() => { void initPlanOverrides(); }, []);
  const { path, navigate, replace } = useRoute();
  const loggedIn = useLoggedIn();
  // CMP-028 アカウントのパネルはアプリに1つ。右上の顔（CMP-043）から開く（D-245）。ログアウトしたら閉じる
  const [accountOpen, setAccountOpen] = useState(false);
  useEffect(() => { if (!loggedIn) setAccountOpen(false); }, [loggedIn]);
  // 知らない URL（/foo、/sansu/nope）は理由を言わずに /home へ戻る。戻したあとに、そのページが無いと 1 回だけ知らせる（#377）
  const checkedOpenPath = useRef(false);
  useEffect(() => {
    if (checkedOpenPath.current) return;
    checkedOpenPath.current = true;
    const requested = window.location.pathname;
    if (toRoutePath(requested) === requested) return;
    replace("/home");
    game.showToast(COPY.CP_1279);
  }, [replace, game.showToast]);
  const subjects = shownSubjectsOf(grade);
  const routeSubject = subjectOfRoute(path);
  // 今の学年で出さない教科（実施されない教科、算数・理科以外）の道は /home へ移す（FR-002、FR-011）
  const subjectOffered = routeSubject === undefined || subjects.includes(routeSubject);
  const islandSubject: IslandSubjectId | undefined = routeSubject !== undefined && routeSubject !== "sansu" ? routeSubject : undefined;
  const isIslandPath = islandSubject !== undefined && subjectOffered && chaptersOf(grade, islandSubject).length > 0;
  // フックの数を変えないため、算数以外の島の道でなくても課程は1つ作る（その時は使わない）
  const courseSubject: IslandSubjectId = isIslandPath ? islandSubject : "kokugo";
  const course = useMemo(() => courseOf(grade, courseSubject), [grade, courseSubject]);
  const routeChapterId = isLessonPath(path) ? lessonChapterIdOf(path) : isChapterPath(path) ? chapterIdOf(path) : undefined;
  const courseGame = useCourseGame(game, course, (isIslandPath ? routeChapterId : undefined) ?? "");
  // 島の地図と盤面は明るい曲、学習は静かな曲（D-87）
  useBgm(path);
  // 「教科をえらぶ」で戻った島の場所。高原の島からなら高原の全景から始める（D-91）。島へ入ると海に戻す
  const [startArea, setStartArea] = useState<MapArea>("sea");
  // 戻った島。島の地図ではアバターをこの島に立たせる
  const [mapFrom, setMapFrom] = useState<SubjectId>("sansu");
  // 波で開いた島の地図か。波の裏で3Dの準備を待つので、CMP-012 は出さない（D-141）。島へ入る時とブラウザの戻るでは false
  const [viaWave, setViaWave] = useState(false);
  // MOT-024：波が覆った時に島の地図へ移る（D-103）。波が覆った直後の1フレームで「待つか」が決まるので、
  // flushSync で島の地図を描き、layout effect まで走らせてから返る。覆ったままの波は、3D ができるまで待つ（D-141）
  const openMap = (from: SubjectId) => playBackWave(() => {
    flushSync(() => {
      setStartArea(areaOf(from));
      setMapFrom(from);
      setViaWave(true);
      navigate("/home");
    });
  }, undefined, { waitForRelease: true });
  // MOT-024：「← ホーム」。/home は島の地図なので（D-250）、openMap と同じく覆ったまま 3D を待つ（D-141）。島の場所とアバターの島は変えない。
  // 引き終わったら押して出てきた入口（「出すもの」かカメラ）に focus を置く（06_motion「順番」）。入口が無い画面（時間割・説明）からは、
  // 道が変わった時の focusPageHeading が地図の main へ置く。動きを減らす設定では覆った直後に onDone が来るので、flushSync で地図を描いてから置く
  const goHome = (entry: "assignments" | "timetable" | "print" | "handouts") => playBackWave(() => {
    flushSync(() => {
      setViaWave(true);
      navigate("/home");
    });
  }, () => document.querySelector<HTMLElement>(`[data-home-entry="${entry}"]`)?.focus(), { waitForRelease: true });
  // 島の地図を離れたら戻す。次にブラウザの戻るで開いた時は CMP-012 を出す
  useEffect(() => {
    if (path !== "/home") setViaWave(false);
  }, [path]);

  // 画面を移ったら、その画面の見出しへフォーカスを移す（#371）。最初の読み込みと、ログインの振り分け前（/）では動かさない
  const lastPath = useRef(path);
  useEffect(() => {
    const before = lastPath.current;
    lastPath.current = path;
    if (before === path || before === "/" || path === "/") return;
    return focusPageHeading();
  }, [path]);

  // 起動の分の保持を外す。子の effect が先に走るので、保持する画面はその前に hold 済み
  useEffect(() => { releaseBoot(); }, []);

  // 起動の後、手が空いた時に3Dの読み込みを先に始める（D-143）。動きを減らす設定と WebGL2 なしでは読まない
  useEffect(() => {
    const start = () => {
      if (!reducesMotion() && hasWebGL2()) void loadDioramaScene();
    };
    if (typeof requestIdleCallback === "function") {
      const id = requestIdleCallback(start);
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(start, 1500);
    return () => clearTimeout(id);
  }, []);

  // 実施されない教科の道は /home へ（アドレスを直に開いた時と、学年を変えた時）
  useEffect(() => {
    if (!subjectOffered) replace("/home");
  }, [subjectOffered, replace]);

  // 学年を変えた時：今の画面の教科が新しい学年にあれば、その教科の章えらびへ（FR-002）。/home は動かさない。
  // 最初の描画では動かさない（アドレスで開いた章や学習の道を、そのまま開くため）
  const lastGrade = useRef(grade);
  useEffect(() => {
    if (lastGrade.current === grade) return;
    lastGrade.current = grade;
    if (routeSubject !== undefined && subjects.includes(routeSubject)) replace(pathOfSubject(routeSubject));
    // 学年を変えた時だけ動かす。道の教科が替わるたびには動かさない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grade]);

  // 算数を選んだ記録が無いのに /sansu 以下を開いた時は島の地図（/home）へ送る。算数以外の教科の道は記録が要らない
  const needsMap = routeSubject === "sansu" && !game.state.sansuSelected;
  useEffect(() => {
    if (needsMap) replace("/home");
  }, [needsMap, replace]);

  // 章の道：知らない章・別の学年の章・鍵の章（問題の無い章。D-133）は、その教科の島へ送る（D-100、C-16）
  const chapters: readonly Chapter[] = isIslandPath ? course.chapters : game.chapters;
  const routeChapter = routeChapterId === undefined ? undefined : chapters.find((chapter) => chapter.id === routeChapterId);
  const chapterUsable = routeChapter !== undefined && (isIslandPath ? courseGame.isChapterOpen(routeChapter) : game.isChapterOpen(routeChapter));
  const chapterMismatch = chapterUsable && !isIslandPath && game.state.chapterId !== routeChapter.id;
  const subjectHome = routeSubject === undefined ? "/home" : pathOfSubject(routeSubject);
  useEffect(() => {
    if (needsMap || !subjectOffered || routeChapterId === undefined) return;
    if (!chapterUsable) replace(subjectHome);
    else if (chapterMismatch) game.selectChapter(routeChapterId);
    // 歩いている間は selectChapter が断るので、歩き終えた時にもう一度そろえる
  }, [needsMap, subjectOffered, routeChapterId, chapterUsable, chapterMismatch, subjectHome, replace, game.selectChapter, game.isBusy]);

  // 学習の道：その章に問題が無ければ（鍵の章）、教科の島へ戻す（D-133）。算数の学習の道は章を持たないので、今の章で調べる。
  // 算数以外の学習の道は章を持つので、上の章の道と同じく chapterUsable で島へ戻る
  const sansuLessonWithoutProblems = !needsMap && routeSubject === "sansu" && isLessonPath(path) && !game.hasLessonsInChapter(game.chapter.id);
  useEffect(() => {
    if (sansuLessonWithoutProblems) replace("/sansu");
  }, [sansuLessonWithoutProblems, replace]);

  // ログインの有無で道を振り分ける（D-145、D-146）。ほかの effect が道を直した時も、ここが最後に勝つよう最後に置く。
  // ログイン後は元の道へ戻さず /home から。ログアウトで未ログインになった時も /login へ
  useEffect(() => {
    if (loggedIn) {
      if (path === "/" || path === "/login") replace("/home");
    } else if (path !== "/login" && path !== PRACTICE_PATH && !isHandoutSharePath(path) && !isJoinPath(path)) {
      replace("/login");
    }
  }, [loggedIn, path, replace]);

  return (
    <>
      {renderPage()}
      {/* CMP-043：音と顔を1組だけ置く。ログインの前は音だけ（D-245、D-246）。先生の画面は App の外 */}
      <CornerControls onOpenAccount={loggedIn ? () => setAccountOpen(true) : undefined} />
      {loggedIn && <AccountPanel open={accountOpen} onClose={() => setAccountOpen(false)} game={game} showToast={game.showToast} />}
      <BackWave />
      <Toast toast={game.toast} />
    </>
  );

  function renderPage() {
    if (path === PRACTICE_PATH) return <SharedPracticePage onExit={() => replace("/home")} />;
    // ログイン画面は 3D も学年の教科も待たない（D-139）。未ログインではほかの画面を一瞬も出さない（上の effect が /login へ移す）
    if (isHandoutSharePath(path)) return <HandoutPage handoutId={handoutIdOf(path)} onGoHome={loggedIn ? () => goHome("handouts") : undefined} />;
    if (isJoinPath(path)) return <HandoutPage classCode={joinCodeOf(path)} onGoHome={loggedIn ? () => goHome("handouts") : undefined} />;
    if (!loggedIn) return path === "/login" ? <LoginPage onLoggedIn={() => replace("/home")} /> : null;
    if (path === "/" || path === "/login") return null;
    // 島の地図（PG-001、/home。D-250）と、その下の提出物（PG-007）・時間割（PG-008）。D-136。
    // 実施されない教科の道と、記録の無い /sansu 以下は、effect が /home へ移すまで地図を出す
    // /home/print は、本物の読み取りの build でだけ開く（#281）。違えば、地図を出す
    if (path === "/home" || !subjectOffered || needsMap || (path === "/home/print" && !printReadIsReal())) {
      return (
        <IslandMapPage
          game={game}
          startArea={startArea}
          startSubject={mapFrom}
          viaWave={viaWave}
          onEnter={(id) => { setStartArea("sea"); navigate(pathOfSubject(id)); }}
          bar={<HomeEntries onOpen={navigate} showToast={game.showToast} />}
        />
      );
    }
    if (path === "/home/assignments") return <AssignmentsPage onGoHome={() => goHome("assignments")} showToast={game.showToast} />;
    if (path === "/home/timetable") return <TimetablePage onGoHome={() => goHome("timetable")} showToast={game.showToast} />;
    if (path === "/home/print") return <PrintPage onGoHome={() => goHome("print")} />;
    if (path === "/home/handouts") return <HandoutPage onGoHome={() => goHome("handouts")} />;
    if (isSubjectPath(path)) {
      const subjectId = subjectOfPath(path);
      return <SubjectIslandPage subjectId={subjectId} course={course} game={courseGame} onOpenChapter={(chapter) => courseGame.openChapter(chapter.id)} onOpenMap={() => openMap(subjectId)} />;
    }
    // 算数もほかの教科と同じ教科の島で章を選ぶ（D-130）。すごろくの道の章えらび（pages/chapter-map の ChapterMapPage）は退避して、画面からは使わない
    if (path === "/sansu") {
      const sansuCourse: Course = { subjectId: "sansu", chapters: game.chapters, hasLesson: (chapterId, target) => findLesson(chapterId, target) !== undefined };
      return <SubjectIslandPage subjectId="sansu" course={sansuCourse} game={game} onOpenChapter={(chapter) => game.openChapter(chapter.id)} onOpenMap={() => openMap("sansu")} />;
    }
    if (isLessonPath(path) && isIslandPath) {
      if (!chapterUsable) return null;
      const key = lessonKeyOf(path);
      return <QuizLessonPage key={path} game={courseGame} lessonKey={key} lesson={findKokugoLesson(courseGame.chapter.id, key)} />;
    }
    if (isLessonPath(path)) return sansuLessonWithoutProblems ? null : <TileLessonPage key={path} game={game} lessonKey={lessonKeyOf(path)} />;
    // 保存の章がそろうまでは、前の章の盤面を一瞬も出さない
    if (!chapterUsable || chapterMismatch) return null;
    if (isIslandPath) {
      return <BoardPage game={courseGame} showIntro={false} onOpenChapters={() => playBackFade(() => navigate(pathOfSubject(courseSubject)))} />;
    }
    return <BoardPage game={game} onOpenChapters={() => playBackFade(() => navigate("/sansu"))} />;
  }
}
