"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

export interface DropdownOption<T extends string> {
  label: string;
  value: T;
  description?: string;
  tone?: "default" | "danger";
}

interface CustomDropdownProps<T extends string> {
  ariaLabel: string;
  value: T;
  options: ReadonlyArray<DropdownOption<T>>;
  onChange: (value: T) => void;
  renderTrigger?: (selected: DropdownOption<T>) => ReactNode;
  menuAlign?: "left" | "right";
  minMenuWidth?: string;
}

export function CustomDropdown<T extends string>({
  ariaLabel,
  value,
  options,
  onChange,
  renderTrigger,
  menuAlign = "right",
  minMenuWidth,
}: CustomDropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const selected =
    options.find((option) => option.value === value) ?? options[0];

  return (
    <div className="custom-dropdown" ref={rootRef}>
      <button
        type="button"
        className="custom-dropdown__trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen((prev) => !prev)}
      >
        {renderTrigger ? (
          renderTrigger(selected)
        ) : (
          <span className="custom-dropdown__value">{selected.label}</span>
        )}
        <svg
          viewBox="0 0 20 20"
          width="14"
          height="14"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={
            open ? "custom-dropdown__chevron open" : "custom-dropdown__chevron"
          }
        >
          <title>Toggle sort options</title>
          <path d="M5 7.5 10 12.5 15 7.5" />
        </svg>
      </button>

      {open ? (
        <div
          className="custom-dropdown__menu"
          role="listbox"
          aria-label={ariaLabel}
          style={{
            left: menuAlign === "left" ? 0 : "auto",
            right: menuAlign === "right" ? 0 : "auto",
            minWidth: minMenuWidth,
          }}
        >
          {options.map((option) => {
            const isActive = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isActive}
                className={
                  isActive
                    ? option.tone === "danger"
                      ? "custom-dropdown__item active danger"
                      : "custom-dropdown__item active"
                    : option.tone === "danger"
                      ? "custom-dropdown__item danger"
                      : "custom-dropdown__item"
                }
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                <span className="custom-dropdown__item-label">
                  {option.label}
                </span>
                {option.description ? (
                  <span className="custom-dropdown__item-description">
                    {option.description}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
