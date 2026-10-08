import { formatWon } from '../../utils/formatDate';
import { photoUrl } from '../../utils/photoUrl';

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
            {item.photo && <img className="menu-photo" src={photoUrl(item.photo.url)} alt={item.name} loading="lazy" />}
            <span className="menu-list__name">{item.name}</span>
            <span className="menu-list__price">{formatWon(item.price)}</span>
          </li>
        ))}
      </ul>
      {menu.filter((item) => item.video).map((item) => <div className="stack" key={item.id}><strong>{item.name} 동영상</strong>
        <video className="store-video" src={photoUrl(item.video.url)} controls autoPlay muted playsInline preload="metadata" aria-label={`${item.name} 동영상`} />
      </div>)}
    </section>
  );
};

export default MenuList;
