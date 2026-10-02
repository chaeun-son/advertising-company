# CRESORA Studio

Create · Manage · Deliver

주문, 편집실, 영상편집실을 한 화면에서 쓰는 프로그램입니다.

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:8080` 을 엽니다.

## 환경변수

`.env.example` 을 참고해 Vercel 프로젝트 설정에만 넣습니다. 키는 GitHub에 올리지 않습니다.

- `DATABASE_URL` 주문·직원 저장. 기존 데이터베이스를 그대로 씁니다. 초기화하지 않습니다.
- `BETTER_AUTH_URL` 지금 공개 주소. 예: `https://studio.chaeun-makearoad.com`
- `AUTH_TRUSTED_ORIGINS` 인증을 허용할 주소. 쉼표로 구분. 예: `https://studio.chaeun-makearoad.com,https://chaeun-makearoad.com,https://www.chaeun-makearoad.com`
- `BETTER_AUTH_SECRET` 로그인 서명
- `BLOB_READ_WRITE_TOKEN` 사용자 음악 파일 저장. 없으면 운영 환경에서 업로드가 거절됩니다.
- `XAI_API_KEY` 또는 `OPENAI_API_KEY` 선택. 없어도 검수·시안·영상감독은 동작합니다.

## 배포

Vercel에서 이 프로젝트의 Framework는 Other, Build Command는 `npm run build` 입니다.
도메인은 환경변수로만 붙입니다. 코드에 호스트를 적지 않습니다.

지금: `studio.chaeun-makearoad.com`
나중에 같은 배포에 추가: `chaeun-makearoad.com`, `www.chaeun-makearoad.com`

메인 도메인으로 옮길 때는 DNS만 이 배포로 향하게 하고, `BETTER_AUTH_URL`을 대표 주소로, `AUTH_TRUSTED_ORIGINS`에 세 주소를 모두 넣습니다. 데이터베이스는 바꾸지 않습니다.
