import { create } from "zustand";
import { persist } from "zustand/middleware";

const FONT_SIZES = [14, 16, 18, 20, 24] as const;
type FontSize = (typeof FONT_SIZES)[number];

interface StudySettingsState {
  fontSize: FontSize;
  setFontSize: (size: FontSize) => void;
  increaseFontSize: () => void;
  decreaseFontSize: () => void;
}

export const useStudySettings = create<StudySettingsState>()(
  persist(
    (set, get) => ({
      fontSize: 16,
      setFontSize: (size: FontSize) => set({ fontSize: size }),
      increaseFontSize: () => {
        const currentIndex = FONT_SIZES.indexOf(get().fontSize);
        if (currentIndex < FONT_SIZES.length - 1) {
          set({ fontSize: FONT_SIZES[currentIndex + 1] });
        }
      },
      decreaseFontSize: () => {
        const currentIndex = FONT_SIZES.indexOf(get().fontSize);
        if (currentIndex > 0) {
          set({ fontSize: FONT_SIZES[currentIndex - 1] });
        }
      },
    }),
    {
      name: "commonry-study-settings",
    },
  ),
);

export { FONT_SIZES };
export type { FontSize };
