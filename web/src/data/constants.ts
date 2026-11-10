import type { Equipment, SideType, SideTypeInfo, Subject, SubjectId } from "./types";

// 経験値、レベル、報酬、開始時の値は仮。XP_PER_AVATAR_LEVEL と見本の値は、
// 3マスほど進むと装備が増えるように置いた

// 教科の一覧。島の地図に出す教科は shownSubjectsOf（学年の教科と算数・理科の重なり）が決め、出す島はどれも開く（FR-002、FR-011、D-117）
export const SUBJECTS: Subject[] = [
  { id: "kokugo", name: "[国語|こくご]", color: "var(--color-subject-kokugo)" },
  { id: "sansu", name: "[算数|さんすう]", color: "var(--color-subject-sansu)" },
  { id: "rika", name: "[理科|りか]", color: "var(--color-subject-rika)" },
  { id: "shakai", name: "[社会|しゃかい]", color: "var(--color-subject-shakai)" },
  { id: "eigo", name: "[英語|えいご]", color: "var(--color-subject-eigo)" },
  { id: "ongaku", name: "[音楽|おんがく]", color: "var(--color-subject-ongaku)" },
  { id: "taiiku", name: "[体育|たいいく]", color: "var(--color-subject-taiiku)" },
  { id: "zuko", name: "[図工|ずこう]", color: "var(--color-subject-zuko)" },
  { id: "katei", name: "[家庭|かてい]", color: "var(--color-subject-katei)" },
  // 生活は 1・2年だけ。島の並びを動かさないよう末尾に置く
  { id: "seikatsu", name: "[生活|せいかつ]", color: "var(--color-subject-seikatsu)" },
];

/** 島の地図で、海ではなく右奥の高原に置く教科（D-57）。古い保存には経験値が無い */
export const HIGHLAND_SUBJECTS: readonly SubjectId[] = ["ongaku", "taiiku", "zuko", "katei"];

/** 後から足した教科。古い保存には経験値が無い（高原の教科は D-57、生活は D-120） */
export const LATE_SUBJECTS: readonly SubjectId[] = [...HIGHLAND_SUBJECTS, "seikatsu"];

export const REWARD = { main: 20, training: 30, advanced: 40, test: 100 } as const;
export const XP_PER_SUBJECT_LEVEL = 100;
export const XP_PER_AVATAR_LEVEL = 200;

export const EQUIPMENT: Equipment[] = [
  { level: 3, id: "pencil", name: "えんぴつのつえ" },
  { level: 6, id: "hat", name: "ぼうし" },
  { level: 10, id: "cape", name: "マント" },
  { level: 14, id: "wings", name: "つばさ" },
  { level: 18, id: "crown", name: "かんむり" },
];

export const SIDE_TYPES: Record<SideType, SideTypeInfo> = {
  training: { name: "[特訓場|とっくんじょう]", icon: "training" },
  advanced: { name: "[応用|おうよう]", icon: "advanced" },
};
