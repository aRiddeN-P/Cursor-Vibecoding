# دخلیار (Dakhlyar)

اپلیکیشن مدیریت مالی شخصی به زبان فارسی — Phase 1: احراز هویت (ورود، ثبت‌نام، تایید ایمیل، بازیابی رمز عبور).

این فاز شامل بک‌اند Express، فرانت‌اند Vanilla (موبایل‌فرست، RTL) و مستندات Swagger (فارسی و انگلیسی، اپ و ادمین) است.

English README: [`README.en.md`](README.en.md)

---

## فهرست

- [پیش‌نیازها](#پیش‌نیازها)
- [ساختار پروژه](#ساختار-پروژه)
- [نصب](#نصب)
- [پیکربندی `.env`](#پیکربندی-env)
- [اجرای پروژه](#اجرای-پروژه)
- [مسیرهای صفحات](#مسیرهای-صفحات)
- [مستندات API (Swagger)](#مستندات-api-swagger)
- [Endpoint ها و نمونه‌های `curl`](#endpoint-ها-و-نمونه‌های-curl)
- [قوانین اعتبارسنجی](#قوانین-اعتبارسنجی)
- [قوانین امنیتی](#قوانین-امنیتی)

---

## پیش‌نیازها

- Node.js نسخه ۱۸ یا بالاتر
- npm یا yarn
- یک حساب SMTP (مثلاً Gmail App Password) برای ارسال OTP

---

## ساختار پروژه

```
dakhlyar/
├── server/
│   ├── index.js
│   ├── db/
│   │   ├── appDb.js          ← dakhlyar_app.db
│   │   └── adminDb.js        ← dakhlyar_admin.db
│   ├── routes/auth.js
│   ├── controllers/authController.js
│   ├── middlewares/rateLimiter.js
│   ├── utils/mailer.js
│   └── swagger/
│       ├── swaggerConfig.js  ← مسیرهای پایه OpenAPI
│       ├── specBuilder.js    ← ساخت fa/en + app/admin
│       └── locales/
├── public/
│   ├── index.html            ← صفحه ورود
│   ├── signup.html           ← ویزارد ۳ مرحله‌ای ثبت‌نام
│   ├── css/style.css
│   └── js/
│       ├── login.js
│       └── signup.js
├── .env.example
├── package.json
└── README.md
```

> دو دیتابیس SQLite کاملاً مستقل: `dakhlyar_app.db` (سمت کاربر) و `dakhlyar_admin.db` (پنل ادمین، در فازهای بعد).

---

## نصب

```bash
git clone <repo-url> dakhlyar
cd dakhlyar
npm install
```

پکیج‌های اصلی نصب‌شده:

- `express`, `express-session`
- `better-sqlite3`
- `bcrypt` (rounds: 12)
- `nodemailer`
- `swagger-jsdoc`, `swagger-ui-express`
- `dotenv`

---

## پیکربندی `.env`

فایل `.env.example` را به `.env` کپی کنید و مقادیر را تنظیم کنید:

```bash
cp .env.example .env
```

نمونه `.env`:

```dotenv
PORT=3000
SESSION_SECRET=یک-رشته-طولانی-و-تصادفی-اینجا
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your_app_password
FROM_EMAIL="دخلیار <your@gmail.com>"
APP_DB_PATH=./dakhlyar_app.db
ADMIN_DB_PATH=./dakhlyar_admin.db
```

### راهنمای SMTP با Gmail

1. در حساب گوگل خود 2-Step Verification را فعال کنید.
2. یک **App Password** بسازید: <https://myaccount.google.com/apppasswords>
3. پسورد ۱۶ حرفی تولید‌شده را در `SMTP_PASS` قرار دهید.

---

## اجرای پروژه

```bash
npm start
```

یا با reload خودکار در حالت توسعه:

```bash
npm run dev
```

سرور روی پورت تعریف‌شده (پیش‌فرض ۳۰۰۰) اجرا می‌شود:

```
✅ Dakhlyar server is running at http://localhost:3000
📚 Swagger docs:           http://localhost:3000/api/docs
```

---

## مسیرهای صفحات

| مسیر | توضیح |
|---|---|
| `/` | صفحه ورود کاربر |
| `/signup.html` | ویزارد ۳ مرحله‌ای ثبت‌نام |
| `/forgot-password.html` | ویزارد ۳ مرحله‌ای بازیابی رمز عبور (ایمیل → OTP → رمز جدید) |
| `/dashboard.html` | داشبورد خانه — ارزش کل، خلاصه ماهانه، امتیاز مالی، بازار، تراکنش‌ها، اهداف، بینش |
| `/score.html` | امتیاز مالی — arc بزرگ، تاریخچه ۶ ماهه، تفکیک امتیاز، بینش‌ها، پیشنهاد بهبود |
| `/split.html` | دنگ و دونگ — گروه‌ها، ثبت هزینه، تسویه حساب |
| `/split-view.html` | مشاهده عمومی بدهی (لینک shareable، بدون ورود) |
| `/admin` | پنل مدیریت — ورود، داشبورد و مدیریت سیستم |
| `/admin/login.html` | ورود پنل ادمین (پیش‌فرض: admin / admin — تغییر اجباری در اولین ورود) |
| `/admin/dashboard.html` | داشبورد پنل ادمین |
| `/admin/admins.html` | مدیریت مدیران (فقط سوپر ادمین) |
| `/api/docs` | صفحه راهنمای مستندات API (لینک به ۴ بخش) |
| `/api/docs/fa/app` | Swagger فارسی — API اپ کاربر |
| `/api/docs/fa/admin` | Swagger فارسی — API پنل ادمین |
| `/api/docs/en/app` | Swagger English — User App API |
| `/api/docs/en/admin` | Swagger English — Admin Panel API |

---

## مستندات API (Swagger)

مستندات OpenAPI به **دو بخش** (اپ کاربر / پنل ادمین) و **دو زبان** (فارسی / انگلیسی) تقسیم شده‌اند:

| مسیر | توضیح |
|------|--------|
| `GET /api/docs` | صفحه راهنما با لینک به همه بخش‌ها |
| `GET /api/docs/fa/app` | API اپ — فارسی |
| `GET /api/docs/fa/admin` | API پنل ادمین — فارسی |
| `GET /api/docs/en/app` | User App API — English |
| `GET /api/docs/en/admin` | Admin Panel API — English |

برای هر endpoint مشخص شده است:

- خلاصه و توضیح (فارسی در `/fa/*`، انگلیسی در `/en/*`)
- تمام فیلدهای body با نوع، توضیح، مثال و الزامی بودن
- تمام کدهای پاسخ HTTP با پیام و نمونه پاسخ

> پاسخ‌های واقعی API همچنان به زبان فارسی برمی‌گردند؛ نسخه انگلیسی Swagger فقط برای مستندسازی است.

نسخه انگلیسی README: [`README.en.md`](README.en.md)

---

## Endpoint ها و نمونه‌های `curl`

> برای آن دسته از مسیرهایی که نیاز به session دارند (`register`, `reset-password`) از فلگ `-c cookies.txt` و `-b cookies.txt` برای ذخیره و ارسال کوکی session استفاده کنید.

---

### 1) `POST /api/auth/login` — ورود کاربر

**ورود موفق (200):**

```bash
curl -i -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"mobile":"09121234567","password":"MyPass@123"}'
```

**فرمت شماره موبایل نامعتبر (422):**

```bash
curl -i -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"mobile":"123","password":"x"}'
# { "message": "فرمت شماره موبایل معتبر نیست" }
```

**رمز اشتباه — حساب وجود دارد (401):**

```bash
curl -i -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"mobile":"09121234567","password":"wrong"}'
# { "message": "رمز عبور اشتباه است", "attempts_left": 2 }
```

**شماره موبایل ثبت نشده (404):**

```bash
curl -i -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"mobile":"09999999999","password":"x"}'
# { "message": "حسابی با این شماره موبایل ثبت نشده است" }
```

**حساب قفل شده (423):** پس از ۳ بار تلاش ناموفق در ۱۰ دقیقه:

```bash
for i in 1 2 3 4; do
  curl -s -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"mobile":"09121234567","password":"wrong"}' && echo
done
# آخرین پاسخ:
# { "locked": true, "message": "حساب شما به مدت ۱۰ دقیقه قفل شده است", "remaining_seconds": 600 }
```

---

### 2) `POST /api/auth/check-duplicates` — بررسی تکراری بودن

```bash
curl -i -X POST http://localhost:3000/api/auth/check-duplicates \
  -H "Content-Type: application/json" \
  -d '{"mobile":"09121234567","email":"u@example.com","national_id":"0012345678"}'
# { "mobile_taken": false, "email_taken": true, "national_id_taken": false }
```

---

### 3) `POST /api/auth/send-otp` — ارسال کد تایید به ایمیل

**ارسال موفق (200):**

```bash
curl -i -X POST http://localhost:3000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email":"u@example.com","type":"signup"}'
# { "message": "کد تایید به ایمیل شما ارسال شد" }
```

**ایمیل نامعتبر (422):**

```bash
curl -i -X POST http://localhost:3000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"not-an-email","type":"signup"}'
# { "message": "آدرس ایمیل معتبر نیست" }
```

**حساب یافت نشد — فقط برای `reset_password` (404):**

```bash
curl -i -X POST http://localhost:3000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"unknown@example.com","type":"reset_password"}'
# { "message": "حسابی با این ایمیل یافت نشد" }
```

**خطای ارسال ایمیل (500):**

```bash
# با تنظیمات SMTP غلط در .env:
curl -i -X POST http://localhost:3000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"u@example.com","type":"signup"}'
# { "message": "خطای سرور — ارسال ایمیل با مشکل مواجه شد" }
```

---

### 4) `POST /api/auth/verify-otp` — تایید کد OTP

**تایید موفق (200):**

```bash
curl -i -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -b cookies.txt -c cookies.txt \
  -d '{"email":"u@example.com","code":"482910","type":"signup"}'
# { "verified": true }
```

**کد اشتباه (400):**

```bash
curl -i -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"u@example.com","code":"000000","type":"signup"}'
# { "message": "کد وارد شده اشتباه است" }
```

**کد منقضی (400):** پس از ۱۸۰ ثانیه از ارسال:

```bash
curl -i -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"u@example.com","code":"482910","type":"signup"}'
# { "message": "کد منقضی شده است — لطفاً کد جدید درخواست کنید" }
```

**کد قبلاً استفاده شده (400):** اگر همان کد بار دوم ارسال شود:

```bash
curl -i -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"u@example.com","code":"482910","type":"signup"}'
# { "message": "این کد قبلاً استفاده شده است" }
```

**کد یافت نشد (404):** هیچ OTP ای برای این ایمیل/نوع ثبت نشده:

```bash
curl -i -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"never@example.com","code":"123456","type":"signup"}'
# { "message": "کد معتبری یافت نشد" }
```

---

### 5) `POST /api/auth/register` — ثبت‌نام کاربر جدید

> ⚠️ پیش از این endpoint باید `verify-otp` با `type=signup` موفق شده باشد. حتماً از `-b cookies.txt` استفاده کنید تا session ارسال شود.

**ثبت‌نام موفق (200):**

```bash
curl -i -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -b cookies.txt \
  -d '{
    "mobile":"09121234567",
    "email":"u@example.com",
    "national_id":"0012345678",
    "birth_date":"1990-05-12",
    "password":"MyPass@123",
    "confirm_password":"MyPass@123"
  }'
# { "success": true, "message": "ثبت‌نام با موفقیت انجام شد" }
```

**رمز و تکرار یکسان نیستند (400):**

```bash
curl -i -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" -b cookies.txt \
  -d '{
    "mobile":"09121234567","email":"u@example.com","national_id":"0012345678",
    "birth_date":"1990-05-12","password":"MyPass@123","confirm_password":"Other@123"
  }'
# { "message": "رمز عبور و تکرار آن یکسان نیستند" }
```

**ایمیل تایید نشده (403):** بدون فراخوانی `verify-otp` قبلی:

```bash
curl -i -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "mobile":"09121234567","email":"u@example.com","national_id":"0012345678",
    "birth_date":"1990-05-12","password":"MyPass@123","confirm_password":"MyPass@123"
  }'
# { "message": "ایمیل تایید نشده است — لطفاً ابتدا OTP را تایید کنید" }
```

**شماره موبایل تکراری (409):**

```bash
# { "message": "این شماره موبایل قبلاً ثبت شده است" }
```

**ایمیل تکراری (409):**

```bash
# { "message": "این ایمیل قبلاً ثبت شده است" }
```

**کد ملی تکراری (409):**

```bash
# { "message": "این کد ملی قبلاً ثبت شده است" }
```

**رمز ضعیف (422):**

```bash
curl -i -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" -b cookies.txt \
  -d '{
    "mobile":"09121234567","email":"u@example.com","national_id":"0012345678",
    "birth_date":"1990-05-12","password":"weak","confirm_password":"weak"
  }'
# { "message": "رمز عبور باید حداقل ۸ کاراکتر، یک عدد، یک حرف بزرگ و یک کاراکتر خاص داشته باشد" }
```

**کد ملی نامعتبر (422):**

```bash
curl -i -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" -b cookies.txt \
  -d '{
    "mobile":"09121234567","email":"u@example.com","national_id":"123",
    "birth_date":"1990-05-12","password":"MyPass@123","confirm_password":"MyPass@123"
  }'
# { "message": "فرمت کد ملی معتبر نیست — باید ۱۰ رقم عددی باشد" }
```

**تاریخ تولد در آینده (422):**

```bash
curl -i -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" -b cookies.txt \
  -d '{
    "mobile":"09121234567","email":"u@example.com","national_id":"0012345678",
    "birth_date":"2099-01-01","password":"MyPass@123","confirm_password":"MyPass@123"
  }'
# { "message": "تاریخ تولد نمی‌تواند در آینده باشد" }
```

**سن بیش از ۱۲۰ سال (422):**

```bash
curl -i -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" -b cookies.txt \
  -d '{
    "mobile":"09121234567","email":"u@example.com","national_id":"0012345678",
    "birth_date":"1850-01-01","password":"MyPass@123","confirm_password":"MyPass@123"
  }'
# { "message": "تاریخ تولد معتبر نیست — حداکثر سن مجاز ۱۲۰ سال است" }
```

**فرمت تاریخ تولد نامعتبر (422):**

```bash
curl -i -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" -b cookies.txt \
  -d '{
    "mobile":"09121234567","email":"u@example.com","national_id":"0012345678",
    "birth_date":"not-a-date","password":"MyPass@123","confirm_password":"MyPass@123"
  }'
# { "message": "فرمت تاریخ تولد معتبر نیست" }
```

---

### 6) `POST /api/auth/forgot-password` — درخواست بازیابی رمز

**موفق (200):**

```bash
curl -i -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" -c cookies.txt \
  -d '{"email":"u@example.com"}'
# { "message": "کد بازیابی به ایمیل شما ارسال شد" }
```

**حساب یافت نشد (404):**

```bash
curl -i -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"unknown@example.com"}'
# { "message": "حسابی با این ایمیل یافت نشد" }
```

**ایمیل نامعتبر (422):**

```bash
curl -i -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"not-an-email"}'
# { "message": "آدرس ایمیل معتبر نیست" }
```

---

### 7) `POST /api/auth/reset-password` — تنظیم رمز جدید

> ⚠️ پیش از این endpoint باید `verify-otp` با `type=reset_password` موفق شده باشد.

**موفق (200):**

```bash
curl -i -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" -b cookies.txt \
  -d '{
    "email":"u@example.com",
    "new_password":"NewPass@123",
    "confirm_password":"NewPass@123"
  }'
# { "success": true, "message": "رمز عبور با موفقیت تغییر یافت" }
```

**رمز و تکرار یکسان نیستند (400):**

```bash
curl -i -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" -b cookies.txt \
  -d '{"email":"u@example.com","new_password":"NewPass@123","confirm_password":"Other@123"}'
# { "message": "رمز عبور و تکرار آن یکسان نیستند" }
```

**تایید OTP انجام نشده (403):**

```bash
curl -i -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"email":"u@example.com","new_password":"NewPass@123","confirm_password":"NewPass@123"}'
# { "message": "تایید OTP انجام نشده است — لطفاً ابتدا کد را تایید کنید" }
```

**رمز ضعیف (422):**

```bash
curl -i -X POST http://localhost:3000/api/auth/reset-password \
  -H "Content-Type: application/json" -b cookies.txt \
  -d '{"email":"u@example.com","new_password":"weak","confirm_password":"weak"}'
# { "message": "رمز عبور باید حداقل ۸ کاراکتر، یک عدد، یک حرف بزرگ و یک کاراکتر خاص داشته باشد" }
```

---

## قوانین اعتبارسنجی

| فیلد | قانون |
|---|---|
| Mobile | `/^09[0-9]{9}$/` |
| Email | فرمت استاندارد RFC |
| National ID | دقیقاً ۱۰ رقم عددی |
| Birth date | فرمت `YYYY-MM-DD` میلادی — نه در آینده، حداکثر سن ۱۲۰ سال (حد پایین ندارد) |
| Password | حداقل ۸ کاراکتر، حداقل ۱ حرف بزرگ، ۱ عدد، ۱ کاراکتر خاص از `!@#$%^&*` |

---

## قوانین امنیتی

- پسوردها **هرگز** به‌صورت متن ساده ذخیره نمی‌شوند — همگی با `bcrypt.hash(password, 12)` هش می‌شوند.
- `password_hash` در هیچ پاسخی برگردانده نمی‌شود.
- کد OTP دقیقاً پس از ۱۸۰ ثانیه منقضی می‌شود.
- محض اینکه یک OTP تایید (verify) شد، `used=1` می‌شود و دیگر قابل استفاده نیست.
- وقتی OTP جدیدی برای همان ایمیل+نوع ارسال می‌شود، تمام OTPهای قبلی استفاده‌نشده باطل می‌شوند (`used=1`).
- قفل ورود: ۳ تلاش ناموفق در ۱۰ دقیقه → حساب به مدت ۱۰ دقیقه قفل می‌شود.
- پسوردها در هیچ لاگی ثبت نمی‌شوند.

---

---

## Phase 2 — استوری‌های آنبوردینگ

پس از اولین ورود کاربر، یک پخش‌کننده fullscreen ۳ صفحه‌ای (شبیه استوری‌های اینستاگرام) نمایش داده می‌شود. بعد از این که کاربر یک بار استوری‌ها را دید، دیگر تکرار نمی‌شود — مگر این که ادمین آن را ریست کند.

### تغییرات دیتابیس

به صورت خودکار در بوت اعمال می‌شوند:

- `dakhlyar_app.db` → ستون `users.has_seen_stories INTEGER DEFAULT 0` (idempotent migration)
- `dakhlyar_admin.db` → جدول `stories(id, order_index, image_path, is_active, created_at)` + سه ردیف seed با تصویر `/uploads/stories/placeholder.jpg`

### Endpoint های کاربر

#### `GET /api/stories` — لیست استوری‌های فعال

```bash
curl -i -b cookies.txt http://localhost:3000/api/stories
# 200:
# { "stories": [ { "id":1, "order_index":1, "image_url":"/uploads/stories/placeholder.jpg" }, ... ] }
```

```bash
# 401 — بدون لاگین
curl -i http://localhost:3000/api/stories
# { "message": "لطفاً وارد حساب کاربری خود شوید" }
```

#### `GET /api/stories/status` — وضعیت مشاهده

```bash
curl -i -b cookies.txt http://localhost:3000/api/stories/status
# 200: { "has_seen_stories": 0 }
```

#### `POST /api/stories/mark-seen` — ثبت مشاهده

```bash
curl -i -X POST -b cookies.txt http://localhost:3000/api/stories/mark-seen
# 200: { "success": true }
```

### Endpoint های ادمین (نقش `req.session.isAdmin === true` لازم است)

> ⚠️ این endpointها فاز ۲ به صورت placeholder ساخته شده‌اند. در فاز ۳ به ورود ادمین متصل می‌شوند. در حال حاضر بدون ست کردن دستی `req.session.isAdmin = true` پاسخ 401 می‌دهند.

#### `POST /api/admin/stories/upload` — آپلود استوری جدید

```bash
curl -i -X POST -b cookies.txt http://localhost:3000/api/admin/stories/upload \
  -F "image=@/path/to/story1.jpg" \
  -F "order_index=1"
# 200: { "success": true, "story": { "id":4, "order_index":1, "image_url":"/uploads/stories/story_..._story1.jpg" } }
```

نمونه خطاها:

```bash
# 400 — فرمت غیرمجاز
# { "message": "فرمت فایل مجاز نیست — فقط jpg، png و webp پذیرفته می‌شود" }

# 400 — حجم زیاد
# { "message": "حجم فایل بیش از ۵ مگابایت است" }

# 400 — ترتیب نامعتبر
# { "message": "ترتیب نمایش معتبر نیست — باید عدد صحیح و بزرگ‌تر از صفر باشد" }

# 401 — بدون ادمین
# { "message": "دسترسی غیرمجاز" }
```

#### `POST /api/admin/stories/reset-for-users` — ریست همه کاربران

```bash
curl -i -X POST -b cookies.txt http://localhost:3000/api/admin/stories/reset-for-users
# 200: { "success": true, "message": "استوری برای همه کاربران ریست شد", "affected_users": 12 }
```

### رفتار StoryPlayer در فرانت

- Fullscreen overlay سیاه — `z-index: 9999`
- هر استوری ۵ ثانیه نمایش داده می‌شود
- نوارهای پیشرفت در بالا با CSS animation
- **نگه‌داشتن (Hold)** → توقف انیمیشن و تایمر — **رها کردن** → ادامه از همان نقطه
- **Tap چپ ۳۰٪** → استوری قبلی (یا بسته شدن در اولین)
- **Tap راست ۷۰٪** → استوری بعدی (یا اتمام در آخرین)
- دکمه × بالا → `mark-seen` + بستن
- پایان طبیعی آخرین استوری → `mark-seen` + بستن خودکار
- ناوبری با کیبورد: `←` قبلی، `→` بعدی، `Esc` بستن، `Space` pause/resume

### نکات راه‌اندازی

- پوشه `server/uploads/stories/` به صورت خودکار ساخته می‌شود
- اگر `placeholder.jpg` وجود نداشته باشد، یک JPEG ۱×۱ سفید معتبر (≈۱۳۴ بایت) از کد بازنویسی می‌شود تا فلوی استوری بدون نیاز به آپلود ادمین کار کند
- فایل‌های آپلود شده از طریق `app.use('/uploads', express.static('server/uploads'))` به صورت استاتیک سرو می‌شوند

---

## فاز ۳ — صفحه اصلی + پروفایل کاربر

این فاز شامل: مهاجرت‌های جدید دیتابیس (ستون‌های پروفایل، اشتراک و سطح احراز هویت + ۴ جدول جدید)، APIهای پروفایل، احراز هویت سطح‌بندی، اشتراک، دستگاه‌های متصل و **سیستم پیام‌ها (Phase 3-D، جایگزین notifications قدیمی)**، و دو صفحه‌ی فرانت (داشبورد به‌روزشده + پروفایل تک‌صفحه‌ای با hash routing).

### مهاجرت‌های دیتابیس (idempotent)

ستون‌های افزوده‌شده به جدول `users`:

| ستون | نوع | توضیح |
|------|-----|-------|
| `first_name` | TEXT | نام |
| `last_name` | TEXT | نام خانوادگی |
| `address` | TEXT | آدرس |
| `postal_code` | TEXT | کدپستی (۱۰ رقم) |
| `verification_level` | INTEGER (0..3) | سطح فعلی احراز هویت |
| `subscription_plan` | TEXT | `silver` | `gold` | `diamond` |
| `subscription_expires_at` | TEXT | تاریخ انقضای اشتراک |

جداول جدید: `verification_requests`، `subscription_requests`، `connected_devices` — همگی با `CREATE TABLE IF NOT EXISTS`. (در فاز ۳-D جدول `notifications` به طور کامل با `messages` جایگزین شده و در migration ابتدای فاز ۳-D با `DROP TABLE IF EXISTS notifications` پاک می‌شود.)

### سطوح احراز هویت

| سطح | پیش‌نیاز | فیلدهای قفل‌شده پس از احراز |
|-----|---------|------------------------------|
| ۰ | تایید ایمیل (پیش‌فرض ثبت‌نام) | `email` (همیشه read-only) |
| ۱ | شماره موبایل + کد ملی | `mobile`، `national_id` |
| ۲ | تاریخ تولد | `birth_date` |
| ۳ | آدرس + کدپستی | `address`، `postal_code` |

- کاربر فقط می‌تواند سطح بعدی (`current_level + 1`) را درخواست دهد.
- یک درخواست در حال بررسی، مانع از ثبت درخواست جدید از همان نوع می‌شود.

### پلن‌های اشتراک (هاردکد در سرور)

| Key | نام | مدت | قیمت |
|-----|-----|-----|------|
| `silver` | نقره‌ای | ۳ ماهه | ۲٬۰۰۰٬۰۰۰ تومان |
| `gold` | طلایی | ۶ ماهه | ۳٬۵۰۰٬۰۰۰ تومان |
| `diamond` | الماسی | ۱ ساله | ۶٬۰۰۰٬۰۰۰ تومان |

قیمت همیشه از روی `server/utils/plans.js` خوانده می‌شود — قیمت ارسالی client هرگز پذیرفته نمی‌شود.

### نمونه‌های `curl` — Profile

```bash
# اطلاعات پروفایل
curl -i -b cookies.txt http://localhost:3000/api/profile
# 200: { id, mobile, email, first_name, ..., verification_level, subscription_plan, is_subscription_active }

# بروزرسانی فیلدهای آزاد (نام/نام‌خانوادگی)
curl -i -b cookies.txt -X PATCH \
  -H "Content-Type: application/json" \
  -d '{"first_name":"فرید","last_name":"محمدی"}' \
  http://localhost:3000/api/profile
# 200: { "success": true, "message": "اطلاعات با موفقیت بروزرسانی شد", "updated_fields": ["first_name","last_name"] }

# تلاش برای ویرایش فیلد قفل‌شده پس از احراز (مثلاً national_id بعد از سطح ۱)
# 403: { "message": "این فیلد به دلیل احراز هویت قابل ویرایش نیست", "locked_fields": ["national_id"] }

# تغییر رمز عبور
curl -i -b cookies.txt -X POST \
  -H "Content-Type: application/json" \
  -d '{"current_password":"Old@1234","new_password":"New@1234","confirm_password":"New@1234"}' \
  http://localhost:3000/api/profile/change-password
# 200: { "success": true, "message": "رمز عبور با موفقیت تغییر یافت" }
# 401: { "message": "رمز عبور فعلی اشتباه است" }
# 400: { "message": "رمز عبور جدید نمیتواند با رمز فعلی یکسان باشد" }

# دستگاه‌های متصل
curl -i -b cookies.txt http://localhost:3000/api/profile/devices
# 200: { "devices": [ { id, device_name, device_type, ip_address, last_active } ] }

curl -i -b cookies.txt -X DELETE http://localhost:3000/api/profile/devices/3
# 200 | 404

# کد دعوت
curl -i -b cookies.txt http://localhost:3000/api/profile/invite-code
# 200: { "invite_code": "DKHL-42" }
```

### نمونه‌های `curl` — Verification

```bash
# وضعیت احراز هویت
curl -i -b cookies.txt http://localhost:3000/api/verification/status
# 200: {
#   "current_level": 1,
#   "pending_request": null,
#   "levels": [
#     { "level": 1, "state": "approved", ... },
#     { "level": 2, "state": "available", "required_fields": ["birth_date"], "missing_fields": [] },
#     { "level": 3, "state": "locked", ... }
#   ]
# }

# درخواست ارتقاء به سطح بعدی
curl -i -b cookies.txt -X POST \
  -H "Content-Type: application/json" \
  -d '{"requested_level":2}' \
  http://localhost:3000/api/verification/request
# 200: { "success": true, "message": "درخواست احراز هویت ثبت شد و در انتظار بررسی است", "request_id": 5 }
# 400: { "message": "شما فقط می‌توانید سطح بعدی را درخواست دهید" }
# 409: { "message": "یک درخواست در حال بررسی دارید" }
# 422: { "message": "لطفاً ابتدا اطلاعات مورد نیاز این سطح را در پروفایل تکمیل کنید: تاریخ تولد", "missing_fields": ["birth_date"] }
```

### نمونه‌های `curl` — Subscription

```bash
# لیست پلن‌ها (نیاز به ورود ندارد)
curl -i http://localhost:3000/api/subscription/plans
# 200: { "plans": [ { "key":"silver", "name":"نقره‌ای", ... }, ... ] }

# وضعیت اشتراک کاربر
curl -i -b cookies.txt http://localhost:3000/api/subscription/status
# 200: { "plan":"gold", "plan_name":"طلایی", "expires_at":"2026-09-01", "is_active":true, "days_remaining":45, "pending_request":null }

# ثبت درخواست خرید
curl -i -b cookies.txt -X POST \
  -H "Content-Type: application/json" \
  -d '{"plan":"gold"}' \
  http://localhost:3000/api/subscription/request
# 200: { "success": true, "message": "درخواست اشتراک ثبت شد و در انتظار تایید ادمین است", "request_id": 12 }
# 400: { "message": "پلن انتخابی معتبر نیست" }
# 409: { "message": "یک درخواست اشتراک در حال بررسی دارید" }
```

### نمونه‌های `curl` — Messages (Phase 3-D, جایگزین Notifications)

```bash
# لیست پیام‌ها + تعداد نخوانده (با zaman نسبی فارسی)
curl -i -b cookies.txt http://localhost:3000/api/messages
# 200: { "messages": [{ "id":42, "title":"...", "time_ago":"۲ ساعت پیش", "is_expired":false, ... }], "unread_count": 3 }

# علامت‌گذاری یک پیام به‌عنوان خوانده‌شده
curl -i -b cookies.txt -X PATCH http://localhost:3000/api/messages/42/read
# 200: { "success": true }

# علامت‌گذاری همه نخوانده‌ها
curl -i -b cookies.txt -X PATCH http://localhost:3000/api/messages/read-all
# 200: { "success": true, "updated_count": 4 }

# حذف یک پیام (فقط خوانده‌شده‌ها)
curl -i -b cookies.txt -X DELETE http://localhost:3000/api/messages/42
# 200: { "success": true }
# 400 اگر پیام نخوانده باشد: { "message": "پیام‌های خوانده نشده قابل حذف نیستند" }
```

### نمونه‌های `curl` — Logout

```bash
curl -i -b cookies.txt -X POST http://localhost:3000/api/auth/logout
# 200: { "success": true, "message": "با موفقیت خارج شدید" }
```

### Device tracking روی login

با هر ورود موفق به `/api/auth/login`، یک رکورد در جدول `connected_devices` upsert می‌شود:

- اگر همین `(user_id, ip, user_agent)` قبلاً وجود داشته باشد → فقط `last_active` به‌روز می‌شود
- در غیر این صورت → یک ردیف جدید با تشخیص خودکار device_type (`mobile` | `tablet` | `desktop`) و یک device_name خوانا (مثلاً `Chrome on macOS`) ساخته می‌شود

این logic از `server/utils/deviceTracker.js` خوانده می‌شود و هرگز جریان لاگین را break نمی‌کند (در صورت خطا فقط در console هشدار می‌دهد).

### صفحه‌های جدید فرانت

- `/dashboard.html` — حالا با top bar (آیکن پروفایل + زنگوله پیام‌ها با badge نخوانده‌ها) و bottom nav (خانه، تراکنش‌ها، گزارش‌ها، بودجه). بقیه تب‌ها فعلاً toast "به زودی" نشان می‌دهند.
- `/profile.html` — صفحه‌ی واحد با hash routing برای زیر-بخش‌ها: `#/info`، `#/verification`، `#/subscription`، `#/devices`، `#/invite`، `#/faq`، `#/terms`، `#/support`. تغییر رمز عبور به صورت مدال نمایش داده می‌شود.
  - تاریخ تولد به صورت **شمسی (جلالی)** با ارقام فارسی نمایش داده می‌شود و برای ویرایش از Persian datepicker استفاده می‌شود (در سرور همچنان به فرمت میلادی `YYYY-MM-DD` ذخیره می‌شود).
  - دکمه‌ی «درخواست احراز» تنها زمانی فعال است که تمام فیلدهای موردنیاز آن سطح در پروفایل تکمیل شده باشند؛ در غیر این صورت Disabled همراه با یک hint و دکمه‌ی میانبر «تکمیل اطلاعات» نمایش داده می‌شود.
- `/messages.html` — صفحه‌ی پیام‌ها (Phase 3-D). کارت‌های unread/read/expired، type badge های رنگی، expand بدنه، حذف پیام‌های خوانده‌شده و «خواندن همه» با مودال تایید.

### پنل ادمین Dev — تایید/رد احراز و اشتراک

سه پنل ساده‌ی Dev (نیازمند `req.session.isAdmin === true` که از طریق `POST /api/admin/stories/dev-login` فعال می‌شود):

- `/admin-stories.html` — مدیریت استوری‌های آنبوردینگ
- `/admin-verifications.html` — لیست + تایید/رد درخواست‌های احراز هویت با امکان فیلتر (همه / در انتظار / تاییدشده / رد‌شده) و یادداشت دلخواه ادمین
- `/admin-subscriptions.html` — لیست + تایید/رد درخواست‌های اشتراک. تایید به‌صورت Atomic، `subscription_plan` و `subscription_expires_at = today + duration_months` کاربر را تنظیم می‌کند

صفحه‌ی landing در `/admin` به هر سه پنل لینک می‌دهد.

#### نمونه‌های `curl` — Admin Review

```bash
# (یک‌بار) فعال‌سازی ادمین Dev
curl -s -X POST -c cookies.txt http://localhost:3000/api/admin/stories/dev-login

# لیست درخواست‌های احراز
curl -s -b cookies.txt http://localhost:3000/api/admin/verifications
# 200: { "requests": [ { id, user_id, requested_level, status, mobile, email, ... } ] }

# تایید
curl -s -b cookies.txt -X POST \
  -H "Content-Type: application/json" \
  -d '{"note":"مدارک تایید شد"}' \
  http://localhost:3000/api/admin/verifications/5/approve
# 200: { "success": true, "message": "درخواست تایید شد", "new_level": 2 }

# رد
curl -s -b cookies.txt -X POST \
  -H "Content-Type: application/json" \
  -d '{"note":"کد ملی با تاریخ تولد همخوانی ندارد"}' \
  http://localhost:3000/api/admin/verifications/6/reject
# 200: { "success": true, "message": "درخواست رد شد" }

# اشتراک — تایید (فعال‌سازی Atomic پلن)
curl -s -b cookies.txt -X POST \
  -H "Content-Type: application/json" \
  -d '{"note":"فاکتور #12345"}' \
  http://localhost:3000/api/admin/subscriptions/12/approve
# 200: { "success": true, "plan": "gold", "expires_at": "2026-12-12" }

# اشتراک — رد
curl -s -b cookies.txt -X POST \
  -H "Content-Type: application/json" \
  -d '{"note":"پرداخت تایید نشد"}' \
  http://localhost:3000/api/admin/subscriptions/13/reject
# 200: { "success": true, "message": "درخواست رد شد" }
```

---

## فاز ۳-B — سیستم آواتار کاربر

ساختاری دو لایه با ۴۰ آواتار ثابت **DiceBear Personas** + قابلیت آپلود عکس شخصی برای کاربران دارای اشتراک.

### Schema جدید روی جدول `users` (در `dakhlyar_app.db`)

| ستون                 | نوع                                       | توضیح                                                     |
| -------------------- | ----------------------------------------- | --------------------------------------------------------- |
| `avatar_type`        | TEXT DEFAULT `'dicebear'`                  | `'dicebear'` یا `'custom'`                                 |
| `avatar_seed`        | TEXT DEFAULT `'aria'`                      | seed انتخابی برای آواتار DiceBear فعلی                      |
| `avatar_custom_path` | TEXT DEFAULT NULL                         | مسیر فایل عکس شخصی (`/uploads/avatars/...`) — فقط اگر `custom` |
| `avatar_last_seed`   | TEXT DEFAULT `'aria'`                      | آخرین seed انتخاب‌شده — برای بازگشت پس از اتمام اشتراک        |

این migration به‌صورت **idempotent** در `server/db/appDb.js > runMigrations()` اجرا می‌شود.

### Seeds (ثابت، در سرور whitelist می‌شوند)

- **۲۰ رایگان** — `aria, luna, nova, sage, iris, leo, finn, zara, eden, blake, sky, rain, dawn, ash, brook, vale, reef, wren, cove, fern`
- **۲۰ ویژه‌ی اشتراک** — `orion, lyra, phoenix, atlas, zephyr, aurora, draco, celeste, soleil, nimbus, vega, altair, sirius, cygnus, aquila, castor, pollux, rigel, deneb, antares`

هر seed یک backgroundColor ثابت دارد (نقشه‌ی کامل در `server/utils/avatarHelper.js`).
هر آواتار به‌صورت SVG از این URL سرو می‌شود:

```
https://api.dicebear.com/7.x/personas/svg?seed=<SEED>&backgroundColor=<HEX>
```

> ⚠️ امنیت: لیست seedها در سمت سرور **hardcoded** است. هر seed ارسالی از کلاینت پیش از استفاده با `isValidSeed()` بررسی می‌شود و دسترسی به seedهای premium همیشه با چک سرور-ساید subscription گارد می‌شود.

### رفتار اتمام اشتراک (revert خودکار)

تابع `checkAndRevertExpiredSubscriptions()` در `server/controllers/subscriptionController.js`:

1. **هنگام startup سرور** یک بار اجرا می‌شود.
2. **هر ۶۰ دقیقه** با `setInterval` تکرار می‌شود.
3. **Real-time**: قبل از پاسخ `GET /api/profile` و `GET /api/avatar/list` نیز برای همان کاربر اجرا می‌شود.

برای هر کاربر منقضی‌شده (`subscription_expires_at < date('now')`) داخل یک Transaction:

- اگر `avatar_type = 'custom'` → فایل عکس از دیسک حذف و آواتار به `avatar_last_seed` برمی‌گردد (اگر آن seed هم premium باشد → fallback به `aria`)
- اگر `avatar_type = 'dicebear'` و `avatar_seed` premium باشد → seed به آخرین seed رایگان (یا `aria`) برمی‌گردد
- اگر آواتار رایگان بود → فقط ستون‌های `subscription_plan` و `subscription_expires_at` پاک می‌شوند
- در هر سه حالت یک notification با عنوان «پایان اشتراک» برای کاربر ثبت می‌شود

### Endpointهای جدید

| Method | Path                  | توضیح                                                        |
| ------ | --------------------- | ------------------------------------------------------------ |
| GET    | `/api/avatar/list`    | لیست ۴۰ آواتار + آواتار فعلی + وضعیت قفل و `can_upload`    |
| PATCH  | `/api/avatar/select`  | انتخاب seed (`{ seed }`). seed premium نیازمند اشتراک فعال است |
| POST   | `/api/avatar/upload`  | آپلود عکس شخصی (multipart `photo`، فقط با اشتراک فعال)      |
| DELETE | `/api/avatar/custom`  | حذف عکس شخصی و بازگشت به آخرین seed DiceBear                |

تمام پاسخ‌ها فارسی و در Swagger زیر تگ **آواتار** کامل مستند شده‌اند.

#### آپلود — قوانین

- **mimetype پذیرفته‌شده:** `image/jpeg`، `image/png`، `image/webp`
- **پسوند پذیرفته‌شده:** `.jpg`، `.jpeg`، `.png`، `.webp`
- **حداکثر حجم:** ۳ مگابایت
- نام فایل ذخیره‌شده فقط از `userId + Date.now() + extension` ساخته می‌شود (نه `originalname`) → جلوگیری از path traversal
- در صورت وجود عکس قبلی، فایل قبلی پیش از ذخیره‌ی فایل جدید از دیسک حذف می‌شود

### Frontend — `AvatarPicker`

- اضافه شده: `public/js/avatar.js` (کلاس `AvatarPicker` + helper `window.getAvatarUrl`)
- اضافه شده: `public/css/avatar.css`
- در `profile.html` آواتار کاربر به‌صورت `<img id="userAvatar" class="avatar-img">` نمایش داده می‌شود. تب روی آن → باز شدن مدال انتخاب آواتار (overlay بدون `position:fixed` خاص، با ESC و کلیک روی backdrop بسته می‌شود).
- مدال دو تب دارد: «آواتارها» (گرید 4 ستونی رایگان + ویژه با overlay قفل) و «عکس شخصی» (آپلود/پیش‌نمایش/حذف). تغییرات به‌صورت optimistic در UI اعمال می‌شود و آواتار بالای صفحه بدون reload به‌روز می‌شود.

#### نمونه‌های `curl` — Avatar

```bash
# لیست (نیازمند session)
curl -s -b cookies.txt http://localhost:3000/api/avatar/list

# انتخاب seed رایگان
curl -s -b cookies.txt -X PATCH \
  -H "Content-Type: application/json" \
  -d '{"seed":"luna"}' \
  http://localhost:3000/api/avatar/select
# 200: { "success": true, "avatar_url": ".../seed=luna&backgroundColor=c0aede" }

# انتخاب seed premium بدون اشتراک
# 403: { "message": "این آواتار مخصوص کاربران دارای اشتراک فعال است" }

# آپلود عکس شخصی (نیازمند اشتراک فعال)
curl -s -b cookies.txt -X POST \
  -F "photo=@/path/to/me.jpg" \
  http://localhost:3000/api/avatar/upload
# 200: { "success": true, "avatar_url": "/uploads/avatars/avatar_42_1718099999000.jpg" }

# حذف عکس شخصی
curl -s -b cookies.txt -X DELETE http://localhost:3000/api/avatar/custom
# 200: { "success": true, "avatar_url": ".../seed=aria&backgroundColor=b6e3f4" }
```

### فایل‌های جدید/تغییریافته در این فاز

**New**
- `server/utils/avatarHelper.js`
- `server/controllers/avatarController.js`
- `server/routes/avatar.js`
- `public/css/avatar.css`
- `public/js/avatar.js`
- پوشه‌ی `server/uploads/avatars/` در اولین آپلود ساخته می‌شود

**Modified (extension only)**
- `server/db/appDb.js` — ۴ ستون جدید avatar روی `users`
- `server/controllers/subscriptionController.js` — `checkAndRevertExpiredSubscriptions()`
- `server/controllers/profileController.js` — افزودن `avatar_url` (+ avatar_type/seed) به پاسخ `GET /api/profile` و real-time expiry check
- `server/index.js` — mount کردن `/api/avatar`، startup sweep و `setInterval` هر ۶۰ دقیقه
- `server/swagger/swaggerConfig.js` — تگ **آواتار** + مستندات ۴ endpoint
- `public/profile.html` و `public/js/profile.js` — جایگزینی initials با `<img>` و trigger کردن `AvatarPicker`

---

## فاز ۳-C — سیستم دعوت (Referral / Invite)

سیستم دعوت دخلیار به کاربران اجازه می‌دهد کد اختصاصی خود (`DKHL-{userId}`) را با دوستان به اشتراک بگذارند، و دو طرف از تخفیف اشتراک بهره‌مند شوند.

### قواعد تخفیف

| پلن دعوت‌کننده | درصد دعوت‌کننده (هر خرید موفق) | درصد دعوت‌شده (یک‌بار) | پنجره دعوت‌شده |
|----------------|-------------------------------|------------------------|----------------|
| نقره‌ای        | ۱٪ — بدون انقضا              | ۲٪                     | ۱۰ روز از ثبت‌نام |
| طلایی          | ۲٪ — بدون انقضا              | ۵٪                     | ۱۰ روز از ثبت‌نام |
| الماسی         | ۵٪ — بدون انقضا              | ۱۰٪                    | ۱۰ روز از ثبت‌نام |
| بدون اشتراک   | ۰٪ (رابطه ثبت می‌شود)        | ۰٪                     | —              |

- سقف دعوت‌کننده: حداکثر **۵ دعوت موفق** برای کسب تخفیف؛ پس از آن روابط ثبت می‌شوند اما تخفیفی اضافه نمی‌شود.
- تخفیف انباشته‌ی دعوت‌کننده روی **خرید بعدی خودش** قابل استفاده است (تا سقف ۵۰٪).
- تخفیف کاربر دعوت‌شده فقط در صورتی فعال می‌شود که دعوت‌کننده در زمان ثبت‌نام اشتراک فعال داشته باشد و در ۱۰ روز اول از ثبت‌نام، خرید اشتراک کند.
- هنگام تایید اشتراک توسط ادمین، `final_price = price × (1 - discount/100)` محاسبه و در `subscription_requests.final_price` ذخیره می‌شود.

### تغییرات اسکیما

ستون‌های جدید روی `users`:

| ستون | نوع | توضیح |
|------|-----|------|
| `referred_by_code` | TEXT | کد دعوتی که هنگام ثبت‌نام استفاده شده (NULL = بدون دعوت) |
| `referral_discount_count` | INTEGER | تعداد دعوت‌های موفقی که تاکنون منجر به کسب تخفیف شده (سقف ۵) |

ستون جدید روی `subscription_requests`:

| ستون | نوع | توضیح |
|------|-----|------|
| `final_price` | INTEGER | قیمت نهایی پس از اعمال تخفیف (NULL = بدون تخفیف، قیمت = `price`) |

جدول‌های جدید:

```sql
CREATE TABLE referrals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inviter_user_id INTEGER NOT NULL,
  invitee_user_id INTEGER UNIQUE NOT NULL,
  invite_code TEXT NOT NULL,
  inviter_plan_at_signup TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE referral_discounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  source TEXT NOT NULL,            -- 'inviter' | 'invitee'
  discount_percent REAL NOT NULL,
  referral_id INTEGER NOT NULL,
  triggered_by_subscription_request_id INTEGER,
  is_used INTEGER DEFAULT 0,
  used_at TEXT,
  expires_at TEXT,                 -- NULL برای inviter، تاریخ ۱۰ روزه برای invitee
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

تمام migration‌ها idempotent هستند — اجرای دوباره‌ی سرور روی دیتابیس موجود بدون ضرر است.

### endpoint‌های جدید

| متد | مسیر | احراز | شرح |
|-----|------|------|------|
| GET | `/api/referral/validate/:code` | عمومی | اعتبارسنجی کد + بازگرداندن نام ماسک‌شده دعوت‌کننده |
| POST | `/api/referral/apply` | عمومی | ثبت کد دعوت پس از register (قبل از login) |
| GET | `/api/referral/discount` | session | تخفیف فعال invitee (در صورت وجود) |
| GET | `/api/referral/my-invites` | session | پنل دعوت‌کننده + لیست دعوت‌شدگان |
| GET | `/api/admin/referrals` | admin | لیست تمام روابط دعوت (نام/موبایل ماسک‌شده) |
| GET | `/api/admin/referrals/stats` | admin | آمار سراسری + ۱۰ دعوت‌کننده‌ی برتر |

پاسخ `GET /api/subscription/plans` برای کاربر لاگین‌شده اکنون `discount_percent` و `final_price` را روی هر پلن قرار می‌دهد و کلیدهای `discount` و `pending_inviter_discount_percent` را در سطح ریشه دارد.

پاسخ `GET /api/subscription/status` کلید جدید `pending_inviter_discounts` (درصد انباشته‌ی استفاده‌نشده‌ی دعوت‌کننده) را اضافه می‌کند.

پاسخ `POST /api/auth/register` فیلد افزودنی `user_id` را برمی‌گرداند تا signup wizard بتواند بلافاصله `POST /api/referral/apply` را صدا بزند.

### نمونه فراخوانی‌ها

```bash
# اعتبارسنجی کد دعوت قبل از ثبت‌نام
curl http://localhost:3000/api/referral/validate/DKHL-42

# ثبت کد دعوت بعد از register (با user_id که از پاسخ register گرفتید)
curl -X POST http://localhost:3000/api/referral/apply \
  -H "Content-Type: application/json" \
  -d '{"invitee_user_id": 99, "invite_code": "DKHL-42"}'

# دریافت تخفیف فعال کاربر (نیازمند session)
curl -b cookies.txt http://localhost:3000/api/referral/discount

# پنل دعوت‌کننده
curl -b cookies.txt http://localhost:3000/api/referral/my-invites
```

### رفتار سمت کلاینت

- در صفحه **ثبت‌نام (Step 1)** یک فیلد اختیاری «کد دعوت» اضافه شده. در `blur` کد به سرور فرستاده می‌شود؛ در صورت معتبر بودن، نام دعوت‌کننده با تیک سبز زیر فیلد نمایش داده می‌شود. کد فقط در صورت معتبر بودن پس از register به `/api/referral/apply` ارسال می‌شود.
- در **پروفایل → اشتراک**، اگر کاربر تخفیف دعوت فعال یا تخفیف انباشته داشته باشد، روی کارت‌های پلن قیمت اصلی خط‌خورده و قیمت نهایی به‌علاوه‌ی نشانه‌ی «X٪ تخفیف» نمایش داده می‌شود.
- در **پروفایل → دعوت از دوستان**، آمار (تعداد دعوت‌ها، تخفیف‌های کسب‌شده از ۵، تخفیف انباشته‌شده) و لیست افراد دعوت‌شده با نام ماسک‌شده دیده می‌شود. دکمه‌ی اشتراک‌گذاری از Web Share API استفاده می‌کند و در صورت نبود، به کلیپ‌بورد می‌نویسد.

### فایل‌های جدید/تغییریافته

**فایل‌های جدید:**

- `server/utils/discountHelper.js` — هسته منطق تخفیف (`processReferralOnSubscriptionApproval`، `applyInviterDiscountsToOwnPurchase`، …)
- `server/controllers/referralController.js`
- `server/routes/referral.js`

**فایل‌های گسترش‌یافته:**

- `server/db/appDb.js` — migration برای جداول جدید و ستون‌های Phase 3-C
- `server/controllers/adminReviewController.js` — صدا زدن `processReferralOnSubscriptionApproval` هنگام تایید اشتراک
- `server/controllers/subscriptionController.js` — انتشار `discount` و `final_price` در `/plans` و `/status`
- `server/controllers/authController.js` — افزودن `user_id` به پاسخ register
- `server/index.js` — mount کردن `/api/referral` و endpoint‌های admin
- `server/swagger/swaggerConfig.js` — مستندات کامل فارسی برای ۶ مسیر جدید
- `public/signup.html` + `public/js/signup.js` — فیلد اختیاری کد دعوت
- `public/profile.html` + `public/js/profile.js` + `public/css/profile.css` — نمایش تخفیف و پنل دعوت‌کننده

---

## فاز ۳-D — سیستم پیام‌ها (Messages)

سیستم نوتیفیکیشن قدیمی (`notifications`) کاملاً با یک **inbox** غنی به نام `messages` جایگزین شد. در migration ابتدای راه‌اندازی، جدول `notifications` با `DROP TABLE IF EXISTS notifications` پاک می‌شود.

### Schema

```sql
CREATE TABLE IF NOT EXISTS messages (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  type        TEXT NOT NULL,           -- verification_request | verification_result |
                                       -- subscription_request | subscription_result |
                                       -- subscription_expiry_warning | subscription_expired |
                                       -- admin_broadcast | admin_direct | referral
  related_id  INTEGER DEFAULT NULL,    -- request id برای upsert request↔result
  is_read     INTEGER DEFAULT 0,
  read_at     TEXT DEFAULT NULL,
  expires_at  TEXT DEFAULT NULL,
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_messages_user_id      ON messages(user_id);
CREATE INDEX idx_messages_type_related ON messages(type, related_id);
```

ستون جدید کاربر: `users.first_login_message_sent INTEGER DEFAULT 0` (برای پیام خوش‌آمدگویی).

### قواعد نمایش (در همان SELECT)

۱) فقط پیام‌های همان کاربر  
۲) پیام خوانده‌شده‌ای که `read_at` آن بیش از ۷ روز قبل بوده، حذف می‌شود (مخفی)  
۳) هر پیام خوانده‌شده‌ی قدیمی‌تر از ۲ ماه مخفی می‌شود  
۴) پیام‌های منقضی نمایش داده می‌شوند ولی خودکار به‌صورت «خوانده‌شده» علامت‌گذاری می‌شوند تا قاعده‌ی ۷ روز از زمان انقضا اعمال شود (نه از زمان ایجاد)

### Auto-expire (Hourly + inline)

تابع `autoExpireMessages()` هم در `setInterval` ساعتی سرور و هم در ابتدای `GET /api/messages` اجرا می‌شود:

```sql
UPDATE messages SET is_read=1, read_at=datetime('now')
WHERE expires_at IS NOT NULL AND expires_at < datetime('now') AND is_read=0;
```

### Upsert (request → result، بدون تکرار)

وقتی ادمین یک درخواست (احراز/اشتراک) را تایید یا رد می‌کند، به‌جای درج پیام جدید، **همان پیام request برای آن `related_id` آپدیت می‌شود** (`type`، `title`، `body`، `expires_at`، `is_read=0`). اگر پیام request قبلاً پاک شده بود (پاکسازی ۷ روزه)، یک پیام جدید INSERT می‌شود.

```js
messages.upsertResultMessage({
  userId, relatedId, requestType: 'subscription_request',
  resultType: 'subscription_result',
  title: 'اشتراک طلایی فعال شد ✓',
  body:  'اشتراک طلایی شما با موفقیت فعال شد...',
  expiresAt: new Date(Date.now() + 7*24*60*60*1000),
});
```

### پیام‌های خودکار (با Dedup)

- **اشتراک رو به پایان** — در سه پنجره (۱۰ روز، ۵ روز، ۱ روز) با dedup بر اساس `body LIKE '%N روز%'` در ۲ روز گذشته
- **اشتراک منقضی** — هم‌زمان با `checkAndRevertExpiredSubscriptions`
- **تخفیف دعوت رو به پایان** — برای invitee discount‌ها در پنجره‌های ۳ روز و ۱ روز
- **خوش‌آمدگویی** — فقط در اولین لاگین موفق (با `users.first_login_message_sent = 1`)
- **«دعوت شما ثمر داد»** — به inviter پس از موفقیت `POST /api/referral/apply`
- **«تخفیف دعوت اضافه شد»** — به inviter پس از خرید موفق invitee؛ متن سقف‌آگاه (5/5 → پیغام رسیدن به سقف)

### API کاربر (`/api/messages`)

| روش      | مسیر                         | توضیح |
| -------- | ----------------------------- | ----- |
| `GET`    | `/api/messages`               | لیست + `unread_count` + `time_ago` فارسی |
| `PATCH`  | `/api/messages/:id/read`      | علامت‌گذاری یک پیام |
| `PATCH`  | `/api/messages/read-all`      | علامت‌گذاری همه نخوانده‌ها (`updated_count`) |
| `DELETE` | `/api/messages/:id`           | حذف — فقط برای پیام‌های خوانده‌شده |

### API ادمین (`/api/admin/messages`)

| روش    | مسیر                         | توضیح |
| ------ | ----------------------------- | ----- |
| `POST` | `/api/admin/messages/send`    | `{target:'all'|'user', user_id?, title, body, expires_at}` — `expires_at` الزامی و باید future باشد |
| `GET`  | `/api/admin/messages`         | فهرست پیام‌های ارسالی توسط ادمین با فیلتر `target` و `user_id` |

### نمونه `curl`

```bash
# user — لیست
curl -i -b cookies.txt http://localhost:3000/api/messages
# 200: { "messages":[ { "id":42, "title":"...", "type":"subscription_result", "time_ago":"۲ ساعت پیش", ...} ], "unread_count":1 }

# admin — broadcast به همه
curl -i -b cookies.txt -X POST http://localhost:3000/api/admin/messages/send \
  -H 'Content-Type: application/json' \
  -d '{"target":"all","title":"اطلاعیه","body":"به‌روزرسانی نسخه ۲.۰","expires_at":"2026-12-31T23:59:00.000Z"}'
# 200: { "success": true, "sent_count": 142, "message": "پیام با موفقیت برای ۱۴۲ کاربر ارسال شد" }
```

### فایل‌های جدید/حذف‌شده

**جدید:**

- `server/utils/timeHelper.js` — `persianTimeAgo`، `toPersianDigits`، `jalaliDate`
- `server/controllers/messagesController.js` — endpoint ها + `insertMessage` / `insertDedupedMessage` / `upsertResultMessage` / `autoExpireMessages` helper ها
- `server/routes/messages.js`
- `public/messages.html` + `public/js/messages.js` + `public/css/messages.css`

**حذف‌شده:**

- `server/routes/notifications.js`
- `server/controllers/notificationsController.js`
- `public/notifications.html`
- `public/js/notifications.js`

**گسترش‌یافته:**

- `server/db/appDb.js` — `messages` + index ها + `users.first_login_message_sent` + DROP `notifications`
- `server/controllers/authController.js` — پیام خوش‌آمدگویی در اولین لاگین
- `server/controllers/verificationController.js` — درج پیام `verification_request` هنگام ثبت درخواست
- `server/controllers/subscriptionController.js` — درج پیام `subscription_request`؛ `sendUpcomingExpiryWarnings()` (پنجره‌های ۱۰/۵/۱ روز با dedup)؛ پیام `subscription_expired` در `checkAndRevertExpiredSubscriptions`
- `server/controllers/adminReviewController.js` — `upsertResultMessage` در approve/reject احراز و اشتراک
- `server/controllers/referralController.js` — پیام «دعوت شما ثمر داد» برای inviter پس از `applyReferral`
- `server/utils/discountHelper.js` — پیام تخفیف invitee/inviter (با پیام سقف)؛ `checkReferralDiscountExpiry()` برای پنجره‌های ۳/۱ روز
- `server/index.js` — mount `/api/messages` + `/api/admin/messages/*`، scheduler ساعتی شامل `autoExpireMessages` و `sendUpcomingExpiryWarnings` و `checkReferralDiscountExpiry`
- `public/dashboard.html` + `public/js/dashboard.js` — bell به `/messages.html` + بج از `/api/messages`
- `server/swagger/swaggerConfig.js` — مستندات کامل فارسی برای پیام‌ها و ادمین پیام‌ها

---

## فاز ۳-E — پشتیبانی آنلاین (Goftino live chat)

سیستم چت زنده با Goftino با تجربه‌ی کاربری اختصاصی دخلیار:

- ویجت Goftino با کلید **k4cbEb** فقط در `profile.html` بارگذاری می‌شود.
- **آیکن شناور پیش‌فرض Goftino هرگز نمایش داده نمی‌شود** (`setWidget({ hasIcon: false })`).
- با تپ روی «پشتیبانی آنلاین»، یک overlay تمام‌صفحه با header سبز دخلیار باز می‌شود و `Goftino.open()` فراخوانی می‌شود تا iframe درون همین overlay رندر شود.
- پروفایل کاربر (نام، موبایل، ایمیل، آواتار، سطح احراز، اشتراک، metadata) از طریق `Goftino.setUser({...})` خودکار ارسال می‌شود (یک‌بار، بعد از `goftino_ready` و fetch از `/api/profile`).
- در زمان بسته بودن overlay، رویداد `goftino_getMessage` یک badge سبز کوچک روی ردیف «پشتیبانی آنلاین» در پروفایل افزایش می‌دهد (با ارقام فارسی).
- بستن از داخل ویجت (`goftino_closeWidget`) و دکمه‌ی ✕ هر دو overlay را می‌بندند.
- `z-index: 9000` overlay زیر `DakhlyarModal` (9999) قرار دارد، بنابراین alert/confirm ها همچنان روی همه چیز نمایش داده می‌شوند.

### فایل‌های جدید/گسترش‌یافته

- جدید: `public/js/support-chat.js` (تمام منطق در یک فایل، self-contained)
- گسترش‌یافته: `public/profile.html` (script bootstrap در `<head>`، overlay، include اسکریپت، تغییر دکمه پشتیبانی، fallback روی subview)

---

## فاز ۳-F — Web Push Notifications (بدون سرویس شخص ثالث)

پوش نوتیفیکیشن مستقیماً با Web Push Protocol استاندارد (بدون Firebase / OneSignal). فقط با کتابخانه‌ی `web-push` (سرور) + Service Worker + Push API + Notification API (مرورگر).

### کلیدهای VAPID

یکبار با این دستور تولید کنید و در `.env` ذخیره کنید:

```bash
node -e "console.log(require('web-push').generateVAPIDKeys())"
```

سپس به `.env` اضافه کنید:

```env
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_MAILTO=mailto:support@dakhlyar.ir
```

> هرگز کلیدها را در production دوباره تولید نکنید — همه‌ی subscription های فعلی مرورگرها باطل می‌شوند.

### جدول دیتابیس (push_subscriptions)

```sql
CREATE TABLE push_subscriptions (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  user_agent  TEXT DEFAULT NULL,
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
  last_used   TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_push_subs_user ON push_subscriptions(user_id);
```

Subscription های منقضی (پاسخ 410 یا 404 از push service) **در لحظه** از جدول حذف می‌شوند.

### API endpoints

| Method | Path | احراز | توضیح |
|---|---|---|---|
| GET    | `/api/push/vapid-public-key` | عمومی | دریافت کلید عمومی VAPID |
| POST   | `/api/push/subscribe`        | لاگین | ثبت/بروزرسانی subscription |
| DELETE | `/api/push/unsubscribe`      | لاگین | حذف subscription |

### تگ‌های یکتای پوش (جلوگیری از پیام تکراری)

| رویداد | tag |
|---|---|
| نتیجه احراز هویت        | `verification-result-{requestId}` |
| نتیجه درخواست اشتراک    | `subscription-result-{requestId}` |
| هشدار ۱۰ روز قبل انقضا  | `sub-expiry-10d-{userId}` |
| هشدار ۵ روز قبل انقضا   | `sub-expiry-5d-{userId}`  |
| هشدار ۱ روز قبل انقضا   | `sub-expiry-1d-{userId}` (requireInteraction) |
| اشتراک منقضی شد         | `sub-expired-{userId}` |
| پیام broadcast ادمین    | `admin-broadcast-{messageId}` |
| پیام اختصاصی ادمین      | `admin-direct-{messageId}` |
| دعوت ثبت‌نام شد         | `referral-joined-{referralId}` |
| دعوت‌شده خرید کرد       | `referral-purchased-{referralId}` |

### قواعد مهم پیاده‌سازی

- `public/sw.js` باید از مسیر ریشه (`/sw.js`) سرو شود تا scope برابر `/` باشد.
- همه‌ی فراخوانی‌های ارسال پوش از طریق `pushHelper.sendPushAsync(userId, payload)` انجام می‌شوند که داخلاً با `setImmediate` صف‌بندی می‌شود؛ پاسخ HTTP هرگز منتظر تحویل پوش نمی‌ماند (fire-and-forget).
- اگر `VAPID_PUBLIC_KEY` و `VAPID_PRIVATE_KEY` در `.env` خالی باشند، سرور هشدار می‌دهد ولی همه‌ی فراخوانی‌های پوش بی‌اثر می‌شوند و باقی اپ سالم کار می‌کند.
- بنر درخواست مجوز پوش (نه دیالوگ بومی مرورگر) با طراحی DLS دخلیار اولین‌بار در سشن کاربر روی `dashboard.html` / `profile.html` / `messages.html` نمایش داده می‌شود.
- آیکن‌های PWA با اسکریپت یکبار اجرایی `server/scripts/generate-icons.js` (مبتنی بر `sharp`) از یک SVG برند تولید می‌شوند و در `public/icons/` ذخیره می‌شوند:

  ```bash
  node server/scripts/generate-icons.js
  ```

### فایل‌های جدید

- `server/utils/pushHelper.js` — لایه‌ی ارسال پوش (sendPushAsync / sendPushToAll / cleanup خودکار)
- `server/controllers/pushController.js` — `vapid-public-key`، `subscribe`، `unsubscribe`
- `server/routes/push.js` — مسیر‌های `/api/push/*`
- `server/scripts/generate-icons.js` — تولید یکباره‌ی آیکن‌های PWA + badge
- `public/sw.js` — Service Worker (push / notificationclick / pushsubscriptionchange)
- `public/js/push-init.js` — bootstrap مرورگر + بنر سفارشی مجوز
- `public/manifest.json` — manifest وب‌اپ
- `public/icons/icon-{72…512}.png` و `badge-72.png`

### فایل‌های گسترش‌یافته

- `server/db/appDb.js` — مهاجرت جدول `push_subscriptions`
- `server/index.js` — mount مسیر `/api/push`
- `server/controllers/adminReviewController.js` — push برای تایید/رد احراز و اشتراک
- `server/controllers/subscriptionController.js` — push برای انقضا و هشدارهای ۱۰/۵/۱ روز
- `server/controllers/referralController.js` و `server/utils/discountHelper.js` — push برای ثبت‌نام و خرید دعوت‌شده
- `server/controllers/messagesController.js` — push برای پیام broadcast/direct ادمین
- `server/swagger/swaggerConfig.js` — تگ جدید «پوش نوتیفیکیشن» + مستندات سه endpoint
- همه‌ی صفحات HTML — `<link rel="manifest">` و meta tags PWA؛ `push-init.js` فقط در dashboard/profile/messages لود می‌شود.

### تست با curl

```bash
# 1) کلید عمومی
curl http://localhost:3000/api/push/vapid-public-key

# 2) ثبت یک subscription فیک (نیازمند سشن — برای smoke test از مرورگر بهتر است)
curl -X POST http://localhost:3000/api/push/subscribe \
  -H 'Content-Type: application/json' \
  -b "connect.sid=…" \
  -d '{"endpoint":"https://example.com/x","keys":{"p256dh":"abc","auth":"xyz"}}'
```

---

## فاز ۴ — Bottom Navigation + ساختار صفحات + دسته‌بندی تراکنش‌ها

ساختار جدید اپ بر مبنای **هدر ثابت بالا + bottom-nav ثابت پایین + کارت‌های محتوا در `.page-content`** بنا شد. تمام صفحات کاربری از حالا یک shell یکسان دارند و کلاس‌های Phase-4 (مثل `.app-header`, `.page-content > .card`, `.section-title`, `.empty-state`, `.fab`) همگی در `public/css/style.css` تعریف شده‌اند و **scope** آن‌ها تنها در داخل ظرف Phase-4 است تا با صفحات auth/profile (که هنوز از `.topbar` و `.card` قدیمی استفاده می‌کنند) تداخلی پیش نیاید.

### Bottom navigation (۶ تب — ترتیب RTL)

| تب | href | آیکن | قفل |
|---|---|---|---|
| خانه           | `/dashboard.html`    | `ti-home`            | — |
| تراکنش‌ها       | `/transactions.html` | `ti-arrows-exchange` | — |
| گزارشات        | `/reports.html`      | `ti-chart-bar`       | — |
| نمای بازار      | `/market.html`       | `ti-trending-up`     | — |
| پیشنهاد تخصصی  | `/expert.html`       | `ti-bulb`            | فقط با اشتراک |
| دارایی‌ها       | `/assets.html`       | `ti-wallet`          | فقط با اشتراک |

- bottom-nav توسط `public/js/bottom-nav.js` به‌صورت داینامیک تزریق می‌شود (با inline styles؛ تداخل CSS صفر).
- وضعیت اشتراک با `GET /api/subscription/status` چک می‌شود؛ اگر `is_active: true` بود قفل برداشته می‌شود.
- کلیک روی تب قفل‌شده → یک `DakhlyarModal.confirm` با عنوان «دسترسی محدود» باز می‌شود و کاربر را به `/profile.html#subscription` می‌برد.

### دیتابیس (categories + category_requests)

```sql
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('expense','income','both')),
  is_default INTEGER DEFAULT 1,
  user_id INTEGER DEFAULT NULL,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE category_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('expense','income','both')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  admin_note TEXT DEFAULT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  reviewed_at TEXT DEFAULT NULL
);
```

در اولین راه‌اندازی، جدول `categories` با ۱۲ دسته‌ی expense و ۶ دسته‌ی income پیش‌فرض seed می‌شود؛ هرگز re-seed نمی‌شود.

### API endpoints

| Method | Path | احراز | توضیح |
|---|---|---|---|
| GET   | `/api/categories?type=expense|income|both`            | لاگین | لیست دسته‌های پیش‌فرض + سفارشی کاربر |
| POST  | `/api/categories/request`                              | لاگین | درخواست دسته‌ی جدید (name<=۳۰، رنگ hex، نوع معتبر) |
| GET   | `/api/categories/requests`                             | لاگین | وضعیت درخواست‌های خود کاربر |
| GET   | `/api/admin/categories/requests`                       | ادمین | لیست همه‌ی درخواست‌ها + مشخصات کاربر |
| PATCH | `/api/admin/categories/requests/:id`                   | ادمین | `{ action: 'approve'\|'reject', admin_note? }` |

تایید درخواست به‌صورت اتمیک:
1. `INSERT INTO categories (… , user_id, is_default=0)`
2. `UPDATE category_requests SET status='approved'`
3. ارسال پیام به کاربر («دسته‌بندی «X» به لیست شما اضافه شد»)

رد درخواست تنها وضعیت را تغییر می‌دهد و یک پیام با دلیل (در صورت ثبت توسط ادمین) ارسال می‌کند.

### فایل‌های جدید

- `server/controllers/categoriesController.js`
- `server/routes/categories.js`
- `public/js/bottom-nav.js` — DakhlyarNav.init(activeTab)
- `public/js/app-common.js` — toPersianDigits + بروزرسانی badge پیام‌ها هر ۶۰ ثانیه
- `public/js/subscription-gate.js` — checkSubscriptionGate + showLockedScreen
- `public/transactions.html` — empty-state + FAB
- `public/reports.html` — empty-state
- `public/market.html` — empty-state
- `public/expert.html` — gate شده با اشتراک
- `public/assets.html` — gate شده با اشتراک

### فایل‌های گسترش‌یافته

- `server/db/appDb.js` — مهاجرت دو جدول جدید + seed یکباره‌ی دسته‌های پیش‌فرض
- `server/index.js` — mount مسیر `/api/categories` + مسیرهای ادمین
- `server/swagger/swaggerConfig.js` — تگ‌های جدید «دسته‌بندی‌ها» و «مدیریت دسته‌بندی‌ها (ادمین)» + ۵ endpoint
- `public/dashboard.html` — مهاجرت به app-header + page-content + DakhlyarNav.init('home')
- `public/css/style.css` — افزودن tokenهای `--color-*` / `--radius-*` / `--shadow-*-4` به `:root` و کلاس‌های Phase-4 (scoped تحت `.app-header` و `.page-content`)

### نکات مهم پیاده‌سازی

- `bottom-nav.js` همیشه **بعد از** `modal.js` لود می‌شود تا modal آماده باشد (در حالت قفل).
- بدنه‌ی صفحات Phase-4 باید کلاس `app-shell-body` داشته باشد تا padding هدر/nav رعایت شود.
- وضعیت اشتراک سمت کلاینت چک می‌شود — سرور همچنان روی هر فراخوانی API گیت اعمال می‌کند.
- `category_requests` در `(user_id, lower(name))` غیر یکتا است ولی منطق controller از ایجاد چند pending هم‌نام جلوگیری می‌کند.
- دسته‌های پیش‌فرض هرگز ویرایش نمی‌شوند؛ کاربر فقط می‌تواند درخواست افزودن دسته‌ی جدید بدهد.

### تست با curl

```bash
# لیست دسته‌ها (نیاز به سشن لاگین)
curl -b cookie.txt 'http://localhost:3000/api/categories?type=expense'

# درخواست دسته‌ی جدید
curl -X POST -b cookie.txt -H 'Content-Type: application/json' \
  http://localhost:3000/api/categories/request \
  -d '{"name":"هزینه خودرو","icon":"🚙","color":"#1A5C3A","type":"expense"}'

# (ادمین) لیست درخواست‌ها
curl -b admin-cookie.txt http://localhost:3000/api/admin/categories/requests

# (ادمین) تایید
curl -X PATCH -b admin-cookie.txt -H 'Content-Type: application/json' \
  http://localhost:3000/api/admin/categories/requests/1 \
  -d '{"action":"approve","admin_note":"تبریک"}'
```

---

## فاز ۵ — تراکنش‌ها (Transactions)

این فاز هسته‌ی اپ مالی را اضافه می‌کند: ثبت/ویرایش/حذف تراکنش‌های درآمد و
هزینه، مرور لیست به‌صورت گروه‌بندی روزانه، فیلتر/جستجو، خلاصه ماهانه، تگ‌ها،
تراکنش‌های تکراری با یادآور، و وارد کردن گروهی از فایل CSV.

### مفاهیم کلیدی

- `amount` همیشه **عدد صحیح مثبت در تومان** ذخیره می‌شود. فیلد `type` (`income` یا `expense`) جهت تراکنش را مشخص می‌کند.
- ارز: فعلاً فقط تومان (`currency = 'IRR'`). اما ستون‌های `amount_original`, `currency_original`, `exchange_rate` در دیتابیس هستند تا در فاز بعدی برای ارزهای خارجی استفاده شوند.
- حذف فقط به صورت **نرم (`is_deleted = 1`)** انجام می‌شود؛ هیچ ردیفی فیزیکی حذف نمی‌شود.
- تگ‌ها به صورت **denormalized در `transactions.tags`** (کاما-جدا) و همزمان در جدول `transaction_tags` با `usage_count` ذخیره می‌شوند.
- وام/قسط/BNPL: نوع خاصی نیستند — از دسته‌ی پیش‌فرض «وام و اعتبار» (type=both) استفاده می‌شود؛ دریافت وام = درآمد، پرداخت قسط = هزینه.

### تغییرات دیتابیس (`server/db/appDb.js`)

سه جدول جدید با migrations idempotent:

```sql
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income','expense')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  currency TEXT DEFAULT 'IRR',
  amount_original INTEGER, currency_original TEXT, exchange_rate INTEGER,
  category_id INTEGER NOT NULL,
  title TEXT NOT NULL, note TEXT, tags TEXT,
  transaction_date TEXT NOT NULL, transaction_time TEXT,
  is_recurring INTEGER DEFAULT 0,
  recurring_interval TEXT CHECK (recurring_interval IS NULL OR recurring_interval IN ('weekly','monthly','yearly')),
  is_deleted INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_transactions_user_date ON transactions(user_id, transaction_date DESC);
CREATE INDEX idx_transactions_user_type ON transactions(user_id, type);
CREATE INDEX idx_transactions_category  ON transactions(category_id);

CREATE TABLE IF NOT EXISTS transaction_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280',
  usage_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, name)
);

CREATE TABLE IF NOT EXISTS recurring_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  transaction_id INTEGER NOT NULL,
  alert_sent_at TEXT,
  next_expected TEXT NOT NULL
);
```

همچنین دسته‌ی پیش‌فرض **«وام و اعتبار»** (type=both, icon=🏦, color=#6366F1) به seed
اضافه شد؛ روی دیتابیس‌های قدیمی هم به صورت idempotent درج می‌شود.

### API های جدید

| روش    | مسیر                                | شرح                                                  |
| ------- | ----------------------------------- | ---------------------------------------------------- |
| GET     | `/api/transactions`                 | لیست با فیلتر/صفحه‌بندی + summary در همان scope     |
| GET     | `/api/transactions/:id`             | جزئیات یک تراکنش                                     |
| POST    | `/api/transactions`                 | ثبت تراکنش جدید                                      |
| PATCH   | `/api/transactions/:id`             | ویرایش جزئی                                          |
| DELETE  | `/api/transactions/:id`             | حذف نرم                                              |
| POST    | `/api/transactions/bulk-delete`     | حذف نرم چند تراکنش                                   |
| POST    | `/api/transactions/import`          | وارد کردن **CSV یا Excel** (multipart) — حداکثر ۲ مگابایت |
| GET     | `/api/transactions/sample-csv`      | دانلود فایل نمونه (UTF-8 BOM برای Excel)            |
| GET     | `/api/transactions/tags`            | تگ‌های کاربر مرتب بر اساس usage_count                |
| GET     | `/api/transactions/summary`         | خلاصه ماهانه + ۳ دسته‌ی برتر هزینه + اشتراک‌های تکراری |
| GET     | `/api/transactions/recurring`       | لیست تراکنش‌های تکراری با next_expected             |

تمام endpoint ها نیازمند session هستند (401 برای کاربر مهمان، 403 برای دسترسی به ردیف کاربر دیگر).

### قوانین ولیدیشن (POST/PATCH)

- `type` ∈ `{income, expense}`
- `amount > 0` و `amount ≤ 999,999,999,999`
- `title` تا ۶۰ کاراکتر، `note` تا ۵۰۰، `tags` تا ۵ مورد و هر تگ تا ۲۰
- نوع دسته با نوع تراکنش هماهنگ (`both` یعنی هردو)
- `is_recurring=true` → `recurring_interval` الزامی
- `transaction_date` به فرمت `YYYY-MM-DD` — هم میلادی و هم شمسی پذیرفته می‌شود (تشخیص خودکار با سال < 2000)

### فایل نمونه CSV (`sample/transactions_sample.csv`)

با سرستون‌های فارسی:

```
نوع,عنوان,مبلغ (تومان),دسته‌بندی,تاریخ (YYYY-MM-DD),یادداشت,تگ‌ها,تکراری
هزینه,ناهار رستوران,185000,خوراک و رستوران,1404-03-01,با همکاران,کاری,خیر
هزینه,اشتراک نتفلیکس,120000,اشتراک‌های دیجیتال,1404-03-01,,سرگرمی,بله
درآمد,حقوق اردیبهشت,15000000,حقوق,1404-03-01,حقوق ماه اردیبهشت,,خیر
```

قوانین import:
- `نوع` = `هزینه` یا `درآمد`
- `تاریخ` می‌تواند شمسی یا میلادی باشد، سرور به میلادی تبدیل می‌کند
- `دسته‌بندی`: تطبیق case-insensitive — اگر پیدا نشد، fallback به «متفرقه» و افزودن به warnings
- `تکراری` = `بله` (تکراری ماهانه پیش‌فرض) یا `خیر`
- ردیف‌های نامعتبر در `errors` بازگردانده می‌شوند ولی **هرگز ۵۰۰ نمی‌گیرید** — همیشه 200 با خلاصه

### تراکنش‌های تکراری و یادآور بودجه (`server/utils/recurringHelper.js`)

- `calculateNextDate(date, interval)` — اضافه‌کردن weekly/monthly/yearly با clamp روز انتهای ماه.
- `checkRecurringTransactions()` — اسکن `recurring_alerts` که `next_expected ≤ امروز` و `alert_sent_at` امروز فعال نشده — برای هرکدام پیام «یادآور تراکنش تکراری» می‌فرستد، push می‌زند و `next_expected` را با interval بعدی به‌روز می‌کند. در scheduler ساعتی `server/index.js` ثبت شده (dedup داخلی → safe to run hourly).
- `checkBudgetAlert(userId, categoryId, month)` — بعد از هر POST/PATCH صدا زده می‌شود. اگر جدول `budgets` (فاز ۶) وجود نداشته باشد، **به‌صورت silent skip** می‌شود — هیچ خطایی پرتاب نمی‌کند.

### Helper های فرانت

- `public/js/jalali.js` — الگوریتم jalaali-js inline، بدون CDN. توابع `toJalali`, `toGregorian`, `todayJalali`, `jalaliToStr`, `persianMonthName`, `persianDayName`, `formatJalaliFromGregorian`, `jStrFromGregorian`, `gStrFromJalali`, `formatJalaliShort`, `toPersian`, `withSeparators`.
- `public/js/app-common.js` (افزوده شد): `formatToman(n)` و `formatTomanShort(n)` (ک/میلیون/میلیارد).
- `public/css/transactions.css` — استایل کامل صفحه تراکنش‌ها، Bottom Sheet ها، grid دسته‌بندی، tag pills، toggle، FAB.

### صفحه‌ی تراکنش‌ها (`public/transactions.html` + `public/js/transactions.js`)

- هدر app shell + Sticky Summary (درآمد/هزینه/مانده برای ماه جاری).
- لیست گروه‌بندی شده بر اساس روز شمسی، پشتیبانی infinite scroll با دکمه «بارگذاری بیشتر».
- FAB پایین چپ → Bottom Sheet افزودن (Type toggle، amount big input با format لحظه‌ای، grid دسته با فیلتر type، title/note با شمارنده، Jalali date با pretty preview، tag input با پیشنهاد، recurring toggle با interval chips).
- تب روی هر آیتم → Bottom Sheet جزئیات با دکمه ویرایش / حذف (با تایید `DakhlyarModal.confirm`).
- Bottom Sheet فیلتر (نوع، بازه زمانی، دسته، جستجو).
- Bottom Sheet import (دانلود نمونه + آپلود فایل + نمایش imported/failed/errors/warnings).

### نمونه `curl`

```bash
# 1. لاگین → دریافت session cookie
curl -c jar.txt -H 'Content-Type: application/json' \
  -d '{"mobile":"09120000005","password":"Smoke@1234"}' \
  http://localhost:3000/api/auth/login

# 2. ثبت یک تراکنش هزینه
curl -b jar.txt -X POST -H 'Content-Type: application/json' \
  -d '{"type":"expense","amount":185000,"category_id":1,
       "title":"ناهار","transaction_date":"1404-03-15","tags":["کاری"]}' \
  http://localhost:3000/api/transactions

# 3. خلاصه ماه جاری
curl -b jar.txt http://localhost:3000/api/transactions/summary

# 4. وارد کردن CSV
curl -b jar.txt -F "file=@sample/transactions_sample.csv;type=text/csv" \
  http://localhost:3000/api/transactions/import
```

### فایل‌های جدید این فاز

- `server/routes/transactions.js`
- `server/controllers/transactionsController.js`
- `server/utils/recurringHelper.js`
- `sample/transactions_sample.csv`
- `public/js/jalali.js`
- `public/css/transactions.css`

### فایل‌های ویرایش‌شده (مجاز در spec)

- `server/db/appDb.js` — migrations + seed دسته‌ی جدید
- `server/index.js` — mount روت + serve `/sample` + scheduler hook
- `public/js/app-common.js` — افزودن `formatToman`, `formatTomanShort`
- `public/transactions.html` — UI کامل (روی shell فاز ۴ بنا شده)
- `server/swagger/swaggerConfig.js` — مستندات Persian تمام endpoint های جدید
- `package.json` — افزودن `jalaali-js`، `papaparse` و `xlsx`

### واکنش‌گرایی (Responsive)

Bottom Sheet ها فقط در نمای موبایل (`< 768px`) از پایین بالا می‌آیند؛ در نمای
دسکتاپ (`≥ 768px`) خودکار به **modal مرکزی** (max-width 520px، گوشه‌های گرد، fade-in)
تبدیل می‌شوند. تمام دکمه‌های Sheet (تایید، حذف، فیلتر، import) از تک کلاس DLS
`dk-sheet-btn primary|secondary|danger` استفاده می‌کنند که با دکمه‌های Modal سراسری
هماهنگ است (height 48، radius 14، رنگ‌های primary/danger، فوکوس accent).

---

## فاز ۶ — بودجه، گزارشات، مقایسه ماهانه و صادرکردن

این فاز سیستم بودجه‌بندی ماهانه، گزارش‌های تحلیلی، امتیاز مالی gamification،
و خروجی CSV/PDF را اضافه می‌کند.

### تغییرات دیتابیس

- `budgets` — بودجه ماهانه per category (UNIQUE روی user+category+month)
- `financial_scores` — کش امتیاز مالی ماهانه (breakdown به صورت JSON)

### API بودجه (`/api/budgets`)

| متد | مسیر | توضیح |
|-----|------|-------|
| GET | `/api/budgets?month=YYYY-MM` | لیست بودجه‌ها + spent/remaining/status |
| POST | `/api/budgets` | upsert بودجه یک دسته |
| POST | `/api/budgets/bulk` | upsert چند بودجه |
| DELETE | `/api/budgets/:id` | حذف بودجه |
| GET | `/api/budgets/zbb?month=` | وضعیت بودجه‌ریزی صفرمحور |
| POST | `/api/budgets/copy-from-last-month` | کپی از ماه قبل |

هشدار بودجه (۸۰٪ و ۱۰۰٪) از طریق `checkBudgetAlert` در `recurringHelper.js`
فعال است و پیام + push ارسال می‌کند.

### API گزارشات (`/api/reports`)

- `GET /monthly` — گزارش ماهانه (income/expense/daily_totals)
- `GET /comparison` — مقایسه ۳–۶ ماه
- `GET /weekly-pattern` — الگوی خرج روزهای هفته
- `GET /cash-flow-forecast` — پیش‌بینی پایان ماه
- `GET /net-worth-snapshot` — موجودی تجمعی ۱۲ ماه
- `GET /subscription-tracker` — اشتراک‌های تکراری ماهانه
- `GET /score` — امتیاز مالی ۰–۱۰۰
- `GET /export/csv?month=` — دانلود CSV (تاریخ شمسی)
- `GET /export/pdf?month=` — دانلود PDF (فونت Vazirmatn)

### صفحه گزارشات (`/reports.html`)

۸ بخش: امتیاز مالی (SVG arc)، خلاصه، دونات هزینه، مقایسه ماهانه،
الگوی هفتگی، پیش‌بینی، اشتراک‌ها، export. دکمه «تنظیم بودجه» sheet
مدیریت بودجه را باز می‌کند (`budget.js`).

### نمودارها

`public/js/charts.js` — SVG خالص (بدون Chart.js): donut، bar، score arc، week bars.

### صادرکردن

```bash
# CSV ماه جاری (نیاز به session cookie)
curl -b cookies.txt -OJ "http://localhost:3000/api/reports/export/csv?month=2025-06"

# PDF گزارش ماهانه
curl -b cookies.txt -OJ "http://localhost:3000/api/reports/export/pdf?month=2025-06"
```

فونت PDF: `server/fonts/Vazirmatn-Regular.ttf` و `Vazirmatn-Bold.ttf`

---

## فاز ۷ — اهداف پس‌انداز + ZBB + پیش‌بینی

### جداول جدید

- `savings_goals` — اهداف مالی (title, target_amount, saved_amount, deadline, …)
- `goal_contributions` — تاریخچه واریز/برداشت هر هدف

### API اهداف (`/api/goals`)

| متد | مسیر | توضیح |
|-----|------|-------|
| GET | `/api/goals?include_completed=` | لیست اهداف + percentage + monthly_needed |
| POST | `/api/goals` | ایجاد هدف جدید |
| PATCH | `/api/goals/:id` | ویرایش هدف |
| DELETE | `/api/goals/:id` | حذف هدف + contributions |
| POST | `/api/goals/:id/contribute` | واریز — در تکمیل، پیام «هدف تکمیل شد 🎉» |
| POST | `/api/goals/:id/withdraw` | برداشت |
| GET | `/api/goals/:id/history` | تاریخچه واریز/برداشت |

`saved_amount` همیشه از طریق contribute/withdraw به‌روز می‌شود (نه محاسبه از contributions در read).

### صفحه اهداف (`/goals.html`)

- کارت خلاصه پیشرفت کلی
- ویجت پیش‌بینی جریان نقدی (`GET /api/reports/cash-flow-forecast`)
- ویجت بودجه‌ریزی صفرمحور (`GET /api/budgets/zbb`) + لینک به `/reports.html#budget`
- لیست اهداف با progress bar، واریز/برداشت، تاریخچه
- sheet افزودن/ویرایش هدف (ایموجی، رنگ، تاریخ شمسی)

### داشبورد

کارت میانبر «اهداف پس‌انداز» در `dashboard.html` — تعداد اهداف فعال + درصد پیشرفت → `/goals.html`

---

## فاز ۸ — نمای بازار (BrsApi.ir)

### تنظیم API Key

در `.env` کلید BrsApi را اضافه کنید (فقط سمت سرور — هرگز در frontend):

```env
BRSAPI_KEY=your_brsapi_key_here
```

کلید را از [BrsApi.ir](https://brsapi.ir) دریافت کنید. بدون این کلید، API بازار پاسخ `503` می‌دهد.

### جداول

- `market_cache` — کش ۱۵ دقیقه‌ای دادهٔ عمومی (مشترک بین همه کاربران)
- `market_favorites` — علاقه‌مندی‌ها و پین per-user

### API (`/api/market`)

| متد | مسیر | توضیح |
|-----|------|-------|
| GET | `/gold-currency` | طلا، سکه، ارز |
| GET | `/crypto` | رمزارز |
| GET | `/commodity` | کامودیتی |
| GET | `/all` | همه دسته‌ها یکجا |
| GET/POST | `/favorites` | علاقه‌مندی‌ها |
| DELETE | `/favorites/:symbol?category=` | حذف |
| PATCH | `/favorites/:symbol/pin` | پین/آنپین |

Query `?force=true` — بروزرسانی اجباری (حداکثر ۱ بار در دقیقه per IP).

### صفحه `/market.html`

تب‌ها: طلا و ارز | کریپتو | کامودیتی | علاقه‌مندی‌ها — جستجو، کارت ۲ ستونه، ⭐ علاقه‌مندی، بروزرسانی خودکار هر ۱۵ دقیقه.

---

## فاز ۹ — دارایی‌ها (Assets)

ثبت دستی دارایی‌های شخصی (طلا، سکه، ارز، کریپتو، ملک، …) و محاسبه **ارزش تقریبی** بر مبنای قیمت بازار (کش Phase 8) یا قیمت دستی کاربر. **نیازمند اشتراک فعال** (هم سمت سرور و هم UX با `subscription-gate.js`).

### جداول (`dakhlyar_app.db`)

| جدول | توضیح |
|------|--------|
| `assets` | دارایی‌های ثبت‌شده per-user (soft delete با `is_active=0`) |
| `asset_snapshots` | snapshot روزانه ارزش کل + JSON جزئیات |

### انواع دارایی

تعریف ثابت در `server/utils/assetPriceHelper.js` (`ASSET_TYPES`) — ۱۴ نوع auto-priced (از `market_cache`) + ۷ نوع manual-priced.

### API (`/api/assets`)

| متد | مسیر | اشتراک | توضیح |
|-----|------|--------|-------|
| GET | `/types` | خیر | لیست انواع قابل ثبت |
| GET | `/` | بله | لیست دارایی + `total_value` + گروه‌بندی |
| POST | `/` | بله | افزودن دارایی |
| PATCH | `/:id` | بله | ویرایش |
| DELETE | `/:id` | بله | حذف نرم |
| GET | `/history?days=30` | بله | تاریخچه snapshot |
| GET | `/net-worth` | بله | خلاصه خالص دارایی |

### صفحه `/assets.html`

- کارت hero ارزش کل (~ prefix)
- فیلتر ریسک: همه | امن | بدون ریسک | ریسکی
- sheet افزودن/ویرایش با grid نوع دارایی + preview زنده
- sheet ترکیب دارایی (donut chart)
- تاریخچه ۷/۳۰ روزه

---

## فاز ۱۰ — پیشنهاد تخصصی (Expert)

ادمین پیشنهادات مالی منتشر می‌کند؛ کاربران دارای **اشتراک فعال** آن‌ها را می‌بینند و وضعیت (در انتظار / انجام‌شده / رد شده) را ثبت می‌کنند.

### جداول

| جدول | توضیح |
|------|--------|
| `expert_recommendations` | پیشنهادات منتشرشده (action یا alert) |
| `user_recommendation_status` | وضعیت per-user (پیش‌فرض: pending) |

### API کاربر (`/api/expert`)

| متد | مسیر | توضیح |
|-----|------|-------|
| GET | `/recommendations` | لیست + counts |
| GET | `/recommendations/:id` | جزئیات |
| PATCH | `/recommendations/:id/status` | pending / done / dismissed |

### API ادمین (`/api/admin/expert`)

| متد | مسیر | توضیح |
|-----|------|-------|
| GET | `/recommendations` | لیست + آمار وضعیت کاربران |
| POST | `/recommendations` | ایجاد + push + پیام in-app |
| PATCH | `/recommendations/:id` | ویرایش / غیرفعال‌سازی |
| DELETE | `/recommendations/:id` | حذف کامل |

### صفحه `/expert.html`

- آمار pending / done / dismissed
- فیلتر: فقط فعال | همه / اقدام / هشدار
- کارت‌ها با border اولویت + badge وضعیت
- sheet جزئیات — دکمه‌های وضعیت فقط برای type=action

---

## فاز ۱۱ — امتیاز مالی + بینش رفتاری + داشبورد خانه

داشبورد placeholder با صفحه‌ی خانه‌ی کامل جایگزین شد؛ صفحه‌ی اختصاصی امتیاز مالی (`/score.html`) و دو endpoint جدید برای تاریخچه امتیاز و بینش‌های رفتاری اضافه شد.

### API جدید (`/api/reports`)

| متد | مسیر | توضیح |
|-----|------|-------|
| GET | `/score/history?months=6` | تاریخچه امتیاز (حداکثر ۱۲ ماه) + `best_month` + `avg_score` + `trend` |
| GET | `/insights?months=3` | ۶ نوع بینش: peak_day، category_trend، savings_rate، subscriptions، budget_adherence، logging_streak |

### صفحه `/dashboard.html`

۱۰ بخش: hero ارزش کل (net-worth یا مانده تراکنش)، quick actions، بنر تبلیغ (placeholder Phase 13)، خلاصه ماهانه + mini chart، widget امتیاز، ticker بازار (refresh هر ۵ دقیقه)، آخرین ۵ تراکنش، پیشرفت اهداف، یک بینش تصادفی.

- بارگذاری موازی با `Promise.allSettled` — خطای یک بخش بقیه را متوقف نمی‌کند
- مخفی‌سازی مبالغ با آیکن چشم (`sessionStorage`)
- بدون اشتراک: hero فقط مانده تراکنش + یادداشت تهیه اشتراک

### صفحه `/score.html`

- Arc بزرگ SVG (۲۰۰px) + label
- نمودار میله‌ای ۶ ماهه + خط روند
- ۵ کارت تفکیک امتیاز (از `breakdown`)
- لیست کامل بینش‌ها + پیشنهادهای بهبود (`tips`)

### فایل‌های جدید

- `public/css/dashboard.css` — استایل داشبورد + skeleton pulse
- `public/css/score.css` — استایل صفحه امتیاز
- `public/js/dashboard.js` — منطق بارگذاری داشبورد
- `public/js/score.js` — منطق صفحه امتیاز
- `public/score.html`

---

## فاز ۱۲ — دنگ و دونگ

مینی‌اپ **دنگ و دونگ** برای تقسیم هزینه گروهی داخل دخلیار — بدون نیاز به اشتراک.

### جداول (`dakhlyar_app.db`)

| جدول | توضیح |
|------|--------|
| `split_groups` | گروه + `invite_token` برای لینک عمومی |
| `split_members` | اعضا (registered با `user_id` یا guest با `mobile`) |
| `split_expenses` | هزینه‌های گروه (soft delete) |
| `split_expense_shares` | سهم هر عضو per-expense |
| `split_settlements` | تسویه‌های انجام‌شده (+ اختیاری `transaction_id`) |

### الگوریتم تهاتر

`server/utils/splitHelper.js` — `calculateBalances` + `calculateMinimumSettlements` (greedy min-cash-flow). تقسیم مساوی: باقیمانده ۱ تومان به پرداخت‌کننده.

### API (`/api/split`)

| متد | مسیر | Auth | توضیح |
|-----|------|------|-------|
| GET | `/public/:token?mobile=` | خیر | نمای عمومی برای guest |
| GET | `/groups` | بله | لیست گروه‌ها + مانده من |
| POST | `/groups` | بله | ایجاد گروه |
| GET | `/groups/:id` | بله | جزئیات کامل + تسویه پیشنهادی |
| POST | `/groups/:id/members` | بله | افزودن عضو (سازنده) |
| DELETE | `/groups/:id/members/:memberId` | بله | حذف عضو |
| POST | `/groups/:id/expenses` | بله | ثبت هزینه (equal/custom) |
| PATCH/DELETE | `/groups/:id/expenses/:expenseId` | بله | ویرایش/حذف |
| POST | `/groups/:id/settle` | بله | تسویه (+ اختیاری تراکنش) |
| GET | `/lookup-mobile?mobile=` | بله | جستجوی کاربر دخلیار |

### صفحات

- `/split.html` — لیست گروه‌ها، جزئیات با تب‌های هزینه‌ها/تسویه/اعضا، FAB ثبت هزینه
- `/split-view.html?token=…&member=…` — مشاهده بدهی بدون ورود
- داشبورد: quick action «دنگ و دونگ»

### لینک shareable

```
/split-view.html?token={invite_token}&member={mobile}
```

---

## فاز ۱۳ — بنرهای تبلیغاتی

ادمین بنر آپلود می‌کند با تاریخ شروع/پایان؛ داشبورد carousel چرخشی نمایش می‌دهد. بدون بنر فعال، بخش بنر مخفی می‌ماند.

### جدول (`dakhlyar_admin.db`)

| جدول | توضیح |
|------|--------|
| `banners` | تصویر، لینک، بازه زمانی، CTR، impression/click count |

### API عمومی (`/api/banners`)

| متد | مسیر | Auth | توضیح |
|-----|------|------|-------|
| GET | `/active` | session | بنرهای فعال + impression (async) |
| POST | `/:id/click` | session | ثبت کلیک (fire-and-forget) |

### API ادمین (`/api/admin/banners`)

| متد | مسیر | توضیح |
|-----|------|-------|
| GET | `/` | لیست + status + ctr |
| GET | `/stats` | آمار کلی |
| POST | `/` | آپلود multipart (max 3MB) |
| PATCH | `/:id` | ویرایش (+ جایگزینی تصویر) |
| DELETE | `/:id` | حذف فایل + رکورد |

### فرانت‌اند

- `public/js/banner.js` — کلاس `DakhlyarBanner` (carousel، swipe، dots، auto-advance 4s)
- `public/css/banner.css` — استایل carousel
- داشبورد: `#dash-banner` div + fetch از `/api/banners/active`

---

## فاز ۱۴-A — پنل ادمین (زیرساخت + احراز هویت)

پنل وب جداگانه در مسیر `/admin` با session مستقل (`dakhlyar_admin_sid`)، دیتابیس `dakhlyar_admin.db` و فایل‌های HTML/CSS/JS اختصاصی.

### دسترسی

1. مرورگر: `http://localhost:3000/admin` (redirect به login)
2. ورود پیش‌فرض: **admin** / **admin** (در اولین ورود تغییر رمز اجباری است)
3. پس از ورود: داشبورد در `/admin/dashboard.html`

### متغیر `.env`

```env
ADMIN_SESSION_SECRET=your_admin_session_secret_here
```

اگر تنظیم نشود، از `SESSION_SECRET` استفاده می‌شود.

### جداول (`dakhlyar_admin.db`)

| جدول | توضیح |
|------|--------|
| `admins` | حساب مدیران (+ `must_change_password`, `last_login`) |
| `admin_sessions` | توکن session (آینده) |
| `admin_activity_log` | لاگ login/logout و عملیات مدیریتی |

### API احراز هویت (`/api/admin/auth`)

| متد | مسیر | Auth | توضیح |
|-----|------|------|-------|
| POST | `/login` | — | ورود + ایجاد session |
| POST | `/logout` | admin | خروج |
| GET | `/me` | admin | اطلاعات ادمین جاری |
| POST | `/change-password` | admin | تغییر رمز (skip current اگر must_change) |

### API مدیریت مدیران (`/api/admin/admins`) — فقط superadmin

| متد | مسیر | توضیح |
|-----|------|-------|
| GET | `/` | لیست ادمین‌ها |
| POST | `/` | افزودن ادمین |
| PATCH | `/:id` | ویرایش email/role/is_active |
| DELETE | `/:id` | حذف (حفظ حداقل یک superadmin) |

### فرانت‌اند

```
public/admin/
├── login.html, dashboard.html, admins.html (+ shell pages)
├── css/admin-base.css, admin-login.css
└── js/admin-api.js, admin-layout.js, admin-login.js
```

### نمونه ورود (curl)

```bash
curl -c cookies.txt -X POST http://localhost:3000/api/admin/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin"}'

curl -b cookies.txt http://localhost:3000/api/admin/auth/me
```

---

## فاز ۱۴-B — داشبورد ادمین + آمار

داشبورد کامل با KPI، نمودار SVG، درخواست‌های در انتظار، آمار بنر و لاگ فعالیت.

### API آمار (`/api/admin/stats`)

| متد | مسیر | توضیح |
|-----|------|-------|
| GET | `/overview` | KPI — کاربران، احراز، اشتراک، تراکنش، بنر، اهداف |
| GET | `/growth` | رشد ۶ ماه — کاربر، اشتراک، تراکنش |
| GET | `/subscription-revenue?months=6` | درآمد/تعداد اشتراک ماهانه |
| GET | `/top-categories` | پرکاربردترین دسته‌بندی‌ها |
| GET | `/pending-verifications` | ۵ درخواست احراز در انتظار (داشبورد) |
| GET | `/pending-subscriptions` | ۵ درخواست اشتراک در انتظار |
| GET | `/banners` | جدول آمار بنرها |

### لاگ فعالیت

```
GET /api/admin/activity-log?page=1&limit=20&admin_id=
```

### فرانت‌اند

- `public/admin/dashboard.html` — داشبورد کامل
- `public/admin/css/admin-dashboard.css`
- `public/admin/js/admin-charts.js` — نمودار SVG (bar, donut, line)
- `public/admin/js/admin-dashboard.js` — fetch + render + refresh KPI هر ۵ دقیقه

### نکات

- آمار از **appDb** (کاربران/تراکنش) + **adminDb** (بنرها) خوانده می‌شود
- `total_impressions_today` / `total_clicks_today` فعلاً ۰ (ردیابی روزانه پیاده نشده)
- `revenue_this_month` از `subscription_requests` تاییدشده محاسبه می‌شود
- تایید/رد inline از `/api/admin/stats/pending-*` (با session جدید ادمین)

---

## فاز ۱۴-C — مدیریت کاربران

صفحه کامل `/admin/users.html` با ۳ تب: همه کاربران | احراز | اشتراک.

### API کاربران (`/api/admin/users`)

| متد | مسیر | توضیح |
|-----|------|-------|
| GET | `/` | لیست + فیلتر + صفحه‌بندی |
| GET | `/search?mobile=` | جستجوی سریع موبایل |
| GET | `/:id` | جزئیات کامل + آمار + درخواست‌ها |
| PATCH | `/:id/reset-stories` | ریست استوری یک کاربر |
| POST | `/reset-stories-all` | ریست استوری همه |

### API احراز (`/api/admin/verification`)

| متد | مسیر | توضیح |
|-----|------|-------|
| GET | `/requests` | لیست درخواست‌ها (status, page) |
| PATCH | `/requests/:id` | `{ action: approve\|reject, admin_note? }` |

### API اشتراک (`/api/admin/subscription`)

| متد | مسیر | توضیح |
|-----|------|-------|
| GET | `/requests` | لیست درخواست‌ها |
| PATCH | `/requests/:id` | تایید/رد + referral hook |

### فرانت‌اند

- `public/admin/users.html` — ۳ تب + modal جزئیات + bulk actions
- `public/admin/css/admin-users.css`
- `public/admin/js/admin-users.js`

### نکات

- جستجوی سریع موبایل در بالای صفحه — باز کردن مستقیم modal جزئیات
- تب‌ها با `?tab=users|verification|subscription`
- تایید/رد: ثبت در `admin_activity_log` + پیام کاربر (Phase 3-D)
- مسیر `/api/admin/admins` برای مدیریت حساب‌های مدیر (جدا از کاربران)

---

## فاز ۱۴-D — مدیریت محتوا (پنل ادمین)

### صفحات

| صفحه | مسیر | توضیح |
|------|------|--------|
| استوری‌ها | `/admin/stories.html` | آپلود، drag-and-drop ترتیب، فعال/غیرفعال، حذف، ریست برای همه کاربران |
| بنرها | `/admin/banners.html` | CRUD بنر، آمار CTR، زمان‌بندی نمایش |
| پیشنهادات | `/admin/recommendations.html` | ایجاد/ویرایش پیشنهاد کارشناس + push به مشترکین |
| دسته‌بندی‌ها | `/admin/categories.html` | تایید/رد درخواست کاربر + مدیریت دسته‌های پیش‌فرض |

### فایل‌های جدید

```
public/admin/css/admin-content.css
public/admin/js/admin-stories.js
public/admin/js/admin-banners.js
public/admin/js/admin-recommendations.js
public/admin/js/admin-categories.js
server/routes/admin/adminBanners.js
server/routes/admin/adminRecommendations.js
server/routes/admin/adminCategories.js
server/controllers/admin/adminRecommendationsController.js
server/controllers/admin/adminCategoriesController.js
```

### API (session ادمین — `dakhlyar_admin_sid`)

| مسیر | عملیات |
|------|--------|
| `GET/PATCH/DELETE /api/admin/stories` | لیست، ویرایش، حذف استوری |
| `POST /api/admin/stories/upload` | آپلود استوری |
| `POST /api/admin/stories/reset-for-users` | ریست has_seen_stories |
| `GET/POST/PATCH/DELETE /api/admin/banners` | CRUD بنر + `GET .../stats` |
| `GET/POST/PATCH/DELETE /api/admin/expert/recommendations` | CRUD پیشنهاد |
| `GET .../recommendations/subscriber-count` | تعداد مشترکین فعال |
| `GET .../recommendations/:id/stats` | آمار pending/done/dismissed |
| `GET/PATCH /api/admin/categories/requests` | درخواست‌های دسته کاربر |
| `GET/POST/PATCH /api/admin/categories/defaults` | دسته‌های پیش‌فرض |

### نکات

- ترتیب استوری‌ها: HTML5 drag-and-drop — PATCH جداگانه برای هر استوری تغییر‌یافته
- تایید درخواست دسته: ایجاد category **فقط برای user_id درخواست‌کننده** (نه پیش‌فرض سراسری)
- تمام عملیات write در `admin_activity_log` ثبت می‌شود
- مسیرهای قدیمی dev (`req.session.isAdmin`) برای stories/banners/expert/categories از `index.js` جدا شدند

---

## فاز ۱۴-E — پیام‌رسانی (پنل ادمین)

### صفحه

`/admin/messages.html` — دو تب: **ارسال پیام** | **تاریخچه**

### قابلیت‌ها

- پیام گروهی برای همه کاربران (با تأیید اجباری)
- پیام مستقیم به یک کاربر (جستجو با موبایل)
- ارسال پیشنهاد تخصصی به اشتراک‌داران یا یک کاربر
- تاریخچه با نرخ خواندن، فیلتر نوع/بازه، pagination
- پیش‌نمایش زنده پیام + progress/success modal

### API جدید (session ادمین)

| مسیر | عملیات |
|------|--------|
| `POST /api/admin/messages/send` | ارسال پیام (all \| user) + push اختیاری |
| `GET /api/admin/messages/history` | تاریخچه + read_rate + sent_by |
| `GET /api/admin/messages/stats` | آمار امروز/ماه/نرخ خواندن |
| `POST /api/admin/expert/send` | ارسال پیشنهاد به اشتراک‌داران یا کاربر |
| `GET /api/admin/expert/stats/:recommendationId` | آمار تفصیلی پیشنهاد |

### فایل‌های جدید

```
server/routes/admin/adminMessaging.js
server/controllers/admin/adminMessagingController.js
public/admin/css/admin-messaging.css
public/admin/js/admin-messages.js
```

---

## فازهای آینده

- درگاه پرداخت و فعال‌سازی خودکار اشتراک پس از پرداخت
- حساب‌های بانکی و sync خودکار تراکنش‌ها

---

## لایسنس

MIT
