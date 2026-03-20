const DEFAULT_WIDTHS = ["w-3/4", "w-1/2", "w-5/6"];

type PulseSkeletonProps = {
  widths?: string[];
};

export function PulseSkeleton({ widths = DEFAULT_WIDTHS }: PulseSkeletonProps) {
  return (
    <div className="animate-pulse space-y-3 py-4">
      {widths.map((w, idx) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton bars with no identity
        <div key={idx} className={`h-3 ${w} rounded bg-zinc-200`} />
      ))}
    </div>
  );
}
