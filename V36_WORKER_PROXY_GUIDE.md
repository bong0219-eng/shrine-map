# V37 Cloudflare Worker 연동 안내

## 이번 V37 변경
- 사용자가 새로 올린 index.html / app.js / patches.js / sw-update.js를 기준으로 다시 적용했습니다.
- 공개 앱 코드에서 카카오 REST API 키를 제거했습니다.
- 카카오 REST API 호출은 Cloudflare Worker 주소로 보냅니다.
- 카카오 JavaScript Key는 지도 SDK 로딩에 필요하므로 앱에 남아 있습니다.
- JavaScript Key는 카카오 개발자센터에서 도메인 제한을 걸어 보호하세요.

## 앱 설정

```js
window.APP_CONFIG = {
  KAKAO_JS_KEY: '카카오 JavaScript 키',
  KAKAO_REST_PROXY_URL: 'https://kakao-rest-proxy.bong0219.workers.dev'
};
```

## Worker 업데이트

길찾기 기능까지 유지하려면 이 zip 안의 아래 파일 내용으로 Worker 코드를 교체해야 합니다.

`cloudflare_worker_kakao_rest_proxy_v36.js`

Cloudflare Worker 코드 편집기에 전체 붙여넣고 배포하세요.

## Worker Secret

Cloudflare Worker의 Secret 이름은 정확히 아래와 같아야 합니다.

```text
KAKAO_REST_KEY
```

값은 카카오 REST API 키입니다.

## 테스트

검색 테스트:

```text
https://kakao-rest-proxy.bong0219.workers.dev/?target=keyword&query=성당
```

길찾기 테스트:

```text
https://kakao-rest-proxy.bong0219.workers.dev/?target=directions&origin=128.6,35.8&destination=128.7,35.9&priority=RECOMMEND
```

검색은 `documents`, 길찾기는 `routes`가 나오면 정상입니다.

## 중요

Worker 코드의 `allowedOrigins`에는 실제 배포 도메인이 들어가야 합니다.

GitHub Pages:
`https://bong0219.github.io`

Netlify에서 먼저 테스트하려면 Netlify 주소도 Worker 코드의 `allowedOrigins` 배열에 추가해야 합니다.
