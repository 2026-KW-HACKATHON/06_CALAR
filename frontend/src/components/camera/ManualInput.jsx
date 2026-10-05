import { useState } from 'react';
import { getStores } from '../../services/storeService';

// 카메라/QR 인식이 어려운 사용자를 위한 수동 검색
const ManualInput = ({ onSelect }) => {
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!keyword.trim()) return;
    setLoading(true);
    try {
      const stores = await getStores({ keyword });
      setResults(stores);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <input
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
        placeholder="가게 이름을 입력하세요"
      />
      <button onClick={handleSearch}>검색</button>

      {loading && <p>검색 중...</p>}

      <ul>
        {results.map((store) => (
          <li key={store.id}>
            <button onClick={() => onSelect(store)}>{store.name}</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ManualInput;
