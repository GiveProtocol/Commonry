import { Type, Minus, Plus } from "lucide-react";
import { useStudySettings, FONT_SIZES } from "../../hooks/useStudySettings";

export function FontSizeControl() {
  const { fontSize, increaseFontSize, decreaseFontSize } = useStudySettings();

  const isAtMin = fontSize === FONT_SIZES[0];
  const isAtMax = fontSize === FONT_SIZES[FONT_SIZES.length - 1];

  return (
    <div className="flex items-center gap-1">
      <Type
        size={16}
        className="text-gray-600 dark:text-gray-400 mr-1"
        aria-hidden="true"
      />
      <button
        onClick={decreaseFontSize}
        disabled={isAtMin}
        className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
          isAtMin ? "opacity-30 pointer-events-none" : ""
        }`}
        aria-label="Decrease font size"
        title="Decrease font size (- key)"
      >
        <Minus size={16} className="text-gray-600 dark:text-gray-400" />
      </button>
      <span
        className="text-sm font-mono text-gray-600 dark:text-gray-400 min-w-[2.5rem] text-center"
        aria-live="polite"
        aria-label={`Current font size: ${fontSize} pixels`}
      >
        {fontSize}px
      </span>
      <button
        onClick={increaseFontSize}
        disabled={isAtMax}
        className={`p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
          isAtMax ? "opacity-30 pointer-events-none" : ""
        }`}
        aria-label="Increase font size"
        title="Increase font size (+ key)"
      >
        <Plus size={16} className="text-gray-600 dark:text-gray-400" />
      </button>
    </div>
  );
}
