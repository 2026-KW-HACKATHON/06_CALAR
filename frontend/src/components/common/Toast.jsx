import Icon from './Icon';

// 처리 결과를 잠깐 알려주는 안내 (예: "수락했어요")
// 부모가 일정 시간 뒤에 toast 를 null 로 바꿔 사라지게 합니다.
const Toast = ({ toast }) => {
  if (!toast) return null;

  return (
    <div role="status" className="toast">
      <Icon name={toast.icon} />
      {toast.message}
    </div>
  );
};

export default Toast;
