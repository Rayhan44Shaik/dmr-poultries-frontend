interface LoadingSkeletonProps {
  count?: number;
  height?: string;
  className?: string;
}

export const LoadingSkeleton = ({ count = 3, height = 'h-8', className = '' }: LoadingSkeletonProps) => (
  <div className={`animate-pulse space-y-2 ${className}`}>
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className={`bg-gray-200 ${height} rounded w-full`} />
    ))}
  </div>
);