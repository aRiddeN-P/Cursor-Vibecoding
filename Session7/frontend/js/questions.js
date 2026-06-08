// Client-side fallback questions for Solo mode (10 items).
// The live multiplayer game uses server-authoritative questions.json (50 items).
window.SOLO_QUESTIONS = [
  { id: 1, text: "HTML مخفف چیست؟", options: ["HyperText Markup Language", "High Tech Modern Language", "Hyperlink Text Modern Lang", "Home Tool Markup Language"], correct: 0 },
  { id: 2, text: "Git یک ابزار برای چیست؟", options: ["کنترل نسخه", "ویرایش متن", "اجرای سرور", "طراحی گرافیک"], correct: 0 },
  { id: 3, text: "کد وضعیت 404 یعنی چه؟", options: ["منبع پیدا نشد", "موفق", "خطای سرور", "دسترسی غیرمجاز"], correct: 0 },
  { id: 4, text: "تفاوت == و === در JS چیست؟", options: ["=== نوع و مقدار هر دو را چک می‌کند", "هیچ تفاوتی ندارند", "== سریع‌تر است", "=== فقط برای رشته‌ها"], correct: 0 },
  { id: 5, text: "Node.js چیست؟", options: ["محیط اجرای JavaScript", "یک مرورگر", "یک پایگاه داده", "یک ادیتور"], correct: 0 },
  { id: 6, text: "کدام انتخابگر CSS مربوط به id است؟", options: ["#", ".", "*", ":"], correct: 0 },
  { id: 7, text: "REST API چیست؟", options: ["سبکی برای طراحی API بر پایه HTTP", "نوع پایگاه داده", "زبان برنامه‌نویسی", "نوع مرورگر"], correct: 0 },
  { id: 8, text: "نقش .env در پروژه چیست؟", options: ["نگهداری تنظیمات و کلیدهای محرمانه", "فایل اجرایی پروژه", "فایل CSS اصلی", "فایل کانفیگ مرورگر"], correct: 0 },
  { id: 9, text: "Express.js چیست؟", options: ["فریم‌ورک وب برای Node.js", "پایگاه داده", "ابزار طراحی UI", "زبان برنامه‌نویسی"], correct: 0 },
  { id: 10, text: "ngrok چه می‌کند؟", options: ["یک سرور محلی را روی اینترنت در دسترس قرار می‌دهد", "پایگاه داده ابری است", "ادیتور است", "ابزار رمزنگاری است"], correct: 0 }
];

window.shuffleSoloQuestions = function () {
  const arr = window.SOLO_QUESTIONS.map((q) => {
    const idx = [0, 1, 2, 3];
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return {
      id: q.id,
      text: q.text,
      options: idx.map((i) => q.options[i]),
      correct: idx.indexOf(q.correct),
    };
  });
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};
