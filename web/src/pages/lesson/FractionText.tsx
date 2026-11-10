import type { ChangeEvent, ReactNode } from "react";
import { Ruby } from "../../components/Ruby";
import { useText } from "../../grade";
import type { Fraction } from "../../lesson/fraction";
import { expressionName, fractionName, LESSON_COPY, mixedName, operatorText, toMixed } from "../../lesson/wording";
import type { InlinePart } from "../../lesson/wording";
import type { Problem } from "../../lesson/tiles";

function FractionShape({ value, blank = false, spaced = false }: { value: Fraction; blank?: boolean; spaced?: boolean }) {
  return (
    <span className="lesson-fraction">
      <span>{blank ? "□" : value.num}</span>
      {/* ボタンの名前は見える文字（1/2）から始める。axe は見える文字を「12」と読むので、分子と分母の間に空白を置いて名前と照らせるようにする。flex の中なので見た目は変わらない（#371） */}
      {spaced && " "}
      <span>{value.den}</span>
    </span>
  );
}

interface FractionTextProps {
  value: Fraction;
  /** 仮分数を帯分数の形で見せる */
  mixed?: boolean;
  /** ボタンの中で使う時。見える文字を、名前の先頭の「分子/分母」と照らせる形にする */
  spaced?: boolean;
}

/** 分数の形。読み上げは「2分の1」にする */
export function FractionText({ value, mixed = false, spaced = false }: FractionTextProps) {
  const t = useText();
  const { whole, rest } = toMixed(value);
  if (value.den === 1) return <span className="lesson-whole">{value.num}</span>;
  if (!mixed || whole === 0) {
    return <span className="lesson-fraction-wrap" role="img" aria-label={t(fractionName(value))}><FractionShape value={value} spaced={spaced} /></span>;
  }
  return (
    <span className="lesson-fraction-wrap" role="img" aria-label={t(mixedName(value))}>
      <span className="lesson-whole">{whole}</span>
      {rest.num > 0 && <FractionShape value={rest} />}
    </span>
  );
}

/** 文字列と分数がまざった案内 */
export function InlineParts({ parts }: { parts: InlinePart[] }) {
  return (
    <>
      {parts.map((part, index) => {
        const key = `${index}`;
        if (typeof part === "string") return <span key={key}><Ruby text={part} /></span>;
        return <FractionText key={key} value={part} mixed={part.mixed === true} />;
      })}
    </>
  );
}

type Expression = Pick<Problem, "left" | "operator" | "right">;

// 記号と続きの数は同じ行に置く。折り返す時に、記号だけが行末に残らないようにする
function KeepTogether({ mark, children }: { mark: string; children: ReactNode }) {
  return <span className="lesson-keep"><span>{mark}</span>{children}</span>;
}

function ExpressionParts({ left, operator, right, mixed, lead }: Expression & { mixed?: boolean; lead?: string }) {
  const first = <FractionText value={left} mixed={mixed} />;
  return (
    <>
      {lead ? <KeepTogether mark={lead}>{first}</KeepTogether> : first}
      <KeepTogether mark={operatorText(operator)}><FractionText value={right} mixed={mixed} /></KeepTogether>
    </>
  );
}

interface SlotProps {
  label: string;
  den: number;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

/** 分母だけが見えていて、分子を本人が入れる分数 */
export function FractionSlot({ label, den, value, onChange }: SlotProps) {
  return (
    <span className="lesson-fraction">
      {/* 分数の線はこの span の下線で引く。入力欄の枠と分けないと線が消える */}
      <span>
        <input
          className="lesson-slot"
          form="lesson-answer-form"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          aria-label={label}
          placeholder="□"
          value={value}
          onChange={onChange}
        />
      </span>
      <span>{den}</span>
    </span>
  );
}

export interface AlignedSlots {
  left: Fraction;
  right: Fraction;
  texts: readonly [string, string];
  onChange: (index: 0 | 1) => (event: ChangeEvent<HTMLInputElement>) => void;
}

function AlignedParts({ problem, slots }: { problem: Problem; slots: AlignedSlots }) {
  const t = useText();
  const { left, right, texts, onChange } = slots;
  return (
    <>
      <KeepTogether mark="=">
        <FractionSlot label={t(LESSON_COPY.alignedLabel(fractionName(problem.left), left.den))} den={left.den} value={texts[0]} onChange={onChange(0)} />
      </KeepTogether>
      {!problem.isRewrite && (
        <KeepTogether mark={operatorText(problem.operator)}>
          <FractionSlot label={t(LESSON_COPY.alignedLabel(fractionName(problem.right), right.den))} den={right.den} value={texts[1]} onChange={onChange(1)} />
        </KeepTogether>
      )}
    </>
  );
}

interface EquationProps {
  problem: Problem;
  /** 式の仮分数を帯分数で見せる */
  mixed?: boolean;
  /** 式にもどった時に本人が埋める、分母をそろえた形 */
  slots?: AlignedSlots;
  /** 正解の後に見せる、分母をそろえた形 */
  aligned?: Pick<Problem, "left" | "right">;
  /** 正解の後に見せる答え。無い間は「= ?」 */
  answer?: Fraction;
}

export function Equation({ problem, mixed = false, slots, aligned, answer }: EquationProps) {
  const t = useText();
  const alignedExpression = aligned && { ...aligned, operator: problem.operator };
  const start = problem.isRewrite ? fractionName(problem.left) : expressionName(problem, mixed);
  const names = [start, alignedExpression && expressionName(alignedExpression)].filter(Boolean);
  const end = answer ? mixedName(answer) : "いくつ";
  return (
    // □ があるときは img にしない。img の中の入力欄は読み上げに届かない
    <p className="lesson-equation-row" role={slots ? undefined : "img"} aria-label={slots ? undefined : t(`${names.join(" は ")} は ${end}`)}>
      {problem.isRewrite ? <FractionText value={problem.left} /> : <ExpressionParts {...problem} mixed={mixed} />}
      {slots && <AlignedParts problem={problem} slots={slots} />}
      {alignedExpression && <ExpressionParts {...alignedExpression} lead="=" />}
      {!slots && (answer ? <KeepTogether mark="="><FractionText value={answer} mixed={answer.num > answer.den} /></KeepTogether> : <span>= ?</span>)}
    </p>
  );
}

interface EquivalentEquationProps {
  problem: Problem;
  /** 式にもどった時に本人が入れる □ */
  slots?: AlignedSlots;
  /** 正解の後に見せる、□ に入る数を入れた分数 */
  answer?: Fraction;
}

/** 同じ大きさの分数の式 `num/den = □/target`。□ は式にもどった時だけ入力欄、正解の後は答えの数になる */
export function EquivalentEquation({ problem, slots, answer }: EquivalentEquationProps) {
  const t = useText();
  const target = problem.answer.den;
  const end = answer ? fractionName(answer) : `${target}[分|ぶん]の□`;
  return (
    // □ の入力欄があるときは img にしない。img の中の入力欄は読み上げに届かない
    <p className="lesson-equation-row" role={slots ? undefined : "img"} aria-label={slots ? undefined : t(`${fractionName(problem.left)} は ${end}`)}>
      <FractionText value={problem.left} />
      {slots && <AlignedParts problem={problem} slots={slots} />}
      {!slots && (
        <KeepTogether mark="=">
          {answer ? <FractionText value={answer} /> : <FractionShape value={{ num: 0, den: target }} blank />}
        </KeepTogether>
      )}
    </p>
  );
}
