# wolgye.kr 배포 (Ubuntu + Nginx)

Node.js 22.5 이상(권장 24 LTS)이 필요합니다. 저장소 전체를 서버에 업로드하고 프로젝트 루트에서 실행합니다. mobileapp은 서버 설치에 포함되지 않습니다.

서버의 backend/.env를 준비하세요. 기존 SMTP/SOLAPI/결제 키는 서버에 별도로 입력하고 Git에 올리지 마세요.
```dotenv
NODE_ENV=production
HOST=127.0.0.1
PORT=8008
CALAR_PUBLIC_URL=https://wolgye.kr
CALAR_DEV_CREDIT=false
CALAR_SESSION_DAYS=90
```
CALAR_DB_PATH를 사용한다면 업데이트로 지워지지 않는 절대 경로를 지정하고 실행 사용자에게 쓰기 권한을 부여하세요. 미지정 시 backend/06_calar.sqlite를 사용합니다. 기존 운영 DB를 덮어쓰지 마세요.

```bash
npm install
npm run start
```
프론트 빌드 후 백엔드가 8008 포트에서 HTML/정적 자산/API를 함께 제공합니다. `npm run`만으로는 실행되지 않으며 `npm run start`를 사용합니다. 개발용 크레딧 충전은 차단됩니다. `npm install --omit=dev`는 프론트 빌드 도구를 설치하지 않으므로 위 방식에서는 사용하지 마세요.

## Nginx / Certbot

wolgye.kr의 DNS A 레코드를 서버 공인 IPv4로 지정합니다. AAAA를 등록했다면 해당 IPv6도 이 서버로 연결돼야 합니다. 서버 방화벽/클라우드 보안그룹에서 TCP 80, 443을 허용합니다. 8008은 외부에 공개하지 않습니다.

```bash
sudo apt update
sudo apt install -y nginx snapd
sudo snap install --classic certbot
sudo ln -sf /snap/bin/certbot /usr/local/bin/certbot
sudo cp deploy/nginx/wolgye.conf /etc/nginx/sites-available/wolgye.kr
sudo ln -sf /etc/nginx/sites-available/wolgye.kr /etc/nginx/sites-enabled/wolgye.kr
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d wolgye.kr --redirect
sudo certbot renew --dry-run
```
Certbot의 이메일/약관 질문에 응답합니다. 기존 Certbot 설치가 있다면 중복 설치 대신 그 설치를 사용하세요. `--nginx`는 HTTP 설정에 인증서를 추가하고 HTTPS 리디렉션을 설정합니다. 인증서 발급 후 완성 형태는 deploy/nginx/wolgye-https.conf를 참고하세요. Certbot Snap은 자동 갱신 작업을 제공합니다.

```bash
curl -I http://127.0.0.1:8008/health
curl -I https://wolgye.kr
curl -I https://wolgye.kr/owner/login
```

터미널 종료/재부팅 후 유지하려면 systemd 같은 프로세스 관리가 필요합니다. 예시 deploy/calar.service에서 사용자/경로/Node 경로를 실제 환경에 맞게 변경한 뒤 등록하세요. 먼저 `npm install`과 빌드를 완료합니다.

```bash
sudo cp deploy/calar.service /etc/systemd/system/calar.service
sudo systemctl daemon-reload
sudo systemctl enable --now calar
sudo journalctl -u calar -f
```

모바일 운영 앱은 mobileapp/.env의 VITE_API_BASE_URL=https://wolgye.kr로 빌드합니다. 이메일 인증/복구 링크와 카카오페이 콜백은 CALAR_PUBLIC_URL을 사용합니다. 카카오페이 개발자센터에도 도메인을 등록하세요.

공식 문서: https://certbot.eff.org/instructions?os=ubuntufocal&ws=nginx
Nginx 프록시: https://nginx.org/en/docs/http/ngx_http_proxy_module.html
