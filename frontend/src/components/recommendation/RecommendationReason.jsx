import Icon from '../common/Icon';

// 백엔드가 내려주는 reason 필드(예: "새로 오픈했어요")를 그대로 표시합니다.
// reason 이 없으면 아무것도 보여주지 않습니다.
const RecommendationReason = ({ reason }) => {
  if (!reason) return null;

  return (
    <span className="reason">
      <Icon name="lightbulb" />
      {reason}
    </span>
  );
};

export default RecommendationReason;
