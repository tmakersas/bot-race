export default function Footer() {
  return (
    <footer className="mx-auto flex max-w-6xl flex-col gap-2 px-4 pb-10 font-mono text-[11px] text-white/40 sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <span>
        made by{" "}
        <a href="https://x.com/tibo_maker" target="_blank" rel="noopener" className="text-white/70 hover:text-white">
          @tibo_maker
        </a>{" "}
        · idea from{" "}
        <a href="https://x.com/levelsio/status/2108196980983795995" target="_blank" rel="noopener" className="text-white/70 hover:text-white">
          @levelsio&apos;s crawler test
        </a>
      </span>
      <span>
        want AI answers to cite you, not just crawl you?{" "}
        <a href="https://outrank.so/?ref=bot-race" target="_blank" rel="noopener" className="text-white/70 hover:text-white">
          outrank.so
        </a>
      </span>
    </footer>
  );
}
