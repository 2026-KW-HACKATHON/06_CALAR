const MenuList = ({ menu = [] }) => {
  if (menu.length === 0) return null;

  return (
    <ul>
      {menu.map((item) => (
        <li key={item.id}>
          <span>{item.name}</span>
          <span>{item.price.toLocaleString()}원</span>
        </li>
      ))}
    </ul>
  );
};

export default MenuList;
