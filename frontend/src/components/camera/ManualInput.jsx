import { useState } from 'react';
import BigButton from '../common/BigButton';
import { MessageBox } from '../common/StateBox';
import StoreCard from '../store/StoreCard';
import { getStores } from '../../services/storeService';

// 카메라/QR 인식이 어려운 사용자를 위한 수동 검색
// props
//  - onSelect(store) : 검색 결과 카드를 눌렀을 때
const ManualInput = ({ onSelect }) => {
  const [keyword, setKeyword] = useState('');
  const [searched, setSearched] = useState(null); // 마지막으로 검색한 단어 (null 이면 아직 검색 전)
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  const trimmed = keyword.trim();

  const search = async () => {
    if (!trimmed || loading) return;
    setLoading(true);
    setFailed(false);
    try {
      const stores = await getStores({ keyword: trimmed });
      setResults(stores);
      setSearched(trimmed);
    } catch (err) {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    search();
  };

  return (
    <>
      <form className="stack" onSubmit={handleSubmit}>
        <label className="field">
          <span className="section-title">가게 이름</span>
          <input
            placeholder="가게 이름을 입력하세요"
            className="input"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
          />
        </label>
        {/* 비활성일 때는 "왜 못 누르는지"를 버튼 글자로 알려줍니다 */}
        <BigButton
          type="submit"
          icon="search"
          disabled={!trimmed}
          loading={loading}
          loadingLabel="검색 중..."
        >
          {trimmed ? '검색' : '가게 이름을 먼저 적어주세요'}
        </BigButton>
      </form>

      {failed && (
        <MessageBox
          tone="error"
          icon="wifi_off"
          title="검색하지 못했어요"
          body="인터넷 연결을 확인한 뒤 다시 눌러주세요."
          actionLabel="다시 시도"
          actionIcon="refresh"
          onAction={search}
          actionLoading={loading}
        />
      )}

      {!loading && !failed && searched !== null && results.length > 0 && (
        <>
          <div className="result-count">찾은 가게 {results.length}곳</div>
          <ul className="store-list">
            {results.map((store) => (
              <li key={store.id}>
                <StoreCard store={store} onClick={onSelect} />
              </li>
            ))}
          </ul>
        </>
      )}

      {!loading && !failed && searched !== null && results.length === 0 && (
        <MessageBox
          tone="empty"
          icon="search_off"
          title={`"${searched}" 가게를 찾지 못했어요`}
          body={
            <>
              이름의 일부만 적어서 다시 찾아보세요.
              <br />
              예: "떡집", "국밥"
            </>
          }
        />
      )}
    </>
  );
};

export default ManualInput;
