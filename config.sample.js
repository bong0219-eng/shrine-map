// config.sample.js
// 실제 사용 시 이 파일을 config.js로 복사한 뒤 값을 입력하세요.
// 공개 저장소에는 실제 config.js를 올리지 마세요.
// V20: 카카오 REST API 키는 앱에 넣지 않고 Cloudflare Worker Secret에 저장합니다.

window.APP_CONFIG = {
  KAKAO_JS_KEY: 'YOUR_KAKAO_JAVASCRIPT_KEY',
  KAKAO_REST_PROXY_URL: 'https://kakao-rest-proxy.bong0219.workers.dev'
};
