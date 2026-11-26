import { useState } from 'react';

interface LeagueBrandBadgeProps {
  logoUrl?: string;
}

export function LeagueBrandBadge({ logoUrl = '/logo.png' }: LeagueBrandBadgeProps) {
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="inline-flex items-center select-none" aria-label="Batha League">
      {!imgFailed ? (
        <img
          src={logoUrl}
          alt="Batha League"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="h-16 w-auto object-contain sm:h-20 md:h-22"
        />
      ) : (
        <div className="flex flex-col items-center leading-[0.86] tracking-tight font-poster-display text-[#001452] uppercase">
          <span className="text-[19px] sm:text-[23px]">BATHA</span>
          <span className="text-[18px] sm:text-[21px]">LEAGUE</span>
        </div>
      )}
    </div>
  );
}
