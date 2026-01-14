# 🔐 Monad ID 연동 가이드 (개발자용)

안녕하세요! **Monad ID**를 사용해 주셔서 감사합니다.
이 가이드는 여러분의 서비스에 학교/동아리 통합 로그인을 가장 쉽고 빠르게 붙이는 방법을 설명합니다.

어렵게 생각하지 마세요! **"로그인 버튼 만들기 → 코드 받기 → 토큰으로 바꾸기"** 이 3단계면 끝납니다.

---

## 🚀 1분 요약 (Quick Start)

가장 많이 사용하는 **Next.js (App Router)** 기준으로, 바로 복사해서 쓸 수 있는 코드를 준비했습니다.

### 1단계: 로그인 버튼 만들기 (`/app/login/page.tsx`)

```tsx
import crypto from "crypto";
import { redirect } from "next/navigation";

export default function LoginPage() {
  const startLogin = async () => {
    "use server";

    // 1. 보안을 위한 PKCE 코드 생성 (랜덤 난수)
    const verifier = base64URLEncode(crypto.randomBytes(32));
    const challenge = base64URLEncode(
      crypto.createHash("sha256").update(verifier).digest()
    );
    const state = base64URLEncode(crypto.randomBytes(16));

    // 2. 나중에 검증하기 위해 쿠키에 임시 저장 (실제론 암호화 추천)
    // cookies().set('verifier', verifier);
    // cookies().set('state', state);

    // 3. Monad ID 로그인 페이지로 이동
    const params = new URLSearchParams({
      client_id: "MY_APP_ID", // 관리자에게 받은 ID
      redirect_uri: "http://localhost:3000/callback", // 등록한 주소
      response_type: "code",
      scope: "email name profile", // 필요한 정보
      state: state,
      code_challenge: challenge,
      code_challenge_method: "S256",
    });

    redirect(`https://id.monad.io.kr/authorize?${params}`);
  };

  return (
    <form action={startLogin}>
      <button type="submit">Monad ID로 로그인</button>
    </form>
  );
}

// 헬퍼 함수
function base64URLEncode(str) {
  return str
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}
```

### 2단계: 로그인 처리하기 (`/app/callback/route.ts`)

로그인이 성공하면 이 주소로 돌아옵니다. 여기서 토큰을 받아오세요.

```ts
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code"); // 인증 코드
  const verifier = "..."; // 아까 쿠키에 저장한 verifier 가져오기

  // 1. 토큰 교환 요청 (Monad ID 서버에게)
  const tokenRes = await fetch("https://id.monad.io.kr/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: "MY_APP_ID",
      redirect_uri: "http://localhost:3000/callback",
      code,
      code_verifier: verifier, // PKCE 검증
    }),
  });

  const { access_token } = await tokenRes.json();

  // 2. 사용자 정보 가져오기
  const userRes = await fetch("https://id.monad.io.kr/api/me", {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  const userData = await userRes.json();
  console.log("로그인 성공!", userData);

  // 3. 내 서비스의 세션 생성 후 메인으로 이동
  return NextResponse.redirect(new URL("/dashboard", req.url));
}
```

---

## 📚 상세 설명 (Details)

혹시 직접 구현하거나 다른 언어(Python, Java 등)를 쓰신다면 아래 스펙을 참고하세요.

### 기본 정보

- **인증 방식:** OAuth 2.0 Authorization Code Flow
- **보안:** PKCE (Proof Key for Code Exchange) 필수 (보안을 위해 꼭 필요해요!)
- **Base URL:** `https://id.monad.io.kr`

### API 엔드포인트

| 이름              | URL          | 설명                                           |
| :---------------- | :----------- | :--------------------------------------------- |
| **로그인 페이지** | `/authorize` | 사용자를 여기로 리다이렉트 시키세요.           |
| **토큰 발급**     | `/api/token` | (POST) 코드를 주고 토큰을 받아오는 곳입니다.   |
| **내 정보**       | `/api/me`    | (GET) 토큰을 주고 사용자 정보를 묻는 곳입니다. |

### 권한 목록 (Scope)

어떤 정보를 가져올지 정할 수 있습니다. `scope` 파라미터에 공백으로 띄워서 넣으세요.

- `profile` 👉 기본 정보 (아이디, 닉네임, 프로필 사진)
- `email` 👉 이메일 주소 (필수)
- `name` 👉 사용자 실명
- `type` 👉 소속 (동아리원 `monad` / 일반 `dimigo` 등)

---

## ❓ 자주 묻는 질문 (FAQ)

**Q. `client_id` redirect_uri` Mismatch 오류가 떠요!**
A. 개발 서버(`localhost`) 주소도 관리자에게 미리 등록해야 합니다. **포트 번호(3000)**나 **http/https** 여부, **맨 뒤 슬래시(/)** 까지 정확히 일치해야 합니다!

**Q. `PKCE verification failed` 오류가 떠요!**
A. 처음 로그인 페이지로 보낼 때 만든 `verifier`와, 나중에 토큰 요청할 때 보낸 `code_verifier`가 똑같은지 확인하세요. (보통 쿠키나 세션에 저장해두고 꺼내 써야 합니다.)

---

도움이 필요하면 언제든 @관리자 에게 연락주세요! 🚀
