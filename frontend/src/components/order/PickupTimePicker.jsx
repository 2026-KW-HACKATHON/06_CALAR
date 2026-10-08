import { useEffect, useMemo, useRef, useState } from 'react';
import Icon from '../common/Icon';
import { pickupAvailableDays, pickupTimes } from '../../utils/pickupChoices';

function ChoiceRail({ label, items, selected, onSelect }) {
  const rail = useRef(null);
  const timer = useRef(null);
  const index = Math.max(0, items.findIndex(item => item.value === selected));
  useEffect(() => {
    const node = rail.current;
    if (node) node.scrollLeft = index * (node.clientWidth / 3);
    return () => clearTimeout(timer.current);
  }, [items, index]);
  const availableIndex = (from, step) => {
    for (let i = from; i >= 0 && i < items.length; i += step) if (!items[i].disabled) return i;
    return -1;
  };
  const previous = availableIndex(index - 1, -1);
  const nextAvailable = availableIndex(index + 1, 1);
  const choose = next => {
    if (!items[next] || items[next].disabled) return;
    onSelect(items[next].value);
    rail.current?.scrollTo({ left: next * (rail.current.clientWidth / 3), behavior: 'smooth' });
  };
  const scroll = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const node = rail.current;
      const next = Math.round(node.scrollLeft / (node.clientWidth / 3));
      if (items[next] && next !== index) {
        const target = availableIndex(next, next < index ? -1 : 1);
        if (target >= 0) choose(target);
        else node.scrollTo({ left: index * (node.clientWidth / 3), behavior: 'smooth' });
      }
    }, 150);
  };
  return <div className="pickup-wheel">
    <button type="button" className="pickup-wheel__arrow" aria-label={`${label} 이전 선택`} disabled={previous < 0} onClick={() => choose(previous)}><Icon name="chevron_left" /></button>
    <div className="pickup-wheel__window">
      <div className="pickup-wheel__focus" aria-hidden="true" />
      <div className="pickup-wheel__rail" ref={rail} onScroll={scroll} role="group" aria-label={label}>
        {items.map((item, i) => <button type="button" key={item.value} disabled={item.disabled} className={`pickup-wheel__item${item.value === selected ? ' is-selected' : ''}`} aria-pressed={item.value === selected} onClick={() => choose(i)}>
          <strong>{item.label}</strong><span>{item.disabled ? '예약 불가' : item.sub}</span>
        </button>)}
      </div>
    </div>
    <button type="button" className="pickup-wheel__arrow" aria-label={`${label} 다음 선택`} disabled={nextAvailable < 0} onClick={() => choose(nextAvailable)}><Icon name="chevron_right" /></button>
  </div>;
}

export default function PickupTimePicker({ openHours, minOrderMinutes = 0, value, onChange, error, disabled }) {
  const [now, setNow] = useState(Date.now);
  const days = useMemo(() => pickupAvailableDays(now, openHours, minOrderMinutes), [now, openHours, minOrderMinutes]);
  const [chosenDay, setDay] = useState(() => days.find(item => !item.disabled)?.value || days[0].value);
  const day = days.find(item => item.value === chosenDay && !item.disabled)?.value || days.find(item => !item.disabled)?.value || days[0].value;
  const times = useMemo(() => pickupTimes(day, openHours, now, minOrderMinutes), [day, openHours, now, minOrderMinutes]);
  const callback = useRef(onChange);
  callback.current = onChange;
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (chosenDay !== day) setDay(day);
  }, [chosenDay, day]);
  useEffect(() => {
    if (!times.some(item => item.value === value)) callback.current(times[0]?.value || '');
  }, [times, value]);
  const selected = times.find(item => item.value === value);
  const selectedDay = days.find(item => item.value === day);
  return <fieldset className={`pickup-picker${error ? ' pickup-picker--error' : ''}`} disabled={disabled}>
    <legend className="sr-only">방문 날짜와 시간 선택</legend>
    <div className="pickup-picker__heading"><span><Icon name="swipe" /> 좌우로 넘겨 골라주세요</span><small>화살표를 눌러도 돼요</small></div>
    <div className="pickup-picker__label"><span>날짜</span><span>최대 30일 뒤까지</span></div>
    <ChoiceRail label="날짜" items={days} selected={day} onSelect={setDay} />
    {days[0].disabled && <p className="pickup-picker__hours">오늘은 가능한 시간이 없어 다음 가능한 날짜를 선택했어요.</p>}
    <div className="pickup-picker__divider" />
    <div className="pickup-picker__label"><span>시간</span><span>5분 간격</span></div>
    {minOrderMinutes > 0 && <p className="pickup-picker__hours">이 가게는 최소 {minOrderMinutes}분 전에 신청해야 해요.</p>}
    {times.length ? <ChoiceRail label="시간" items={times} selected={value} onSelect={onChange} /> : <p className="pickup-picker__empty">이 날짜에는 가능한 시간이 없어요.<br />다음 날짜를 골라주세요.</p>}
    <div className={`pickup-picker__summary${!selected ? ' is-empty' : ''}`} role="status" aria-live="polite">
      <Icon name={selected ? 'check_circle' : 'info'} />
      <div><small>{selected ? '선택한 방문 시간' : '날짜를 바꿔주세요'}</small><strong>{selected ? `${selectedDay?.label} ${selected.value.slice(11)}` : '예약 가능한 시간이 없어요'}</strong></div>
    </div>
    {openHours && <p className="pickup-picker__hours">영업시간 {openHours.replace('-', ' ~ ')} · 가능한 시간만 보여드려요</p>}
  </fieldset>;
}
