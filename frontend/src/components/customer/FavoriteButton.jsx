import { useState } from 'react';
import Icon from '../common/Icon';
import { readPreference, savePreference } from '../../utils/discoveryPreferences';
export function favoriteIds() { const ids = readPreference('calar.favorites', []); return Array.isArray(ids) ? ids.filter(Number.isSafeInteger) : []; }
export default function FavoriteButton({ storeId }) {
  const [liked, setLiked] = useState(() => favoriteIds().includes(storeId));
  const [error, setError] = useState('');
  const toggle = () => {
    const ids = favoriteIds(); const next = liked ? ids.filter((id) => id !== storeId) : [...new Set([...ids, storeId])];
    if (savePreference('calar.favorites', next)) { setLiked(!liked); setError(''); }
    else setError('찜 목록을 저장하지 못했어요.');
  };
  return <div><button className="discovery-action" type="button" aria-pressed={liked} onClick={toggle}><Icon name={liked ? 'favorite' : 'favorite_border'} fill={liked} />{liked ? '찜한 가게' : '가게 찜하기'}</button>{error && <p role="alert">{error}</p>}</div>;
}
