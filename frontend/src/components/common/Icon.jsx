// Material Symbols 아이콘. name 은 https://fonts.google.com/icons 의 아이콘 이름 (예: "photo_camera")
// 아이콘은 장식이라 스크린리더가 읽지 않게 하고, 뜻은 항상 옆의 글자 라벨이 전달합니다.
const Icon = ({ name, fill = false, size, className = '' }) => (
  <span
    className={`icon${fill ? ' icon--fill' : ''}${className ? ` ${className}` : ''}`}
    style={size ? { fontSize: size } : undefined}
    aria-hidden="true"
  >
    {name}
  </span>
);

export default Icon;
