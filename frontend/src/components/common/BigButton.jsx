const BigButton = ({ label, onClick, type = 'button', disabled = false }) => {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className="big-button">
      {label}
    </button>
  );
};

export default BigButton;
