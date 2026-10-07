import { formatWon } from '../../utils/formatDate';

const MenuList = ({ menu = [] }) => {
  if (menu.length === 0) return null;

  return (
    <section className="stack">
      <div className="section-head">
        <h2 className="section-title">메뉴</h2>
        <span className="section-head__note">{menu.length}개</span>
      </div>
      <ul className="menu-list">
        {menu.map((item) => (
          <li key={item.id} className="menu-list__item">
            <span className="menu-list__name">{item.name}</span>
            <span className="menu-list__price">{formatWon(item.price)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default MenuList;
