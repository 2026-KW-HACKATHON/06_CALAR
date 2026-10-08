import { useCallback, useEffect, useRef, useState } from 'react';

// 서버에서 데이터를 불러오는 공통 훅: 로딩 / 성공 / 오류 상태를 한 번에 관리합니다.
//
//   const { status, data, retrying, reload, refresh } = useFetch(() => getStoreDetail(id), [id]);
//
//  - status   : 'loading' | 'ready' | 'error'
//  - reload() : "다시 시도" 버튼용. 오류 박스는 그대로 두고 버튼 안에서만 스피너가 돕니다 (retrying=true)
//  - refresh(): 화면을 깜빡이지 않고 조용히 새로고침 (처리 후 목록 갱신, 주기적 갱신용). 실패해도 화면은 그대로.
//  - deps     : 값이 바뀌면 다시 불러옵니다 (예: 가게 id, 필터)
//  - keepData : true 면 이미 보이는 데이터를 지우지 않고 다시 불러옵니다 (예: 위치가 늦게 도착할 때)
const useFetch = (fetcher, deps = [], { keepData = false } = {}) => {
  const [state, setState] = useState({ status: 'loading', data: null });
  const [retrying, setRetrying] = useState(false);
  const [tick, setTick] = useState(0);

  const retryRef = useRef(false);
  const silentRef = useRef(false);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher; // 항상 최신 fetcher 를 쓰기 위해

  useEffect(() => {
    let cancelled = false;
    const isRetry = retryRef.current;
    const isSilent = silentRef.current;
    retryRef.current = false;
    silentRef.current = false;

    const keepScreen = (prev) => isSilent || (keepData && prev.status === 'ready');

    setState((prev) => {
      if (isRetry || keepScreen(prev) || prev.status === 'loading') return prev;
      return { status: 'loading', data: null };
    });

    fetcherRef
      .current()
      .then((data) => {
        if (!cancelled) setState({ status: 'ready', data });
      })
      .catch(() => {
        if (!cancelled) setState((prev) => (keepScreen(prev) ? prev : { status: 'error', data: null }));
      })
      .finally(() => {
        if (!cancelled) setRetrying(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => {
    retryRef.current = true;
    setRetrying(true);
    setTick((t) => t + 1);
  }, []);

  const refresh = useCallback(() => {
    silentRef.current = true;
    setTick((t) => t + 1);
  }, []);

  return { status: state.status, data: state.data, retrying, reload, refresh };
};

export default useFetch;
