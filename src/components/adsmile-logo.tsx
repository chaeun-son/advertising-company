export function AdsmileWordmark({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 text-fg ${className}`}>
      <img src="/adsmile-mark.png" alt="" className="size-12 object-contain" />
      <span className="leading-none">
        <span className="block font-display text-[20px] font-black tracking-tight">애드스마일</span>
        <span className="mt-0.5 block text-[8px] font-semibold tracking-[0.14em] text-fg/80">
          SMILE ADVERTISING AGENCY
        </span>
      </span>
    </div>
  );
}

function finder(x: number, y: number) {
  const ring = x === 0 || y === 0 || x === 6 || y === 6;
  const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
  return ring || core;
}

/** 한텍스 명세표 왼쪽 QR 자리 — 문서번호로 패턴을 만듭니다. */
export function DocQr({ seed }: { seed: string }) {
  const n = 21;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < n; y += 1) {
    for (let x = 0; x < n; x += 1) {
      const tl = x < 7 && y < 7;
      const tr = x >= n - 7 && y < 7;
      const bl = x < 7 && y >= n - 7;
      let on = false;
      if (tl) on = finder(x, y);
      else if (tr) on = finder(x - (n - 7), y);
      else if (bl) on = finder(x, y - (n - 7));
      else {
        const v = Math.imul(h ^ (x * 374761393 + y * 668265263), 1274126177);
        on = ((v >>> 8) & 3) !== 0;
      }
      if (on) cells.push({ x, y });
    }
  }
  return (
    <svg viewBox={`0 0 ${n} ${n}`} className="size-[3.35rem] shrink-0" aria-hidden>
      <rect width={n} height={n} fill="#fff" />
      {cells.map((c) => (
        <rect key={`${c.x}-${c.y}`} x={c.x} y={c.y} width={1} height={1} fill="#111" />
      ))}
    </svg>
  );
}
