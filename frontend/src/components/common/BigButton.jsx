import Icon from './Icon';
import Spinner from './Spinner';

// 큰 글씨/큰 터치 영역 버튼
// props
//  - label | children : 버튼 글자 (둘 중 하나)
//  - variant : primary(기본) | secondary | danger | dangerOutline | info | plain
//  - size    : default(64px) | md(68px) | lg(76px) | sm(56px)
//  - icon    : Material Symbols 아이콘 이름 (글자와 항상 같이 표시)
//  - loading : true 면 스피너 + loadingLabel 표시, 클릭 막힘
//  - disabled: 비활성. "왜 못 누르는지"를 label 글자로 알려주세요 (예: "메뉴를 골라주세요")
const VARIANT_CLASS = {
  primary: 'btn--primary',
  secondary: 'btn--secondary',
  danger: 'btn--danger',
  dangerOutline: 'btn--danger-outline',
  info: 'btn--info',
  plain: 'btn--plain',
};

const SIZE_CLASS = { md: 'btn--md', lg: 'btn--lg', sm: 'btn--sm' };

const BigButton = ({
  label,
  children,
  onClick,
  type = 'button',
  variant = 'primary',
  size = 'default',
  icon,
  loading = false,
  loadingLabel = '처리중이에요…',
  disabled = false,
  className = '',
  ...rest
}) => {
  const classes = [
    'btn',
    VARIANT_CLASS[variant] || VARIANT_CLASS.primary,
    SIZE_CLASS[size],
    loading ? 'btn--loading' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      type={type}
      className={classes}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <>
          <Spinner />
          {loadingLabel}
        </>
      ) : (
        <>
          {icon && <Icon name={icon} />}
          {children ?? label}
        </>
      )}
    </button>
  );
};

export default BigButton;
