import { useState } from 'react';
import api from '../../services/api';
import Icon from '../common/Icon';
import { photoUrl } from '../../utils/photoUrl';

const EXAMPLES = [['sign', '간판'], ['store', '가게'], ['food', '음식'], ['clothes', '옷'], ['iron', '다리미']];
const exampleUrl = (name) => `${import.meta.env.BASE_URL}examples/${name}.png`;

export default function PhotoManager({ storeId, menuId, photos = [], onSaved, disabled = false, video = false, portrait = false }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const menu = menuId !== undefined || portrait;
  const label = video ? '동영상' : '사진';
  const max = video ? 3 : 10;
  const saveFile = async (file) => {
    if (file.size > (video ? 50 : 10) * 1024 * 1024) { setMessage(`${video ? 50 : 10}MB 이하의 ${label}을 선택해 주세요.`); return; }
    setBusy(true); setMessage('');
    try {
      const form = new FormData(); form.append(video ? 'video' : 'image', file);
      await api.post(`/api/owner/stores/${storeId}/${portrait ? 'portrait' : menu ? `menus/${menuId}/${video ? 'video' : 'photo'}` : video ? 'videos' : 'photos'}`, form);
      setMessage(`${label}을 등록했어요.`); onSaved();
    } catch (error) { setMessage(error.response?.data?.error || `${label}을 등록하지 못했어요. 다시 시도해 주세요.`); }
    finally { setBusy(false); }
  };
  const upload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || busy || disabled) return;
    await saveFile(file);
  };
  const useExample = async (name) => {
    if (busy || disabled || (!menu && photos.length >= max)) return;
    if (menu && photos.length && !window.confirm('등록한 사진을 이 예시 사진으로 변경할까요?')) return;
    setBusy(true); setMessage('예시 사진을 불러오고 있어요…');
    try {
      const response = await fetch(exampleUrl(name));
      if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error('Example unavailable');
      await saveFile(new File([await response.blob()], `${name}.png`, { type: 'image/png' }));
    } catch { setMessage('예시 사진을 불러오지 못했어요. 다시 시도해 주세요.'); }
    finally { setBusy(false); }
  };
  const remove = async (photo) => {
    if (busy || !window.confirm(`이 ${label}을 삭제할까요?`)) return;
    setBusy(true); setMessage('');
    try { await api.delete(`/api/owner/stores/${storeId}/${video ? 'videos' : 'photos'}/${photo.uuid}`); setMessage(`${label}을 삭제했어요.`); onSaved(); }
    catch { setMessage(`${label}을 삭제하지 못했어요. 다시 시도해 주세요.`); }
    finally { setBusy(false); }
  };
  return <section className="photo-manager stack" aria-label={`${menu ? '메뉴' : '매장'} ${label} 관리`}>
    {portrait && <h3>사장님 소개 사진</h3>}
    {!menu && <div className="section-head"><h3>매장 {label}</h3><span>{photos.length}/{max}개</span></div>}
    {photos.length > 0 && <div className="photo-grid">{photos.map((photo) => <div className="photo-tile" key={photo.uuid}>
      {video ? <video src={photoUrl(photo.url)} controls playsInline preload="metadata" aria-label="등록한 동영상" /> : <img src={photoUrl(photo.url)} alt={portrait ? '등록한 사장님 사진' : menu ? '등록한 메뉴 사진' : '등록한 매장 사진'} loading="lazy" />}
      <button type="button" disabled={busy || disabled} onClick={() => remove(photo)} aria-label={`${label} 삭제`}><Icon name="delete" />삭제</button>
    </div>)}</div>}
    <label className={`photo-upload${busy || disabled || (!menu && photos.length >= max) ? ' photo-upload--disabled' : ''}`}>
      <Icon name={video ? 'video_library' : 'add_photo_alternate'} />{busy ? `${label}을 저장하고 있어요…` : `${portrait ? '사장님 소개' : menu ? '음식·메뉴' : '매장'} ${label} ${menu && photos.length ? '변경' : '추가'}`}
      <input type="file" accept={video ? 'video/mp4,video/webm' : 'image/jpeg,image/png,image/webp'} disabled={busy || disabled || (!menu && photos.length >= max)} onChange={upload} />
    </label>
    <small className="photo-help">{video ? 'MP4 · WEBM / 한 개당 50MB 이하 · MP4는 H.264 영상 권장' : 'JPG · PNG · WEBP / 한 장당 10MB 이하'}</small>
    {!video && !portrait && <details className="photo-examples">
      <summary><Icon name="collections" />예시 이미지 보기</summary>
      <p className="photo-help">간판·가게·음식·옷·다리미 예시예요. 원하는 사진을 골라 등록해 보세요.</p>
      <div className="photo-example-grid">{EXAMPLES.map(([name, title]) => <div className="photo-example-card" key={name}>
        <img src={exampleUrl(name)} alt={`${title} 예시`} loading="lazy" />
        <strong>{title}</strong>
        <button type="button" disabled={busy || disabled || (!menu && photos.length >= max)} onClick={() => useExample(name)}>{title} 예시 등록</button>
        <a href={exampleUrl(name)} download={`${name}-example.png`}>이미지 다운로드</a>
      </div>)}</div>
      <small className="photo-help">AI로 만든 예시 이미지입니다.</small>
    </details>}
    {message && <p role="status">{message}</p>}
  </section>;
}
