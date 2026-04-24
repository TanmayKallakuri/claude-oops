"use client";

import { Pill } from "@/components/ui/Pill";

type Category = "all" | "bug" | "behavior" | "discussion";
const CATEGORIES: Category[] = ["all", "bug", "behavior", "discussion"];

export function CategoryFilter({
  value,
  onChange,
}: {
  value: Category;
  onChange: (next: Category) => void;
}) {
  return (
    <div className="flex gap-2 flex-wrap">
      {CATEGORIES.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className="focus:outline-none"
        >
          <Pill tone={c === "all" ? "neutral" : c === "bug" ? "danger" : c === "behavior" ? "accent" : "primary"} active={value === c}>
            {c}
          </Pill>
        </button>
      ))}
    </div>
  );
}
