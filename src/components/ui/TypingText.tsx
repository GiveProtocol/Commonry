import { useState, useEffect } from 'react';

interface TypingTextProps {
  text: string;
  speed?: number;
  delay?: number;
  className?: string;
  onComplete?: () => void;
}

export function TypingText({
  text,
  speed = 50,
  delay = 0,
  className = '',
  onComplete
}: TypingTextProps) {
  const { displayText, isComplete } = useTypingEffect(text, speed, delay);

  useEffect(() => {
    if (isComplete) {
      onComplete?.();
    }
  }, [isComplete, onComplete]);

  return (
    <span className={className}>
      {displayText}
      {!isComplete && (
        <span className="inline-block w-2 h-5 bg-cyan ml-1 animate-pulse" />
      )}
    </span>
  );
}

// Hook version for more control
export function useTypingEffect(text: string, speed: number = 50, delay: number = 0) {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    setDisplayText('');
    setCurrentIndex(0);
    setIsComplete(false);
  }, [text]);

  useEffect(() => {
    if (isComplete) return;

    const delayTimer = setTimeout(() => {
      if (currentIndex < text.length) {
        const timer = setTimeout(() => {
          setDisplayText(text.substring(0, currentIndex + 1));
          setCurrentIndex(currentIndex + 1);
        }, speed);

        return () => clearTimeout(timer);
      } else if (currentIndex === text.length) {
        setIsComplete(true);
      }
    }, delay);

    return () => clearTimeout(delayTimer);
  }, [currentIndex, text, speed, delay, isComplete]);

  return { displayText, isComplete };
}
