import Icon from './Icon';

// 전화 걸기 버튼. <a><button> 중첩 대신 <a href="tel:"> 하나만 사용합니다. (스크린리더가 두 번 읽는 문제 방지)
// props
//  - phoneNumber : "02-900-1234" 처럼 하이픈이 있어도 됩니다 (tel: 링크에는 숫자만 넣음)
//  - label       : 버튼 글자 (기본 "전화 걸기")
//  - outline     : true 면 작은 테두리 버튼 (점주 요청 카드의 "전화")
const CallButton = ({ phoneNumber, label = '전화 걸기', outline = false }) => {
  if (!phoneNumber) return null;

  const tel = String(phoneNumber).replace(/[^0-9+]/g, '');

  return (
    <a href={`tel:${tel}`} className={`btn ${outline ? 'btn--call-outline' : 'btn--call'}`}>
      <Icon name="call" fill />
      {label}
    </a>
  );
};

export default CallButton;
