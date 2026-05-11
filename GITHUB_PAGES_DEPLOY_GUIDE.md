# 가톨릭길동무 V37 - GitHub Pages 배포용

## 기준
- 기준 파일: V37 안정판
- 변경 목적: Netlify 의존 없이 GitHub Pages에서 정적 PWA로 배포
- 앱 기능 변경 없음
- 웹사이트 진입 변수 오류 수정 상태 유지

## 업로드 방법
1. 이 zip 안의 파일을 GitHub 저장소 루트에 업로드합니다.
2. `index.html`이 저장소 루트에 있어야 합니다.
3. `.nojekyll` 파일도 함께 올립니다.
4. GitHub 저장소에서 Settings → Pages로 이동합니다.
5. Source를 `Deploy from a branch`로 선택합니다.
6. Branch는 `main`, Folder는 `/root`로 선택합니다.

## 카카오 지도 JavaScript Key
카카오 JavaScript Key는 브라우저에서 실행되므로 완전히 숨길 수 없습니다.
대신 카카오 개발자센터에서 허용 도메인을 제한해야 합니다.

등록할 도메인 예시:
- `https://bong0219.github.io`
- 커스텀 도메인을 쓰면 `https://사용도메인.com`

저장소 경로까지가 아니라 보통 origin 기준 도메인을 등록합니다.

## GitHub에 올리면 안 되는 키
다음은 저장소에 올리지 마세요.

- 카카오 Admin Key
- 서버용 Secret Key
- Firebase service account JSON
- Netlify token
- GitHub token
- 관리자/결제/서버 권한 키

카카오 지도 JavaScript Key는 도메인 제한을 걸고 사용할 수 있습니다.

## 배포 후 확인
1. 첫 화면이 열리는지
2. 매일미사·기도문·성가 팝업이 정상인지
3. 가톨릭 웹사이트 화면이 정상인지
4. 성당 교구 라벨이 정상인지
5. 지도 API가 열리는지
6. PWA 설치가 가능한지
7. 새로고침 후 최신 버전 V37가 보이는지

## 중요
GitHub Pages로 도메인이 바뀌면 카카오 개발자센터의 Web 플랫폼 도메인 등록을 반드시 바꿔야 합니다.
도메인 등록이 맞지 않으면 지도는 열리지 않습니다.
