export function HeroTitle() {
  return (
    <header className="relative mx-auto flex w-full max-w-[850px] flex-col items-center justify-center pt-0 pb-5 sm:pt-1 sm:pb-7 select-none">
      <h1 className="relative flex flex-col items-center text-center leading-none">
        <span className="font-poster-display text-stroke-match block scale-x-[1.08] text-[clamp(5.2rem,19vw,11.6rem)] leading-[0.86] tracking-[0.01em] uppercase">
          MATCH
        </span>
        <span
          className="font-poster-comic text-stroke-result -mt-5 sm:-mt-8 md:-mt-10 block -rotate-3 text-[clamp(2.55rem,7.8vw,4.9rem)] leading-[0.95] tracking-[0.04em] uppercase"
          aria-label="Match Result"
        >
          RESULT!
        </span>
      </h1>
    </header>
  );
}
