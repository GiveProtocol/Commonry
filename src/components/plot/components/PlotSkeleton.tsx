import { motion } from "framer-motion";

export function PlotSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Greeting skeleton */}
      <div className="space-y-2">
        <div className="skeleton h-8 w-64 rounded" />
        <div className="skeleton h-5 w-48 rounded" />
      </div>

      {/* Main cards row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Today's Focus skeleton */}
        <div className="border-2 border-cyan/20 rounded-lg p-6 space-y-4">
          <div className="skeleton h-5 w-32 rounded" />
          <div className="skeleton h-12 w-24 rounded" />
          <div className="skeleton h-10 w-full rounded" />
        </div>

        {/* Momentum skeleton */}
        <div className="border-2 border-cyan/20 rounded-lg p-6 space-y-4">
          <div className="skeleton h-5 w-24 rounded" />
          <div className="skeleton h-12 w-20 rounded" />
          <div className="flex gap-2 justify-center">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="skeleton w-4 h-4 rounded-full" />
            ))}
          </div>
        </div>
      </div>

      {/* Insight skeleton */}
      <div className="border-2 border-amber/20 rounded-lg p-4">
        <div className="skeleton h-5 w-3/4 mx-auto rounded" />
      </div>
    </div>
  );
}

export function PlotGreetingSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-2"
    >
      <div className="skeleton h-8 w-64 rounded" />
      <div className="skeleton h-5 w-48 rounded" />
    </motion.div>
  );
}

export function PlotCardSkeleton() {
  return (
    <div className="border-2 border-cyan/20 rounded-lg p-6 space-y-4">
      <div className="skeleton h-5 w-32 rounded" />
      <div className="skeleton h-12 w-24 rounded" />
      <div className="skeleton h-10 w-full rounded" />
    </div>
  );
}
