const CallButton = ({ phoneNumber }) => {
  if (!phoneNumber) return null;

  return (
    <a href={`tel:${phoneNumber}`}>
      <button type="button">전화 걸기</button>
    </a>
  );
};

export default CallButton;
