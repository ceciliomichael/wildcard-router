import { GitCompareArrows } from "lucide-react";
import { Tooltip } from "./Tooltip";

export interface SegmentedFieldOption {
  label: string;
  value: string;
}

export type SegmentedFieldSize = "sm" | "md" | "lg";

interface SegmentedFieldProps {
  ariaLabel?: string;
  className?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  options: readonly SegmentedFieldOption[];
  size?: SegmentedFieldSize;
  value: string;
}

interface DiffPanelSegmentedToggleProps {
  disabled?: boolean;
  isOpen: boolean;
  onToggle: () => void;
  totalAddedLineCount: number;
  totalRemovedLineCount: number;
}

export function SegmentedField({
  ariaLabel,
  className,
  disabled = false,
  onChange,
  options,
  size = "md",
  value,
}: SegmentedFieldProps) {
  const containerSizingClassesBySize: Record<SegmentedFieldSize, string> = {
    sm: "gap-[0.2rem] p-[0.2rem]",
    md: "gap-[0.25rem] p-[0.25rem]",
    lg: "gap-[0.3rem] p-[0.3rem]",
  };
  const buttonSizingClassesBySize: Record<SegmentedFieldSize, string> = {
    sm: "px-[0.6rem] py-[0.2rem] text-xs",
    md: "px-3 py-1.5 text-sm",
    lg: "px-[0.9rem] py-[0.55rem] text-sm",
  };

  return (
    <fieldset
      aria-label={ariaLabel}
      className={[
        "m-0 inline-flex min-w-0 items-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-subtle)]",
        containerSizingClassesBySize[size],
        disabled ? "opacity-70" : "",
        className ?? "",
      ].join(" ")}
    >
      {options.map((option) => {
        const isActive = option.value === value;

        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            aria-pressed={isActive}
            onClick={() => onChange(option.value)}
            className={[
              "inline-flex items-center justify-center rounded-lg border border-transparent font-semibold capitalize leading-none transition-all",
              buttonSizingClassesBySize[size],
              isActive
                ? "bg-[var(--color-surface)] text-[var(--color-ink)] shadow-[var(--shadow-card)]"
                : "bg-transparent text-[var(--color-ink-muted)] hover:bg-[var(--color-brand-lighter)] hover:text-[var(--color-ink-secondary)]",
            ].join(" ")}
          >
            {option.label}
          </button>
        );
      })}
    </fieldset>
  );
}

export function DiffPanelSegmentedToggle({
  disabled = false,
  isOpen,
  onToggle,
  totalAddedLineCount,
  totalRemovedLineCount,
}: DiffPanelSegmentedToggleProps) {
  const tooltipLabel = disabled
    ? "Open a git-backed folder to view diffs"
    : isOpen
      ? "Hide diff panel"
      : "Show diff panel";

  return (
    <Tooltip content={tooltipLabel} side="bottom">
      <button
        type="button"
        disabled={disabled}
        aria-expanded={isOpen}
        onClick={onToggle}
        className={[
          "inline-flex h-10 items-center gap-1.5 text-sm text-muted-foreground transition-colors",
          disabled ? "cursor-not-allowed opacity-60" : "hover:text-foreground",
        ].join(" ")}
      >
        <GitCompareArrows size={16} className="shrink-0" />
        {disabled ? null : (
          <>
            <span className="text-emerald-600 dark:text-emerald-400">{`+${totalAddedLineCount}`}</span>
            <span className="text-red-600 dark:text-red-400">{`-${totalRemovedLineCount}`}</span>
          </>
        )}
      </button>
    </Tooltip>
  );
}
