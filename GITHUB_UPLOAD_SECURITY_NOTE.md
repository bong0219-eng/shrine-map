# GitHub 업로드 기준

## 올려도 되는 파일
이 zip 안의 파일은 기본적으로 GitHub 업로드용으로 정리되어 있습니다.

## 올리면 안 되는 파일
아래 파일은 있으면 올리지 마세요.

- config.js
- .env
- .env.*
- serviceAccount.json
- firebase-service-account.json
- service-account.json
- private-key.json
- admin-key.json
- secret.json
- token.json
- github-token.txt
- netlify-token.txt
- *.pem
- *.p12
- *.key

## 현재 패키지 점검 결과
- index.html 안에 KAKAO_REST_KEY 없음
- app.js 안에 KAKAO_REST_KEY 없음
- 실제 REST Key 값 없음
- config.sample.js만 있음
