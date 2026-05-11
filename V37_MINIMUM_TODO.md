# V20 업로드 전 실제로 해야 하는 것만

이 파일 패키지는 앱 코드 안에서 처리할 수 있는 보안 정리는 끝낸 상태입니다.

## 제가 파일에서 이미 처리한 것
- 공개 앱 코드에서 KAKAO_REST_KEY 제거
- Cloudflare Worker 주소 사용
- 문의·건의 관리자 비밀번호 제거 상태 유지
- config.sample.js 제공
- config.js는 .gitignore에 등록
- 버전 V20 적용

## 사용자님이 외부 사이트에서 직접 해야 하는 최소 작업 3개

### 1. Cloudflare Worker 코드 교체
이 zip 안의 파일:
cloudflare_worker_kakao_rest_proxy_v37.js

이 내용을 Cloudflare Worker 코드 편집기에 전체 복사해서 붙여넣고 배포하세요.

### 2. Cloudflare Worker Secret 확인
Worker 설정에서 Secret 이름이 정확히 아래인지 확인하세요.

KAKAO_REST_KEY

값은 카카오 REST API 키입니다.

### 3. 카카오 개발자센터 도메인 등록
GitHub Pages 도메인을 등록하세요.

https://bong0219.github.io

Netlify로 테스트하면 Netlify 주소도 등록해야 합니다.

## Firebase Rules
문의·건의 데이터 보호를 더 강화하려면 firestore.rules.example 내용을 Firebase Console Rules에 적용하세요.
다만 앱 실행 자체는 위 3개가 먼저입니다.
