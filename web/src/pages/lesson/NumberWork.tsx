import { Button } from "../../components/Button";
import { Ruby } from "../../components/Ruby";
import { useText } from "../../grade";
import { ANSWER_MAX_LENGTH } from "../../lesson/judge";
import type { NumberProblem, TableColumn } from "../../lesson/number-problem";
import { numberAnswerLabel, numberChoices, numberExpressionParts, numberTaskParts, LESSON_COPY, NUMBER_COPY } from "../../lesson/wording";
import { FractionSlot, FractionText, InlineParts } from "./FractionText";
import { LessonButton } from "./LessonButton";
import { NudgeText } from "./NudgeText";
import type { TileLesson } from "./use-tile-lesson";

/** 答えを文字で入れる欄。小数は inputmode="decimal"、整数だけの欄は "numeric"（05_screens-number） */
function inputModeOf({ answer }: NumberProblem): "decimal" | "numeric" | undefined {
  if (answer.type === "integer" || answer.type === "numerator") return "numeric";
  return answer.type === "decimal" ? "decimal" : undefined;
}

/** 数の問題の式。分数と整数の式（□ のある式）は、□ を欄の位置に出す */
function ExpressionRow({ lesson, problem }: { lesson: TileLesson; problem: NumberProblem }) {
  const t = useText();
  const { session } = lesson;
  const { topic } = problem;
  if (topic.t === "intToFraction") {
    return (
      <p className="lesson-equation-row">
        <span>{topic.n} =</span>
        {session.isCorrect
          ? <FractionText value={{ num: topic.count, den: topic.den }} />
          : <FractionSlot label={t(LESSON_COPY.equivalentLabel)} den={topic.den} value={session.answerText} onChange={lesson.onAnswerChange} />}
      </p>
    );
  }
  const parts = numberExpressionParts(problem, session.isCorrect);
  // 分配のきまりは、式の □ の位置に欄を置く（05_screens-number「□ のある式は □ を欄の位置に出す」）
  const [expression] = parts;
  if (topic.t === "distributive" && !session.isCorrect && typeof expression === "string" && expression.endsWith("□")) {
    return (
      <p className="lesson-equation-row">
        <span>{expression.slice(0, -1)}</span>
        <InlineSlot lesson={lesson} />
      </p>
    );
  }
  return parts.length > 0 ? <p className="lesson-equation-row"><InlineParts parts={parts} /></p> : null;
}

/** 式や表の中の □ の欄。答えの欄（フォーム）の一部として送る */
function InlineSlot({ lesson, className = "lesson-answer__input number-table__input" }: { lesson: TileLesson; className?: string }) {
  const t = useText();
  const { session, refs } = lesson;
  return (
    <input
      ref={refs.answerRef}
      form="lesson-answer-form"
      className={className}
      type="text"
      inputMode="decimal"
      enterKeyHint="done"
      autoComplete="off"
      aria-label={t(LESSON_COPY.equivalentLabel)}
      maxLength={ANSWER_MAX_LENGTH}
      value={session.answerText}
      readOnly={session.isCorrect}
      onChange={lesson.onAnswerChange}
      onClick={lesson.onAnswerClick}
    />
  );
}

const TABLE_ROWS = [{ mark: "△", key: "x" }, { mark: "□", key: "y" }] as const;

