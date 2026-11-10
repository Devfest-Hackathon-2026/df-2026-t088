import type { KeyboardEvent } from "react";
import { Button } from "../../../components/Button";
import { Ruby } from "../../../components/Ruby";

// CMP-028 のタブの列（上のタブと、アバターの種類のタブ）。左右の矢印で移り、Tab で中身へ出る
interface TabItem<T extends string> {
  id: T;
  /** 文言（ふりがな記法つき） */
  label: string;
}

interface TabListProps<T extends string> {
  tabs: readonly TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  /** タブの id は `${idPrefix}-tab-${id}`。中身の id は panelIdOf で決める */
  idPrefix: string;
  panelIdOf: (id: T) => string;
  className?: string;
}

export const tabIdOf = (idPrefix: string, id: string) => `${idPrefix}-tab-${id}`;

export function TabList<T extends string>({ tabs, value, onChange, idPrefix, panelIdOf, className }: TabListProps<T>) {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const index = tabs.findIndex((tab) => tab.id === value);
    const next = tabs[(index + step + tabs.length) % tabs.length];
    onChange(next.id);
    document.getElementById(tabIdOf(idPrefix, next.id))?.focus();
  };
  return (
    <div role="tablist" className={["account-tabs", className].filter(Boolean).join(" ")} onKeyDown={handleKeyDown}>
      {tabs.map((tab) => {
        const selected = tab.id === value;
        return (
          <Button
            key={tab.id}
            id={tabIdOf(idPrefix, tab.id)}
            variant="quiet"
            role="tab"
            className="account-tab"
            aria-selected={selected}
            aria-controls={panelIdOf(tab.id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
          >
            <Ruby text={tab.label} />
          </Button>
        );
      })}
    </div>
  );
}
