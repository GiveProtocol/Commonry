import { motion } from "framer-motion";
import { useMemo } from "react";
import { getTimeOfDay, getGreeting, getSubMessage, isNewUser } from "../utils/greetingCopy";
import { GreetingContext } from "../types";
import { PlotGreetingSkeleton } from "./PlotSkeleton";

interface PlotGreetingProps {
  userName: string;
  currentStreak: number;
  lastStudyDate: string | null;
  cardsStudied: number;
  isLoading?: boolean;
}

export function PlotGreeting({
  userName,
  currentStreak,
  lastStudyDate,
  cardsStudied,
  isLoading = false,
}: PlotGreetingProps) {
  const greetingData = useMemo(() => {
    const hour = new Date().getHours();
    const timeOfDay = getTimeOfDay(hour);
    const greeting = getGreeting(timeOfDay, userName || "there");

    const context: GreetingContext = {
      timeOfDay,
      userName: userName || "there",
      currentStreak,
      lastStudyDate,
      isNewUser: isNewUser(lastStudyDate, cardsStudied),
    };

    const subMessage = getSubMessage(context);

    return { greeting, subMessage };
  }, [userName, currentStreak, lastStudyDate, cardsStudied]);

  if (isLoading) {
    return <PlotGreetingSkeleton />;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-1"
    >
      <h1 className="text-2xl md:text-3xl font-bold text-cyan font-mono [text-shadow:0_0_15px_rgba(0,217,255,0.4)]">
        {greetingData.greeting}
      </h1>
      <p className="text-text-muted font-mono text-sm md:text-base">
        {greetingData.subMessage}
      </p>
    </motion.div>
  );
}
