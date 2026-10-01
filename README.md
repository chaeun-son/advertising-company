# 애드스마일 작업실

주문, 편집실, 영상편집실을 한 화면에서 쓰는 내부 프로그램입니다. 기존 `chaeun-makearoad.com` 사이트와는 별도 프로젝트입니다.

## 로컬 실행

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:8080` 을 엽니다.

## 환경변수

`.env.example` 을 참고해 Vercel 프로젝트 설정에만 넣습니다. 키는 GitHub에 올리지 않습니다.

- `DATABASE_URL` 주문·직원 저장
- `BETTER_AUTH_URL` `https://studio.chaeun-makearoad.com`
- `BETTER_AUTH_SECRET` 로그인 서명
- `XAI_API_KEY` 또는 `OPENAI_API_KEY` 선택. 없어도 검수·시안·영상감독은 동작합니다.

## 배포

Vercel에서 새 프로젝트를 만들고 Framework는 Other, Build Command는 `npm run build` 로 둡니다. 도메인은 배포 후 `studio.chaeun-makearoad.com` 만 연결합니다.
