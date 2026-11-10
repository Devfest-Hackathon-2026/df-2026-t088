import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { DEFAULT_GRADE, initialGrade, saveAccountGrade } from "./account";
import type { Grade } from "./data/kanji-grades";
import { displayText } from "./ruby-text";

// 表示の学年（D-91、D-144）。仮アカウント（sugoroku:account）の grade で、「はじめからにする」では消さない
export { DEFAULT_GRADE };

interface GradeValue {
  grade: Grade;
  setGrade: (grade: Grade) => void;
}

const GradeContext = createContext<GradeValue | null>(null);

export function GradeProvider({ children }: { children: ReactNode }) {
  const [grade, setGradeState] = useState<Grade>(() => initialGrade());
  const setGrade = useCallback((next: Grade) => {
    setGradeState(next);
    saveAccountGrade(next);
  }, []);
  const value = useMemo(() => ({ grade, setGrade }), [grade, setGrade]);
  return <GradeContext.Provider value={value}>{children}</GradeContext.Provider>;
}

/** 表示の学年。Provider の外では null（漢字のまま出す） */
export function useGrade(): Grade | null {
  return useContext(GradeContext)?.grade ?? null;
}

/** 学年を選ぶ側（CMP-027 デバッグの学年）が使う。Provider の外では null */
export function useGradeControl(): GradeValue | null {
  return useContext(GradeContext);
}

/** `[語|よみ]` の文を、いまの学年の文字列にする関数。見える文も読み上げの名前もこれを通す */
export function useText(): (text: string) => string {
  const grade = useGrade();
  return useCallback((text: string) => displayText(text, grade), [grade]);
}
