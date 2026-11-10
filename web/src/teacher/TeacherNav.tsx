// 先生の画面の入口（学級のようす・課題・時間割・提出の状況）。どの画面にも同じ並びで出す
import { ADMIN_COPY, CLASS_COPY, MEMBERS_COPY, PROBLEM_ORDER_COPY, SUBMISSIONS_COPY } from "./copy";
import { useTeacherIsAdmin } from "./use-teacher-admin";
import { TeacherApproverKey } from "./approver-key";
import { TeacherWorkspaceBar } from "./WorkspaceBar";
import { useTeacherSession } from "./workspace";
import "./AdminPages.css";

export type TeacherView = "class" | "assignments" | "timetable" | "submissions" | "print" | "problem-order";

const ITEMS: { view: TeacherView; href: string; label: string }[] = [
  { view: "class", href: "?", label: CLASS_COPY.title },
  { view: "assignments", href: "?view=assignments", label: ADMIN_COPY.navAssignments },
  { view: "timetable", href: "?view=timetable", label: ADMIN_COPY.navTimetable },
  { view: "submissions", href: "?view=submissions", label: SUBMISSIONS_COPY.title },
  { view: "print", href: "?view=print", label: "プリントから説明をつくる" },
  { view: "problem-order", href: "?view=problem-order", label: PROBLEM_ORDER_COPY.title },
];

export function TeacherNav({ current }: { current: TeacherView }) {
  const { workspace } = useTeacherSession().session;
  // 先生の管理は、管理者として入っている時だけ出す（D-209）
  const admin = useTeacherIsAdmin();
  return (
    <div className="teacher-nav-row">
      <nav className="teacher-nav" aria-label={CLASS_COPY.title}>
        <ul>
          {ITEMS.map((item) => (
            <li key={item.view}>
              <a href={item.href} aria-current={item.view === current ? "page" : undefined}>
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {admin && (
        // 並びの右に別の枠で置く。狭い幅（768px）では、承認キーといっしょに 2 行目へ折り返す（D-209）
        <nav className="teacher-nav" aria-label={MEMBERS_COPY.title}>
          <ul>
            <li>
              <a href="?view=members">{MEMBERS_COPY.title}</a>
            </li>
          </ul>
        </nav>
      )}
      {workspace ? <TeacherWorkspaceBar workspace={workspace} /> : <TeacherApproverKey />}
    </div>
  );
}
