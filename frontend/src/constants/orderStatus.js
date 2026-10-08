// 주문 상태 표시용 문구/아이콘 (백엔드 status 값은 영어, 화면에는 한국어로)
// status: pending → accepted → done, 또는 rejected

export const ORDER_STATUS = {
  pending: { label: '확인 대기중', icon: 'schedule' },
  accepted: { label: '수락됨', icon: 'thumb_up' },
  rejected: { label: '거절됨', icon: 'block' },
  done: { label: '완료', icon: 'check_circle' },
};

// 고객 화면(접수/상태)의 상태별 안내 문구. hint 에 {pickup} 이 있으면 픽업 시간으로 바꿔 씁니다.
export const ORDER_STATUS_MESSAGE = {
  pending: {
    headIcon: 'task_alt',
    headTitle: '신청이 접수됐어요!',
    message: '가게에서 주문을 확인하고 있어요',
    hint: '이 화면에서 상태를 볼 수 있어요.',
  },
  accepted: {
    headIcon: 'thumb_up',
    headTitle: '주문이 수락됐어요!',
    message: '가게에서 준비를 시작했어요',
    hint: '{pickup}에 맞춰 가게로 오세요.',
  },
  rejected: {
    headIcon: 'block',
    headTitle: '주문을 받지 못했어요',
    message: '가게 사정으로 받지 못했어요',
    hint: '궁금한 점은 가게에 전화로 물어보세요.',
  },
  done: {
    headIcon: 'check_circle',
    headTitle: '주문이 완료됐어요',
    message: '',
    hint: '이용해 주셔서 고마워요.',
  },
};

// 점주 화면 처리 결과 안내(토스트)
export const OWNER_TOAST = {
  accepted: { icon: 'thumb_up', message: '수락했어요. 준비를 시작해 주세요.' },
  rejected: { icon: 'block', message: '거절했어요.' },
  done: { icon: 'task_alt', message: '완료 처리했어요.' },
  error: { icon: 'error', message: '처리하지 못했어요. 다시 시도해 주세요.' },
};
