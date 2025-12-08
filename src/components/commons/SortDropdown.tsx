import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, Check } from "lucide-react";

export type SortOption =
  | "community"
  | "newest"
  | "popular"
  | "rating"
  | "updated"
  | "cards";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "community", label: "Community Favorites" },
  { value: "newest", label: "Newest" },
  { value: "popular", label: "Most Popular" },
  { value: "rating", label: "Highest Rated" },
  { value: "updated", label: "Recently Updated" },
  { value: "cards", label: "Most Cards" },
];

interface SortDropdownProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
}

export function SortDropdown({ value, onChange }: SortDropdownProps) {
  const currentOption = SORT_OPTIONS.find((opt) => opt.value === value);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="flex items-center gap-2 px-3 py-2 rounded-lg
                     border-2 border-terminal-muted dark:border-gray-600
                     bg-terminal-surface dark:bg-dark-surface
                     hover:border-terminal-primary dark:hover:border-cyan
                     transition-colors font-mono text-sm"
        >
          <span className="text-terminal-muted dark:text-text-muted">
            Sort:
          </span>
          <span className="text-terminal-primary dark:text-cyan font-bold">
            {currentOption?.label || "Community Favorites"}
          </span>
          <ChevronDown
            size={16}
            className="text-terminal-muted dark:text-text-muted"
          />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="min-w-[200px] p-2 rounded-lg shadow-lg
                     bg-terminal-surface dark:bg-dark-surface
                     border-2 border-terminal-primary dark:border-cyan
                     shadow-terminal-glow dark:shadow-cyan-glow
                     z-50"
          sideOffset={5}
          align="end"
        >
          {SORT_OPTIONS.map((option) => (
            <DropdownMenu.Item
              key={option.value}
              className={`flex items-center justify-between px-3 py-2 rounded cursor-pointer
                         font-mono text-sm outline-none
                         ${
                           value === option.value
                             ? "text-terminal-primary dark:text-cyan font-bold"
                             : "text-gray-700 dark:text-gray-300"
                         }
                         hover:bg-terminal-muted/20 dark:hover:bg-white/5
                         focus:bg-terminal-muted/20 dark:focus:bg-white/5`}
              onSelect={() => onChange(option.value)}
            >
              {option.label}
              {value === option.value && (
                <Check
                  size={14}
                  className="text-terminal-primary dark:text-cyan"
                />
              )}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
