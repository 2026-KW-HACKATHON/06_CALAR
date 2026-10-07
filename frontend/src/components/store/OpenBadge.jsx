// 영업 상태 뱃지: 색 + 모양(점) + 글자 3중 표시 (색을 구분 못 해도 알 수 있게)
// 정보 표시 전용이라 누를 수 없습니다.
// status 는 백엔드가 계산해서 내려주는 'open' | 'closed' 값을 그대로 씁니다.
const OpenBadge = ({ status, large = false }) => {
  const open = status === 'open';

  return (
    <span className={`badge badge--${open ? 'open' : 'closed'}${large ? ' badge--lg' : ''}`}>
      <span className="badge__dot" aria-hidden="true" />
      {open ? '영업중' : '영업종료'}
    </span>
  );
};

export default OpenBadge;
