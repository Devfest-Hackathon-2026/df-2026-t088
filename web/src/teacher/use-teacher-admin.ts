import { createContext, useContext } from "react";

// 管理者として入っているか。TeacherGate が /teacher/me から取った値を下へ渡す。Gate の外では「管理者でない」（D-209）
export const TeacherAdminContext = createContext(false);

export const useTeacherIsAdmin = () => useContext(TeacherAdminContext);
