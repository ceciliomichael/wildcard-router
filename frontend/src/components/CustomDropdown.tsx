"use client";

import { useEffect, useRef, useState } from "react";

export interface DropdownOption<T extends string> {
  label: string;
  value: T;
}

interface CustomDropdownProps<T extends string> {
  ariaLabel: string;
  value: T;
  options: ReadonlyArray<DropdownOption<T>>;
  onChange: (value: T) => void;
}

export function CustomDropdown<T extends string>({
  ariaLabel,
  value,
  options,
  onChange,
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
        <span className="custom-dropdown__value">{selected.label}</span>
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
                    ? "custom-dropdown__item active"
                    : "custom-dropdown__item"
                }
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
