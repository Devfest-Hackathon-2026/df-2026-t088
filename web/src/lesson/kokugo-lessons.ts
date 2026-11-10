import { KOKUGO_CHAPTERS } from "../data/kokugo";
import type { Course } from "../game/course";
import type { LessonTarget } from "../game/logic";
import type { QuizLesson } from "./quiz";

// 出典: ①文科省「音訓の小・中・高等学校段階別割り振り表」https://www.mext.go.jp/a_menu/shotou/new-cs/__icsFiles/afieldfile/2017/05/15/1385768.pdf
// ②文化庁「常用漢字表」https://www.bunka.go.jp/kokugo_nihongo/sisaku/joho/joho/kijun/naikaku/kanji/ （PDF: https://www.bunka.go.jp/kokugo_nihongo/sisaku/joho/joho/kijun/naikaku/pdf/joyokanjihyo_20101130.pdf）
// ③文科省「小学校学習指導要領（平成29年告示）」https://www.mext.go.jp/content/1413522_001.pdf
// 国語第5・6学年 (1)エの要約: 当該学年までの漢字を読み、前学年までの漢字を書いて文中で使い、当該学年の漢字も少しずつ書いて使う。よって本章の□は4年までの漢字。
// 以下のページは資料PDFの先頭から数えた物理ページ（1始まり）。
const lessons: Record<string, QuizLesson> = {
  "kokugo-kanji-5:main-0": { key: "kokugo-kanji-5:main-0", problems: [
    // 出典: ①営=エイ p.3・業=ギョウ p.11（小○）、②営 p.15「営業」
    { kind: "choice", id: "kokugo-kanji-5:main-0-1", prompt: "reading", subject: "営業", choices: ["えいぎょう", "えいこう", "いんぎょう"], answer: "えいぎょう", hints: ["「営」はエイ、「業」はギョウと[読|よ]むよ。", "ならべると「えいぎょう」だよ。"] },
    // 出典: ①原=ゲン p.14・因=イン p.2（小○）、②因 p.13・原 p.49「原因」
    { kind: "choice", id: "kokugo-kanji-5:main-0-2", prompt: "reading", subject: "原因", choices: ["げんいん", "げんえん", "はらいん"], answer: "げんいん", hints: ["「原」はゲン、「因」はインと[読|よ]むよ。", "あわせると「げんいん」だよ。"] },
    // 出典: ①採=サイ p.17・用=ヨウ p.47（小○）、②採 p.59「採用」
    { kind: "choice", id: "kokugo-kanji-5:main-0-3", prompt: "reading", subject: "採用", choices: ["さいよう", "さいゆう", "とるよう"], answer: "さいよう", hints: ["「採」はサイ、「用」はヨウと[読|よ]むよ。", "あわせると「さいよう」だよ。"] },
    // 出典: ①許=キョ p.10・可=カ p.4（小○）、②許 p.37・可 p.20「許可」
    { kind: "choice", id: "kokugo-kanji-5:main-0-4", prompt: "reading", subject: "許可", choices: ["きょか", "ゆるか", "きょが"], answer: "きょか", hints: ["「許」はキョ、「可」はカと[読|よ]むよ。", "あわせると「きょか」だよ。"] },
  ] },
  "kokugo-kanji-5:main-1": { key: "kokugo-kanji-5:main-1", problems: [
    // 出典: ①迷=まよう p.46（小○）、②迷 p.147「迷う」
    { kind: "choice", id: "kokugo-kanji-5:main-0-5", prompt: "reading", subject: "迷う", choices: ["まよう", "めいう", "まよる"], answer: "まよう", hints: ["「迷」は訓読みで「まよう」と[読|よ]めるよ。", "「迷う」は「まよう」だよ。"] },
    // 出典: ①増=ふえる p.31（小○）、②増 p.100「増える」
    { kind: "choice", id: "kokugo-kanji-5:main-0-6", prompt: "reading", subject: "増える", choices: ["ふえる", "ぞうえる", "ふやる"], answer: "ふえる", hints: ["「増」は訓読みで「ふえる」と[読|よ]めるよ。", "「増える」は「ふえる」だよ。"] },
    // 出典: ①築=きずく p.33（小○）、②築 p.108「築く」
    { kind: "choice", id: "kokugo-kanji-5:main-0-7", prompt: "reading", subject: "築く", choices: ["きずく", "ちくく", "きづく"], answer: "きずく", hints: ["「築」は訓読みで「きずく」と[読|よ]めるよ。", "「築く」は「きずく」だよ。"] },
    // 出典: ①備=そなえる p.41（小○）、②備 p.131「備える」
    { kind: "choice", id: "kokugo-kanji-5:main-0-8", prompt: "reading", subject: "備える", choices: ["そなえる", "びえる", "そなわる"], answer: "そなえる", hints: ["「備」は訓読みで「そなえる」と[読|よ]めるよ。", "「備える」は「そなえる」だよ。"] },
  ] },
  "kokugo-kanji-5:main-2": { key: "kokugo-kanji-5:main-2", problems: [
    // 出典: ①慣=なれる p.8（小○）、②慣 p.29「慣れる」
    { kind: "input", id: "kokugo-kanji-5:main-0-9", prompt: "reading", subject: "慣れる", answer: "なれる", hints: ["「慣」は「なれる」と[読|よ]むよ。", "「慣れる」の答えは「なれる」だよ。"] },
    // 出典: ①迷=メイ p.46・路=ロ p.50（小○）、②迷 p.147「迷路」
    { kind: "input", id: "kokugo-kanji-5:main-0-10", prompt: "reading", subject: "迷路", answer: "めいろ", hints: ["「迷」はメイ、「路」はロと[読|よ]むよ。", "あわせて「めいろ」だよ。"] },
    // 出典: ①綿=わた p.46（小○）、②綿 p.147「綿」
    { kind: "input", id: "kokugo-kanji-5:main-0-11", prompt: "reading", subject: "綿", answer: "わた", hints: ["「綿」は「わた」とも[読|よ]むよ。", "この[問題|もんだい]の[答|こた]えは「わた」だよ。"] },
    // 出典: ①夢=ム p.45・中=チュウ p.33（小○）、②夢 p.146「夢中」
    { kind: "input", id: "kokugo-kanji-5:main-0-12", prompt: "reading", subject: "夢中", answer: "むちゅう", hints: ["「夢」はム、「中」はチュウと[読|よ]むよ。", "あわせて「むちゅう」だよ。"] },
  ] },
  "kokugo-kanji-5:main-3": { key: "kokugo-kanji-5:main-3", problems: [
    // 出典: ①印=イン p.2・刷=サツ p.18（小○）、②印 p.13・刷 p.62「印刷」
    { kind: "choice", id: "kokugo-kanji-5:main-0-13", prompt: "kanji", subject: "チラシを印□する。", choices: ["札", "察", "刷"], answer: "刷", hints: ["「印」はイン、「札」「察」「刷」はサツと[読|よ]むよ。", "ちらしを作るときは「印刷」するよ。"] },
    // 出典: ①管=カン p.8・理=リ p.48（小○）、②管 p.30「管理」
    { kind: "choice", id: "kokugo-kanji-5:main-0-14", prompt: "kanji", subject: "チームの□理をまかせた。", choices: ["管", "関", "観"], answer: "管", hints: ["「管」「関」「観」はどれもカンと[読|よ]むよ。", "[役目|やくめ]を[受|う]け[持|も]つのは「管理」だよ。"] },
    // 出典: ①散=サン p.18・歩=ホ p.43（小○）、②散 p.63「散歩」
    { kind: "choice", id: "kokugo-kanji-5:main-0-15", prompt: "kanji", subject: "こうえんで□歩をした。", choices: ["散", "産", "参"], answer: "散", hints: ["「散」「産」「参」はどれもサンと[読|よ]むよ。", "こうえんを歩くのは「散歩」だよ。"] },
    // 出典: ①関=カン p.8・係=ケイ p.12（小○）、②関 p.30「関係」
    { kind: "choice", id: "kokugo-kanji-5:main-0-16", prompt: "kanji", subject: "ともだちとの□係をたいせつにしよう。", choices: ["関", "管", "観"], answer: "関", hints: ["「関」「管」「観」はどれもカンと[読|よ]むよ。", "[人|ひと]とのつながりは「関係」だよ。"] },
  ] },
  "kokugo-kanji-5:test": { key: "kokugo-kanji-5:test", problems: [
    // 出典: ①増=ゾウ p.31・加=カ p.4（小○）、②増 p.100「増加」
    { kind: "choice", id: "kokugo-kanji-5:test-1", prompt: "reading", subject: "増加", choices: ["ぞうか", "そうか", "ますか"], answer: "ぞうか", hints: ["「増」はゾウ、「加」はカと[読|よ]むよ。", "あわせると「ぞうか」だよ。"] },
    // 出典: ①備=そなわる p.41（小○）、②備 p.131「備わる」
    { kind: "choice", id: "kokugo-kanji-5:test-2", prompt: "reading", subject: "備わる", choices: ["そなわる", "びわる", "そなえる"], answer: "そなわる", hints: ["「備」は「そなわる」とも[読|よ]むよ。", "「備わる」は「そなわる」だよ。"] },
    // 出典: ①習=シュウ p.22・慣=カン p.8（小○）、②習 p.74・慣 p.29「習慣」
    { kind: "input", id: "kokugo-kanji-5:test-3", prompt: "reading", subject: "習慣", answer: "しゅうかん", hints: ["はじめの「習」はシュウと[読|よ]むよ。", "あわせて「しゅうかん」だよ。"] },
    // 出典: ①成=セイ p.27・功=コウ p.15（小○）、②成 p.89・功 p.52「成功」
    { kind: "choice", id: "kokugo-kanji-5:test-4", prompt: "kanji", subject: "どりょくのけっか、□功をおさめた。", choices: ["成", "正", "生"], answer: "成", hints: ["「成」「正」「生」はどれもセイと[読|よ]むよ。", "[努力|どりょく]が[実|みの]ることは「成功」だよ。"] },
    // 出典: ①考=コウ p.15・察=サツ p.18（小○）、②察 p.62「考察」
    { kind: "choice", id: "kokugo-kanji-5:test-5", prompt: "kanji", subject: "しらべたないようを考□した。", choices: ["察", "札", "刷"], answer: "察", hints: ["「察」「札」「刷」はどれもサツと[読|よ]むよ。", "[調|しら]べたことを[考|かんが]えるのは「考察」だよ。"] },
    // 出典: ①生=セイ p.27・産=サン p.18（小○）、②産 p.63「生産」
    { kind: "choice", id: "kokugo-kanji-5:test-6", prompt: "kanji", subject: "のうかは、こめを生□する。", choices: ["産", "散", "参"], answer: "産", hints: ["「産」「散」「参」はどれもサンと[読|よ]むよ。", "こめを[作|つく]ることは「生産」だよ。"] },
  ] },
};

export const findKokugoLesson = (chapterId: string, key: string): QuizLesson | undefined => lessons[`${chapterId}:${key}`];

export const KOKUGO_COURSE: Course = {
  subjectId: "kokugo",
  chapters: KOKUGO_CHAPTERS,
  hasLesson(chapterId: string, target: LessonTarget) {
    const key = target.kind === "main" ? `main-${target.index}` : target.kind === "test" ? "test" : target.sideId;
    return (lessons[`${chapterId}:${key}`]?.problems.length ?? 0) > 0;
  },
};
