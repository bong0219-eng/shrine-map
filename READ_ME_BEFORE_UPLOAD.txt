V37 GitHub 업로드 패키지

이 압축파일의 내용은 GitHub 저장소에 업로드해도 되는 파일들입니다.

절대 같이 올리지 말아야 할 파일:
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
- *.crt

Cloudflare Worker 코드는 별도 압축파일 V37_Cloudflare_Worker.zip에 넣었습니다.
Worker 코드는 GitHub에 올려도 되지만, 실제로는 Cloudflare Worker 코드 편집기에 붙여넣고 배포하는 용도입니다.
