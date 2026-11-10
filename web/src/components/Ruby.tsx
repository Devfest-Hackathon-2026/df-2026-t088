import { useGrade } from "../grade";
import { chooseRuby, parseRuby } from "../ruby-text";

/** `[漢字|よみ]` を学年に合わせて漢字かひらがなにし、`<wbr>` を改行してよい位置にする。ふりがなは付けない（D-91）。HTML の文字列は作らない */
export function Ruby({ text }: { text: string }) {
  const grade = useGrade();
  return (
    <>
      {parseRuby(text).map((segment, index) => {
        const key = `${index}`;
        if (segment.type === "wbr") return <wbr key={key} />;
        if (segment.type === "text") return segment.text;
        return chooseRuby(segment.base, segment.reading, grade);
      })}
    </>
  );
}
