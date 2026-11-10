import { StudioPanel } from "../studio/StudioPanel";
import { useApproverKey } from "./approver-key";
import { STUDIO_COPY } from "./copy";
import { TeacherNav } from "./TeacherNav";
import "./AdminPages.css";
import "../studio/studio-teacher.css";

// 先生の画面の「教材をつくる」（SCR-T15、#374）。中身は /research/ の教材スタジオ（StudioPanel）を、先生向けの言葉（variant="teacher"）で使う。
// 研究デモの注意（StepNotice）は /research/ だけに残す
export function StudioPage() {
  // 承認キーは画面の上の行（TeacherApproverKey）で 1 回だけ入れる。学級に入っているときは Cookie で通る
  const key = useApproverKey();
  return (
    <main className="admin-page studio-page">
      <TeacherNav current="studio" />
      <h1 className="admin-page__title-hidden">{STUDIO_COPY.title}</h1>
      <StudioPanel variant="teacher" approverKey={key} />
    </main>
  );
}
