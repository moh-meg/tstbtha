export function MatchCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      data-testid="match-card-skeleton"
      className="flex w-full min-h-[104px] sm:min-h-[126px] md:min-h-[138px] items-stretch bg-[#EFEFEF] shadow-[0_10px_28px_rgba(0,18,74,0.34)]"
    >
      <div className="flex w-[82px] sm:w-[132px] md:w-[148px] shrink-0 items-center justify-center border-r border-[#8EA1C7] p-2 sm:p-3">
        <div className="h-14 w-14 sm:h-24 sm:w-24 animate-pulse rounded bg-[#D4D9E2]" />
      </div>

      <div className="flex flex-1 flex-col">
        <div className="flex h-8 sm:h-10 md:h-[42px] items-center justify-center bg-[#FF3B30]/90 px-4">
          <div className="h-3.5 w-32 animate-pulse rounded bg-white/40" />
        </div>
        <div className="flex flex-1 items-center justify-center p-3">
          <div className="h-8 w-16 animate-pulse rounded bg-[#D4D9E2]" />
        </div>
      </div>

      <div className="flex w-[82px] sm:w-[132px] md:w-[148px] shrink-0 items-center justify-center border-l border-[#8EA1C7] p-2 sm:p-3">
        <div className="h-14 w-14 sm:h-24 sm:w-24 animate-pulse rounded bg-[#D4D9E2]" />
      </div>
    </div>
  );
}
