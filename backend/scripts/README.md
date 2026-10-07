# 관리자 계정 추가 및 승격

서버 콘솔에서 환경변수 `CALAR_ADMIN_EMAIL`, `CALAR_ADMIN_PASSWORD`를 설정하고
`backend` 폴더에서 `npm run admin:provision`을 실행합니다.
운영 DB 경로가 다르면 `CALAR_DB_PATH`도 서버와 같은 값으로 설정하세요.

```powershell
$env:CALAR_ADMIN_EMAIL = 'admin@example.com'
$env:CALAR_ADMIN_PASSWORD = '<관리자 비밀번호>'
npm.cmd run admin:provision
Remove-Item Env:CALAR_ADMIN_PASSWORD
Remove-Item Env:CALAR_ADMIN_EMAIL
```

계정이 없으면 생성하며, 기존 계정은 관리자 권한으로 승격하고 활성화합니다.
명시적으로 스크립트를 실행하면 비밀번호를 지정한 값으로 변경하고 기존 세션을 종료합니다.
비밀번호는 해시로 저장되며 로그에 출력하지 않습니다.

호스팅 서버의 환경변수에 두 값을 설정하면 `npm start` 시에도 계정 생성 및 승격이
자동 적용됩니다. 서버 시작 시에는 기존 계정의 비밀번호와 세션을 유지합니다.
초기 설정 후에는 호스팅 설정에서 비밀번호 환경변수를 제거할 수 있습니다.
