import { useEffect, useRef, useState } from 'react';
export default function SlideRail({ items, renderItem, label, auto = false, overlayControls = false, showPlaybackControl = true }) {
  const rail = useRef(null); const [index, setIndex] = useState(0); const [paused, setPaused] = useState(false);
  const go = (next) => { const node = rail.current; node?.scrollTo({ left: next * node.clientWidth, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); };
  useEffect(() => {
    if (!auto || paused || items.length < 2 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => { if (!document.hidden) go((index + 1) % items.length); }, 6000);
    return () => clearInterval(timer);
  }, [auto, paused, index, items.length]);
  return <section className={`slide-section${overlayControls ? ' slide-section--overlay' : ''}`} aria-label={label} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}>
    <div className="slide-rail" ref={rail} onScroll={() => { const el = rail.current; if (el) setIndex(Math.round(el.scrollLeft / el.clientWidth)); }}>{items.map((item, i) => <div className="slide-rail__item" key={item.id ?? i}>{renderItem(item, i)}</div>)}</div>
    <div className="slide-controls"><button type="button" aria-label={`${label} 이전`} onClick={() => go((index - 1 + items.length) % items.length)}>‹</button>
      {items.map((item, i) => <button type="button" className={`slide-dot${i === index ? ' is-active' : ''}`} key={item.id ?? i} aria-label={`${label} ${i + 1}번 보기`} aria-current={i === index ? 'true' : undefined} onClick={() => go(i)}><span /></button>)}
      <button type="button" aria-label={`${label} 다음`} onClick={() => go((index + 1) % items.length)}>›</button>
      {auto && showPlaybackControl && <button type="button" onClick={() => setPaused(!paused)} aria-label={paused ? '자동 넘김 시작' : '자동 넘김 멈춤'}>{paused ? '▶' : 'Ⅱ'}</button>}
    </div>
  </section>;
}
