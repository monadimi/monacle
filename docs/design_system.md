# Monad ID Design System & Philosophy 🎨

디자인 철학은 **"신뢰감"**과 **"현대적인 미학"**의 조화입니다.

---

## 1. Core Config (Identity)

### 🔮 The "Aurora Mesh" Theme

우리의 시그니처 배경입니다. 정적인 단색 배경을 거부합니다.

- **살아있는 배경:** 은은하게 움직이는 그라데이션(Mesh Gradient)을 통해 서비스가 살아있음을 표현합니다.
- **Aurora Elements:** `Indigo`, `Violet`, `Blue` 계열의 몽환적인 색상이 섞이며, 창의적이고 미래지향적인 "Monad" 동아리의 정체성을 나타냅니다.

### 🧊 Glassmorphism (유리 질감)

모든 컨테이너는 불투명한 벽돌이 아닌, **"반투명한 유리"**입니다.

- `backdrop-blur-xl`: 배경의 오로라가 은은하게 비치도록 하여 깊이감(Depth)을 줍니다.
- `White/80 opacity`: 너무 투명해서 가독성을 해치지 않도록, 80% 이상의 흰색 불투명도를 유지합니다.

---

## 2. Color Palette (Monochromatic Minimalism)

메인 컬러는 화려하지만, UI 요소는 **철저히 절제**합니다.
오로라 배경이 이미 화려하기 때문에, 콘텐츠는 `Slate` (회색조) 계열로 차분하게 눌러줍니다.

- **Primary (Action):** `Indigo-600` (#4F46E5)
  - 확실한 행동 유도(Call to Action)에만 사용합니다.
- **Text (Hierarchy):**
  - **Info:** `Slate-900` (검정에 가까운 진한 회색)
  - **Body:** `Slate-600` (편안한 본문)
  - **Sub:** `Slate-400` (보조 설명, 작고 굵게 `uppercase` 처리)
- **Semantic:**
  - **Success:** `Green-500` 대신 채도가 낮은 `Emerald`
  - **Error:** `Red-500` 대신 부드러운 `Rose`

---

## 3. Typography & Shape

### 🔠 Inter (Font)

시스템 폰트로 구글의 **Inter**를 사용합니다.

- **Tracking:** 소제목(Label)에는 자간을 넓게(`tracking-widest`) 주어 고급스러움을 더합니다.

### 🟣 Soft Corners (Rounded)

날카로운 모서리는 없습니다.

- **Container:** `rounded-[2.5rem]` (아주 둥근 모서리)를 사용하여 친근하고 유기적인 느낌을 줍니다.
- **Button/Input:** `rounded-2xl`로 통일하여 일관성을 줍니다.

---

## 4. Micro-Interactions (Motion)

사용자 경험의 완성은 움직임에 있습니다.

- **Fade In:** 모든 페이지 전환은 부드럽게 페이드인 됩니다. 깜빡임은 없습니다.
- **Hover Scale:** 버튼에 마우스를 올리면 미세하게 커지거나(`scale-[1.02]`), 그림자가 깊어집니다.
- **Loading:** 로딩은 지루하지 않아야 합니다. 전체 화면 블러 처리와 함께 숨쉬는 듯한(`animate-pulse`) 텍스트를 사용합니다.

---

## 5. Components Guide (For Developers)

새로운 UI를 만들 때 이 규칙을 지켜주세요.

**1. Card (컨테이너)**

```tsx
<div className="bg-white/80 backdrop-blur-xl border border-white/60 shadow-2xl shadow-indigo-500/10 rounded-[2.5rem] p-8">
  {/* Content */}
</div>
```

**2. Primary Button (중요 버튼)**

```tsx
<button className="bg-slate-900 text-white hover:bg-black active:scale-[0.98] transition-all rounded-2xl h-14 font-bold shadow-lg shadow-slate-900/20">
  Action
</button>
```

**3. Input Field (입력창)**

```tsx
<input className="bg-slate-50 border border-slate-100 focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all rounded-2xl h-14 px-6 font-bold text-slate-900" />
```
