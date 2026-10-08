// Meeting-defined ranking can replace this adapter without changing the home UI.
export const recommendationPolicy = {
  label: '동네에서 만나는 가게',
  select(stores, hidden, now = Date.now()) {
    return stores.filter((store) => !(Number.isFinite(hidden?.[store.id]) && hidden[store.id] > now)).slice(0, 10);
  },
};
