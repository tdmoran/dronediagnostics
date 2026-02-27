import { cn } from "@/lib/utils"

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
}

function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-gray-800/50",
        className
      )}
      {...props}
    />
  )
}

// Preset skeleton components for common use cases

function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-gray-800 bg-gray-900 p-6", className)}>
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-5 w-5" />
      </div>
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  )
}

function SkeletonStatCard({ className }: { className?: string }) {
  return (
    <div className={cn("bg-gray-800/50 rounded-lg p-4 border border-gray-700", className)}>
      <div className="flex items-center gap-2 mb-2">
        <Skeleton className="h-5 w-5" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-8 w-20" />
    </div>
  )
}

function SkeletonChart({ className }: { className?: string }) {
  return (
    <div className={cn("bg-gray-900 rounded-xl border border-gray-800 p-4", className)}>
      <Skeleton className="h-6 w-32 mb-4" />
      <div className="h-[300px] flex items-end justify-between gap-2">
        {Array.from({ length: 20 }).map((_, i) => (
          <Skeleton 
            key={i} 
            className="w-full" 
            style={{ height: `${Math.random() * 60 + 20}%` }} 
          />
        ))}
      </div>
    </div>
  )
}

function SkeletonTable({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("w-full", className)}>
      <div className="flex gap-4 mb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-8 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 mb-3">
          {Array.from({ length: 4 }).map((_, j) => (
            <Skeleton key={j} className="h-6 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

function SkeletonGPSStats({ className }: { className?: string }) {
  return (
    <div className={cn("bg-gray-900 rounded-xl p-6 border border-gray-800", className)}>
      <div className="flex items-center gap-2 mb-4">
        <Skeleton className="h-5 w-5" />
        <Skeleton className="h-6 w-32" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonStatCard key={i} />
        ))}
      </div>
    </div>
  )
}

function SkeletonMap({ className }: { className?: string }) {
  return (
    <div className={cn("bg-gray-900 rounded-xl border border-gray-800 h-[400px] flex items-center justify-center", className)}>
      <div className="text-center">
        <Skeleton className="h-12 w-12 mx-auto mb-4 rounded-full" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  )
}

export {
  Skeleton,
  SkeletonCard,
  SkeletonStatCard,
  SkeletonChart,
  SkeletonTable,
  SkeletonGPSStats,
  SkeletonMap,
}