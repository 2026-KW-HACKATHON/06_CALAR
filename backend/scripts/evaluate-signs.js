// 간판 사진 인식률 확인 (실제 휴대폰 사진 검증용)
//
// 사용: npm run evaluate:signs -- <사진 폴더>
// 파일 이름으로 정답을 정한다
//   3_햇살미용실_정면.jpg → 3번 가게로 인식돼야 함
//   x_다른가게.jpg        → 어느 가게로도 인식되면 안 됨
//   그 밖의 이름           → 결과만 출력
// 서버와 같은 경로(image-proc 전처리 → OCR → 가게 매칭)로 인식하며, 가게 목록은 서버 DB(CALAR_DB_PATH)를 읽는다.
const fs = require('fs');
const path = require('path');
const signRecognizer = require('../services/signRecognizer');
const { matchStoresByText } = require('../services/storeService');

function expectedIds(file) {
  const match = /^(\d+|x)[_-]/i.exec(file);
  if (!match) return null;
  return match[1].toLowerCase() === 'x' ? [] : [Number(match[1])];
}

async function main() {
  const dir = process.argv[2];
  if (!dir || !fs.statSync(dir, { throwIfNoEntry: false })?.isDirectory()) {
    console.error('사용: npm run evaluate:signs -- <사진 폴더>');
    process.exitCode = 2;
    return;
  }

  const files = fs.readdirSync(dir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
  let graded = 0;
  let correct = 0;
  for (const file of files) {
    const buffer = fs.readFileSync(path.join(dir, file));
    const expected = expectedIds(file);
    const started = Date.now();
    let line;
    try {
      const text = await signRecognizer.extractText(buffer, { until: (partial) => matchStoresByText(partial).length > 0 });
      const ids = matchStoresByText(text).map((store) => store.id);
      const ms = Date.now() - started;
      let mark = '·';
      if (expected) {
        graded += 1;
        // 정답 가게가 첫 번째 후보이면 성공 (다른 가게 간판은 후보가 없어야 성공)
        const ok = expected.length ? ids[0] === expected[0] : ids.length === 0;
        if (ok) correct += 1;
        mark = ok ? 'O' : 'X';
      }
      line = `${mark} ${file}  →  [${ids.join(', ')}]  ${ms}ms  "${text.replace(/\s+/g, ' ').trim().slice(0, 60)}"`;
    } catch (error) {
      if (expected) graded += 1;
      line = `X ${file}  →  오류 ${error.status ?? ''} ${error.message}`;
    }
    console.log(line);
  }
  if (graded) console.log(`\n정답 ${correct}/${graded} (${((correct / graded) * 100).toFixed(0)}%)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => signRecognizer.shutdown());
