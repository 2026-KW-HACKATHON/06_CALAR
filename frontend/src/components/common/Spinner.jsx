// 로딩 스피너 (글자색을 따라 색이 바뀝니다)
const Spinner = ({ large = false }) => (
  <span className={`spinner${large ? ' spinner--lg' : ''}`} aria-hidden="true" />
);

export default Spinner;
