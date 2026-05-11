# V20 보안 정리 안내

## 이번 V20에서 실제로 정리한 것

### 1. qa-firebase.html의 클라이언트 관리자 인증 제거
기존 공개 HTML 안에 있던 관리자 인증 방식을 제거했습니다.

제거한 위험 요소:
- `ADMIN_PASSWORD`
- 관리자 인증 입력창
- 공개 앱에서 운영자 답변 등록
- 공개 앱에서 글 삭제

이제 문의·건의 화면은 사용자가 글을 작성하고 목록을 보는 용도로만 사용합니다.

### 2. 운영자 답변 관리 방식 변경
운영자 답변과 글 삭제는 앱 안에서 하지 말고 Firebase 콘솔에서 직접 처리하는 기준입니다.

Firebase 콘솔에서 `qa_posts` 문서의 아래 필드를 수정하면 됩니다.

답변 완료:
- `answer`: 답변 내용
- `answered`: true

답변 대기:
- `answer`: null
- `answered`: false

글 삭제:
- Firebase 콘솔에서 해당 문서를 삭제

### 3. Firestore Rules 예시 추가
`firestore.rules.example` 파일을 추가했습니다.
이 규칙은 공개 앱에서 읽기와 새 글 작성만 허용하고, 수정/삭제는 막는 예시입니다.

반드시 Firebase Console → Firestore Database → Rules에서 직접 적용 여부를 검토하세요.

## 아직 남아 있는 주의사항

### 1. 카카오 JavaScript Key
카카오 JavaScript Key는 브라우저에서 실행되므로 완전히 숨길 수 없습니다.
카카오 개발자센터에서 Web 플랫폼 도메인 제한을 정확히 설정해야 합니다.

GitHub Pages 예:
- `https://bong0219.github.io`

### 2. 카카오 REST Key
정적 GitHub Pages에서는 REST Key도 공개 코드에 있으면 사용자에게 보일 수 있습니다.
현재 앱 기능을 유지하기 위해 V20에서는 REST Key 구조를 제거하지 않았습니다.

더 강한 보안이 필요하면 다음 중 하나를 선택해야 합니다.
- REST Key가 필요한 기능을 제거하거나 단순화
- Cloudflare Worker / Firebase Functions 같은 서버 프록시로 REST 호출 분리
- Netlify Functions 사용

### 3. GitHub에 올리면 안 되는 파일
아래 파일은 절대 업로드하지 마세요.

- `.env`
- `.env.*`
- `serviceAccount.json`
- `firebase-service-account.json`
- `service-account.json`
- `private-key.json`
- `admin-key.json`
- `secret.json`
- `token.json`
- `github-token.txt`
- `netlify-token.txt`
- `*.pem`
- `*.p12`
- `*.key`

## 배포 전 확인

1. `qa-firebase.html`에서 `ADMIN_PASSWORD` 검색 결과가 없어야 합니다.
2. 문의 글 작성이 되는지 확인합니다.
3. Firebase 콘솔에서 답변을 직접 입력한 뒤 앱에 답변이 표시되는지 확인합니다.
4. Firestore Rules를 안전하게 설정합니다.
5. 카카오 개발자센터에 GitHub Pages 도메인을 등록합니다.