/** CMP-023 △ と □ の表。1列目は見出しのセル。空欄の 1 マスだけが入力欄 */
function NumberTable({ lesson, problem, table }: { lesson: TileLesson; problem: NumberProblem; table: TableColumn[] }) {
  const t = useText();
  const { session, refs } = lesson;
  const shown = session.isCorrect && problem.answer.type === "decimal" ? problem.answer.value : session.answerText;
  return (
    <table className="number-table" aria-label={t(NUMBER_COPY.tableName)}>
      <tbody>
        {TABLE_ROWS.map(({ mark, key }) => (
          <tr key={key}>
            <th scope="row">{mark}</th>
            {table.map((column) => (
              <td key={column.x}>
                {column[key] === null ? (
                  <input
                    ref={refs.answerRef}
                    form="lesson-answer-form"
                    className="lesson-answer__input number-table__input"
                    type="text"
                    inputMode="decimal"
                    enterKeyHint="done"
                    autoComplete="off"
                    aria-label={t(LESSON_COPY.equivalentLabel)}
                    maxLength={ANSWER_MAX_LENGTH}
                    value={shown}
                    readOnly={session.isCorrect}
                    onChange={lesson.onAnswerChange}
                    onClick={lesson.onAnswerClick}
                  />
                ) : column[key]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TextField({ lesson, problem }: { lesson: TileLesson; problem: NumberProblem }) {
  const { session, refs } = lesson;
  return (
    <>
      <label className="lesson-answer__label" htmlFor="lesson-answer"><Ruby text={numberAnswerLabel(problem)} /></label>
      <input
        ref={refs.answerRef}
        id="lesson-answer"
        className="lesson-answer__input"
        type="text"
        inputMode={inputModeOf(problem)}
        enterKeyHint="done"
        maxLength={ANSWER_MAX_LENGTH}
        value={session.answerText}
        readOnly={session.isCorrect}
        onChange={lesson.onAnswerChange}
        onClick={lesson.onAnswerClick}
      />
    </>
  );
}

// 商は整数、あまりは小数。2つの欄を横に並べる
function RemainderFields({ lesson }: { lesson: TileLesson }) {
  const { session, refs } = lesson;
  const fields = [NUMBER_COPY.quotientLabel, NUMBER_COPY.remainderLabel] as const;
  return (
    <div className="number-remainder">
      {fields.map((label, index) => (
        <label key={label} className="number-remainder__field">
          <span><Ruby text={label} /></span>
          <input
            ref={index === 0 ? refs.answerRef : undefined}
            className="lesson-answer__input"
            type="text"
            inputMode={index === 0 ? "numeric" : "decimal"}
            enterKeyHint="done"
            autoComplete="off"
            maxLength={ANSWER_MAX_LENGTH}
            value={session.partTexts[index as 0 | 1]}
            readOnly={session.isCorrect}
            onChange={lesson.onPartChange(index as 0 | 1)}
          />
        </label>
      ))}
    </div>
  );
}

/** CMP-022 数の札。選んでいる札は塗りと ✓。正解の後は押せないが、選んだ見た目のまま残す */
function Cards({ lesson, cards }: { lesson: TileLesson; cards: number[] }) {
  const t = useText();
  const { session } = lesson;
  return (
    <div className="number-cards" role="group" aria-label={t(NUMBER_COPY.cardsName)}>
      {cards.map((card) => {
        const isPicked = session.picked.includes(card);
        return (
          <Button
            key={card}
            className={isPicked ? "number-card is-picked" : "number-card"}
            aria-pressed={isPicked}
            disabled={session.isCorrect}
            onClick={() => lesson.onPick(card)}
          >
            {isPicked && <span className="number-card__check" aria-hidden="true">✓</span>}
            {card}
          </Button>
        );
      })}
    </div>
  );
}

function Fields({ lesson, problem }: { lesson: TileLesson; problem: NumberProblem }) {
  const { answer, topic } = problem;
  // 表の □ と □ のある式は、欄が式や表の中にある。別の欄は出さない
  if (answer.type === "numerator" || topic.t === "tableBlank" || topic.t === "distributive") return null;
  if (answer.type === "remainder") return <RemainderFields lesson={lesson} />;
  if (answer.type === "multi") return <Cards lesson={lesson} cards={answer.cards} />;
  if (answer.type === "choice") return null;
  return <TextField lesson={lesson} problem={problem} />;
}

function ChoiceButtons({ lesson, problem }: { lesson: TileLesson; problem: NumberProblem }) {
  const t = useText();
  if (lesson.session.isCorrect) return null;
  return (
    <div className="lesson-answer__buttons" role="group" aria-label={t(LESSON_COPY.answerButton)}>
      {numberChoices(problem).map(({ id, text }) => (
        <LessonButton key={id} text={text} className="lesson-choice" se={null} onClick={() => lesson.onNumberChoice(id)} />
      ))}
    </div>
  );
}

/** 数の問題の、問題の文・式・表・答えの欄。タイルは開かない（D-132）。まちがい・正解の一言・ヒントは ProblemCard が出す */
export function NumberWork({ lesson, problem }: { lesson: TileLesson; problem: NumberProblem }) {
  const { isCorrect } = lesson.session;
  const task = numberTaskParts(problem);
  const isChoice = problem.answer.type === "choice";
  const isNudged = lesson.nudge === "help";
  const table = problem.topic.t === "pickRule" || problem.topic.t === "tableBlank" ? problem.topic.table : null;

  return (
    <>
      {task.length > 0 && <p className="lesson-task"><InlineParts parts={task} /></p>}
      <ExpressionRow lesson={lesson} problem={problem} />
      {table && <NumberTable lesson={lesson} problem={problem} table={table} />}
      <form id="lesson-answer-form" className="lesson-answer" autoComplete="off" onSubmit={lesson.onAnswer}>
        <Fields lesson={lesson} problem={problem} />
        {isChoice && <ChoiceButtons lesson={lesson} problem={problem} />}
        {!isCorrect && (
          <div className="lesson-answer__buttons">
            {!isChoice && <Button type="submit" variant="primary" se={null}>{LESSON_COPY.answerButton}</Button>}
            <LessonButton text={LESSON_COPY.helpButton} className={isNudged ? "lesson-quiet-button is-nudged" : "lesson-quiet-button"} onClick={lesson.onHelp} />
            <NudgeText text={isNudged ? LESSON_COPY.nudgeHelp : null} />
          </div>
        )}
      </form>
    </>
  );
}
