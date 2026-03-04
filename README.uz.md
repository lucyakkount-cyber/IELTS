# Quantum VRM - O'zbek Hujjatlari

## Umumiy ma'lumot
Quantum VRM - bu Vue + Three.js + VRM + Gemini Live Audio asosidagi real vaqtli 3D avatar yordamchi tizimi.

Asosiy imkoniyatlar:

- jonli ovozli muloqot
- avatar animatsiyalari va yuz ifodalari
- ixtiyoriy kamera/ekran ko'rish vositalari
- xavfsizlik hisobot oqimi
- ko'p tilli UI (English, Uzbek, Russian)

## Yangi funksiyalar (joriy holat)

- To'liq UI i18n va Settings ichida til tanlash.
- UI ichida lokalizatsiyalangan built-in personlar.
- AI tili qattiq majburiy emas, tavsiya sifatida beriladi.
- Built-in persona promptlari AI'ga ingliz tilida yuboriladi (barqaror xulq uchun).
- Animatsiya yuklash yaxshilangan:
  - katalog orqali yuklash
  - progress bilan batch yuklash
  - fon rejimida yuklash
  - local-first + remote fallback
  - nom bo'yicha lazy yuklash

## Talablar

- Node.js `^20.19.0 || >=22.12.0`
- npm
- Gemini API kaliti

## O'rnatish va ishga tushirish

### 1) Kutubxonalarni o'rnatish

```bash
npm install
```

### 2) `.env` sozlash

Minimal talab:

```env
VITE_API_KEY=your_gemini_key
```

Telegram relay sozlamalari ixtiyoriy, lekin tokenlarni hech qachon repoga joylamang.

### 3) Development rejimi

```bash
npm run dev
```

### 4) Production build

```bash
npm run build
```

### 5) Production preview

```bash
npm run preview
```

## Test qilish bo'yicha aniq yo'riqnoma

### Avtomatik tekshiruvlar

Lint:

```bash
npm run lint
```

Build:

```bash
npm run build
```

Agar repoda oldindan mavjud, sizga aloqasiz lint xatolar bo'lsa, fokuslangan lint ishlating:

```bash
npx eslint src/App.vue src/components/*.vue managers/index.js managers/animationManager.js src/i18n/ui.js
```

### Manual smoke test checklist

1. App ochiladi va loader 100% ga yetadi.
2. Standart avatar chiqadi yoki custom VRM to'g'ri yuklanadi.
3. Voice session connect/disconnect ishlaydi.
4. Settings ichida tilni o'zgartirib, UI matnlari yangilanishini tekshiring.
5. Personani almashtirib reconnect qiling, xulq yangilanishini tekshiring.
6. Animatsiyalarni ishga tushirib idle'ga qaytishini tekshiring.
7. Camera/screen opsiyalarini yoqib-o'chirib xulqni tekshiring.
8. Chat panelida transkript va vaqt ko'rsatkichlarini tekshiring.

## Animatsiyalarni boshqarish

### Animatsiyalar qayerda berilgan

- Fayl: `managers/animationManager.js`
- Katalog metodi: `getAnimationCatalog()`
- Asset yo'li: `public/animations/*.vrma`

### Built-in animatsiya nomlari

- `HappyIdle`
- `wave`
- `Macarena_dance`
- `dance`
- `clap`
- `thumbs_up`
- `shrug`
- `pointing`
- `laugh`
- `salute`
- `angry`
- `backflip`
- `acknowledging`
- `blow_kiss`
- `bored`
- `looking_around`
- `cutthroat`

### Yangi animatsiya qo'shish

1. `.vrma` faylni `public/animations/` ichiga joylang.
2. `getAnimationCatalog()` ichiga yangi entry qo'shing:
   - `name`
   - `path`
   - `loop`
3. `triggerNamedAnimation('your_name')` orqali test qiling.
4. Tekshiruv:
   - clip to'g'ri yuklandimi
   - to'g'ri ijro bo'ldimi
   - non-loop tugagach idle'ga qaytdimi

### Yuz ifodalari (expressions)

- `set_expression` tool orqali expression nomlari beriladi.
- Davomiylik qo'llab-quvvatlanadi (odatda 3s dan 10s gacha).
- Vaqt tugaganda neutral holatga qaytadi.

## Persona boshqaruvi

- Built-in personlar UI'da lokalizatsiyalangan tizim personalaridir.
- Built-in personlarni edit/delete qilib bo'lmaydi.
- User yaratgan personlarni edit/delete qilish mumkin.
- Built-in promptlar AI'ga ingliz tilida yuboriladi.
- Custom persona promptlari foydalanuvchi yozgan ko'rinishida yuboriladi.

## Til xulqi

- UI `en`, `uz`, `ru` tillari o'rtasida almashadi.
- Til tanlash Settings ichida.
- AI til tavsiyasi inglizcha instruktsiya sifatida yuboriladi.
- Bu soft qoida: AI tanlangan tilni afzal ko'radi, lekin foydalanuvchi tili o'zgarsa moslashadi.

## Muhim fayllar

- `src/App.vue` - asosiy holat, til/persona/session oqimi
- `src/i18n/ui.js` - UI tarjimalari va language hint builderlar
- `managers/index.js` - runtime orchestration va system prompt yig'ish
- `managers/animationManager.js` - animatsiya/ifoda logikasi
- `src/components/SettingsPanel.vue` - settings UI (til, scale, vision)
- `src/components/PersonaManagerDialog.vue` - persona boshqaruvi UI
