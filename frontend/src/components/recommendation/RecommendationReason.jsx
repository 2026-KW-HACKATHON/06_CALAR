// 백엔드가 내려주는 reason 필드(예: "새로 오픈했어요")를 그대로 표시합니다.
const RecommendationReason = ({ reason }) => {
  if (!reason) return null;
  return <p>{reason}</p>;
};

export default RecommendationReason;
