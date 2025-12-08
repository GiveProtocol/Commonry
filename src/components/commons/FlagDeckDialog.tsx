import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Flag, AlertTriangle } from "lucide-react";

interface FlagDeckDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
  deckName: string;
}

const FLAG_REASONS = [
  { id: "inappropriate", label: "Inappropriate content" },
  { id: "copyright", label: "Copyright violation" },
  { id: "spam", label: "Spam or misleading" },
  { id: "offensive", label: "Offensive or hateful" },
  { id: "other", label: "Other" },
];

export function FlagDeckDialog({
  isOpen,
  onClose,
  onSubmit,
  deckName,
}: FlagDeckDialogProps) {
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [customReason, setCustomReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    const reason =
      selectedReason === "other"
        ? customReason
        : FLAG_REASONS.find((r) => r.id === selectedReason)?.label || "";

    if (!reason.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit(reason);
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedReason("");
    setCustomReason("");
    setSubmitted(false);
    onClose();
  };

  const canSubmit =
    selectedReason &&
    (selectedReason !== "other" || customReason.trim().length > 0);

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 z-50" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                     w-full max-w-md p-6 rounded-lg
                     bg-terminal-surface dark:bg-dark-surface
                     border-2 border-terminal-primary dark:border-cyan
                     shadow-terminal-glow dark:shadow-cyan-glow
                     z-50"
        >
          <Dialog.Title className="font-mono text-lg font-bold text-terminal-primary dark:text-cyan flex items-center gap-2">
            <Flag size={20} />
            [REPORT_DECK]
          </Dialog.Title>

          {submitted ? (
            <div className="mt-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <svg
                  className="w-8 h-8 text-green-600 dark:text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <p className="font-mono text-gray-700 dark:text-gray-300">
                Thank you for your report.
              </p>
              <p className="font-mono text-sm text-terminal-muted dark:text-text-muted mt-2">
                We'll review this deck and take appropriate action.
              </p>
              <button
                onClick={handleClose}
                className="mt-6 px-6 py-2 font-mono text-sm font-bold
                         bg-terminal-primary dark:bg-cyan text-white
                         rounded-lg hover:shadow-terminal-glow dark:hover:shadow-cyan-glow
                         transition-all"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              <Dialog.Description className="mt-2 font-mono text-sm text-terminal-muted dark:text-text-muted">
                Report inappropriate content in "{deckName}"
              </Dialog.Description>

              <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
                <div className="flex items-start gap-2">
                  <AlertTriangle
                    size={16}
                    className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0"
                  />
                  <p className="font-mono text-xs text-amber-800 dark:text-amber-300">
                    False reports may result in restrictions on your account.
                    Please only report genuine violations.
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-3">
                <p className="font-mono text-sm text-gray-700 dark:text-gray-300">
                  Why are you reporting this deck?
                </p>

                {FLAG_REASONS.map((reason) => (
                  <label
                    key={reason.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer
                              transition-all duration-200
                              ${
                                selectedReason === reason.id
                                  ? "border-terminal-primary dark:border-cyan bg-terminal-primary/5 dark:bg-cyan/5"
                                  : "border-terminal-muted dark:border-gray-600 hover:border-terminal-primary/50 dark:hover:border-cyan/50"
                              }`}
                  >
                    <input
                      type="radio"
                      name="flagReason"
                      value={reason.id}
                      checked={selectedReason === reason.id}
                      onChange={(e) => setSelectedReason(e.target.value)}
                      className="sr-only"
                    />
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center
                                ${
                                  selectedReason === reason.id
                                    ? "border-terminal-primary dark:border-cyan"
                                    : "border-terminal-muted dark:border-gray-500"
                                }`}
                    >
                      {selectedReason === reason.id && (
                        <div className="w-2 h-2 rounded-full bg-terminal-primary dark:bg-cyan" />
                      )}
                    </div>
                    <span className="font-mono text-sm text-gray-700 dark:text-gray-300">
                      {reason.label}
                    </span>
                  </label>
                ))}

                {selectedReason === "other" && (
                  <textarea
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    placeholder="Please describe the issue..."
                    className="w-full p-3 rounded-lg border-2 border-terminal-muted dark:border-gray-600
                             bg-terminal-base dark:bg-dark
                             font-mono text-sm text-gray-700 dark:text-gray-300
                             focus:border-terminal-primary dark:focus:border-cyan
                             focus:outline-none resize-none"
                    rows={3}
                  />
                )}
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={handleClose}
                  className="px-4 py-2 font-mono text-sm
                           text-terminal-muted dark:text-text-muted
                           hover:text-gray-700 dark:hover:text-gray-300
                           transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit || isSubmitting}
                  className="px-4 py-2 font-mono text-sm font-bold
                           bg-red-600 text-white rounded-lg
                           hover:bg-red-700
                           disabled:opacity-50 disabled:cursor-not-allowed
                           transition-all"
                >
                  {isSubmitting ? "Submitting..." : "Submit Report"}
                </button>
              </div>
            </>
          )}

          <Dialog.Close asChild>
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-1 rounded
                       text-terminal-muted dark:text-text-muted
                       hover:text-terminal-primary dark:hover:text-cyan
                       transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
