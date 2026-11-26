import { useEffect, useState } from 'react';
import { Shield } from 'lucide-react';
import type { TeamInfo } from '../types/match';
import { resolveTeamLogoUrl } from '../utils/matchesService';

interface TeamLogoSlotProps {
  team: TeamInfo;
  side: 'left' | 'right';
}

export function TeamLogoSlot({ team, side }: TeamLogoSlotProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const resolvedLogoUrl = team.logoUrl?.trim() || resolveTeamLogoUrl(team.name);

  useEffect(() => {
    setImgFailed(false);
  }, [resolvedLogoUrl]);

  const borderClass =
    side === 'left'
      ? 'border-r border-[#8EA1C7]'
      : 'border-l border-[#8EA1C7]';

  return (
    <div
      className={`flex w-[82px] sm:w-[132px] md:w-[148px] shrink-0 items-center justify-center bg-[#EFEFEF] p-1.5 sm:p-2.5 ${borderClass}`}
    >
      {!imgFailed ? (
        <img
          src={resolvedLogoUrl}
          alt={team.name}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="h-[66px] w-[66px] sm:h-[104px] sm:w-[104px] md:h-[116px] md:w-[116px] object-contain"
        />
      ) : (
        <div
          className="flex h-[74px] w-[74px] sm:h-[104px] sm:w-[104px] md:h-[116px] md:w-[116px] flex-col items-center justify-center rounded-lg border border-[#CBD5E1] bg-white/70 px-1.5 text-center"
          aria-label={team.name}
        >
          <Shield className="h-7 w-7 sm:h-9 sm:w-9 text-[#334155]" strokeWidth={2} />
          <span className="mt-1 w-full truncate text-[10px] sm:text-xs font-extrabold text-[#0F172A]">
            {team.shortName}
          </span>
        </div>
      )}
    </div>
  );
}
