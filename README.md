# محاسبة جعفر الذكية

نظام محاسبة مبسط لمشروع التخرج يوضح كيف يساعد الذكاء الاصطناعي المحاسب في قراءة الفواتير، تدقيقها، تحليل الأرباح، وتوقع الأرباح المستقبلية.

**جيميناي يقرأ ويشرح. المحرك المحاسبي في الخادم هو المسؤول الوحيد عن الأرقام.**

## التشغيل المحلي للتطوير

```bash
npm install
npm install --prefix backend
npm install --prefix frontend
npm run db:up
cd backend && npx prisma migrate deploy && npx prisma generate && npm run db:seed
cd ..
```

أضف في `backend/.env`:

```bash
GEMINI_API_KEY=مفتاحك
INVOICE_READER_PROVIDER=gemini
GEMINI_MODEL=gemini-2.5-flash
```

ثم:

```bash
npm run dev
```

- الواجهة: http://localhost:5179
- الخادم: http://localhost:5050/api/health
- سيناريو اللجنة: http://localhost:5179/demo

حساب تجريبي: `admin@jaafar.local` / `admin123`

النماذج التجريبية للفواتير تعمل بدون مفتاح. قراءة صورة أو PDF حقيقي تحتاج Gemini.

## التشغيل بالإنتاج عبر Docker

انسخ ملف البيئة ثم املأ كلمة مرور قاعدة البيانات ومفتاح Gemini:

```bash
cp .env.example .env
```

للبناء والتشغيل:

```bash
docker compose up -d --build
```

أو:

```bash
npm run docker:up
```

- التطبيق: http://localhost
- الصحة: http://localhost/api/health
- سيناريو اللجنة: http://localhost/demo

لتعبئة البيانات التجريبية مرة واحدة (تمسح البيانات الحالية):

```bash
# في .env مؤقتاً: SEED_ON_START=true ثم أعد تشغيل الخادم
# أو نفّذ:
npm run docker:seed
```

بعد أول تعبئة أعد `SEED_ON_START=false`.

لإيقاف الحاويات:

```bash
npm run docker:down
```

قاعدة البيانات وملفات الفواتير المرفوعة تُحفظ في volumes: `jaafar_pgdata` و `jaafar_uploads`. لا تُنشر منافذ Postgres أو الـ API مباشرة؛ الواجهة على المنفذ 80 توصل `/api` و `/uploads` إلى الخادم.

## سيناريو العرض أمام اللجنة

1. لوحة التحكم.
2. رفع فاتورة، أو اختيار **نموذج بأخطاء**.
3. قراءة الفاتورة.
4. البيانات المستخرجة بجانب الصورة.
5. خطأ المجموع: 10 × 5 = 60 والصحيح 50.
6. سعر القهوة العربية 13 بدل 10.
7. شرح جيميناي ودرجة السلامة.
8. تصحيح ثم اعتماد.
9. حركة المخزون.
10. حركة الصندوق إن كانت مدفوعة.
11. تقرير الأرباح أو اللوحة.
12. التحليلات الذكية.
13. تحليل ارتفاع سعر الهيل من تجارة النور والتوابل.
14. توقع الأرباح.
15. أشهر سبتمبر وأكتوبر ونوفمبر ومستوى الثقة.
16. سؤال المساعد: «ما هي أرباحي المتوقعة الشهر القادم ولماذا؟»
# ai-accountant
