const HttpError = require('./httpError');

const DECIMAL_PATTERN = /^-?\d+(\.\d+)?$/;

// { } 형태의 일반 객체인지 (배열, null, 문자열 등은 false)
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// 경로의 :id → 양의 정수만 허용. "1.0", "0x1", "01", "abc" 같은 값은 null (= 없는 대상으로 취급)
function parseId(raw) {
  if (typeof raw !== 'string' || !/^[1-9]\d*$/.test(raw)) return null;
  const id = Number(raw);
  return Number.isSafeInteger(id) ? id : null;
}

// 선택 문자열 쿼리. 없거나 공백뿐이면 undefined, 같은 키를 여러 번 보내 배열이 되면 400
function optionalQueryString(query, key) {
  const raw = query[key];
  if (raw === undefined) return undefined;
  if (typeof raw !== 'string') {
    throw new HttpError(400, `Invalid query parameter: ${key}`);
  }
  const value = raw.trim();
  return value === '' ? undefined : value;
}

// lat/lng 쿼리. 둘 다 없으면 {}, 하나만 있거나 숫자·범위가 틀리면 400
function parseLocation(query) {
  if (query.lat === undefined && query.lng === undefined) return {};
  if (query.lat === undefined || query.lng === undefined) {
    throw new HttpError(400, 'lat and lng must be provided together');
  }

  const parse = (key, limit) => {
    const raw = query[key];
    if (typeof raw !== 'string' || !DECIMAL_PATTERN.test(raw.trim())) {
      throw new HttpError(400, `Invalid query parameter: ${key}`);
    }
    const value = Number(raw.trim());
    if (Math.abs(value) > limit) {
      throw new HttpError(400, `Invalid query parameter: ${key}`);
    }
    return value;
  };

  return { lat: parse('lat', 90), lng: parse('lng', 180) };
}

module.exports = { isPlainObject, parseId, optionalQueryString, parseLocation };
