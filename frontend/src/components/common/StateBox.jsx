import Icon from './Icon';
import Spinner from './Spinner';
import BigButton from './BigButton';

// 로딩 / 오류 / 결과 없음 화면 공통 박스

// 로딩 중 안내 (스크린리더가 role="status" 로 읽어줌)
export const LoadingBox = ({ children = '불러오는 중…' }) => (
  <div role="status" className="state-loading">
    <Spinner />
    {children}
  </div>
);

// 로딩 중에 자리를 잡아주는 회색 막대 카드
export const SkeletonCard = ({ lines = 2 }) => (
  <div className="skeleton-card" aria-hidden="true">
    <span className="skeleton skeleton--tall skeleton--mid" />
    {Array.from({ length: lines - 1 }).map((_, i) => (
      <span key={i} className={`skeleton${i % 2 === 0 ? ' skeleton--short' : ''}`} />
    ))}
  </div>
);

// 오류(tone="error", role="alert") / 결과 없음(tone="empty") 박스
// body 는 문자열 또는 JSX. 줄바꿈이 필요하면 JSX 로 <br /> 를 넣으세요.
export const MessageBox = ({
  tone = 'error',
  icon,
  title,
  body,
  actionLabel,
  actionIcon,
  onAction,
  actionLoading = false,
  actionLoadingLabel = '다시 불러오는 중…',
}) => (
  <div role={tone === 'error' ? 'alert' : undefined} className={`message-box message-box--${tone}`}>
    {icon && (
      <span className="message-box__icon">
        <Icon name={icon} />
      </span>
    )}
    <div className="message-box__title">{title}</div>
    {body && <div className="message-box__body">{body}</div>}
    {actionLabel && (
      <BigButton
        variant="secondary"
        icon={actionIcon}
        onClick={onAction}
        loading={actionLoading}
        loadingLabel={actionLoadingLabel}
      >
        {actionLabel}
      </BigButton>
    )}
  </div>
);
