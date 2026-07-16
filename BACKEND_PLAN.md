# خطة تنفيذ الواجهة الخلفية + لوحات التحكم — العز العالمي (Al-Ezz International)

## السياق (Context)

الموقع الحالي منصة استيراد سيارات من كوريا: موقع **HTML ثابت** (5 صفحات، vanilla JS، Tailwind مُجمّع مسبقاً في `tailwind.css`) منشور على Vercel، مع 4 دوال Serverless في `/api/*.mjs` تجلب البيانات حيّة من Carapis (بيانات Encar) ومن سحب صفحات مزادات Lotte. **لا توجد قاعدة بيانات ولا حسابات ولا طلبات** — كل أزرار «اطلب» روابط واتساب (`wa.me/966550112411`).

الهدف: إضافة واجهة خلفية كاملة على مشروع سوبابيس الجاهز `rkdwqptiaknoedmsmrjk` (فارغ تماماً — تم التحقق) مع نظام أدوار RBAC (super_admin / admin / logistics / customer)، و7 جداول، وRLS كامل، وتريغرات، وتخزين، وRealtime لتتبع الشحنات — ثم لوحات تحكم وصفحات حساب بنفس هوية التصميم الحالية (RTL، كحلي/ذهبي، خطوط Cairo/Tajawal، ثلاثي اللغة عبر `i18n.js`).

### قرارات محسومة مع المالك
1. **إبقاء البنية الحالية** — لا ترحيل إلى Next.js. صفحات HTML جديدة + توسيع `/api`.
2. **المصادقة**: بريد + كلمة مرور، ورقم الجوال حقل إلزامي عند التسجيل (يُخزن في `profiles.phone_number`).
3. **الطلبات**: تُنشأ من الموقع (زر «اطلب هذه السيارة» للعميل المسجل) **و** يدوياً من لوحة التحكم (لعملاء الواتساب).
4. **الرابط الرسمي**: `https://alezz-alaalmi.vercel.app` (يُعتمد في Supabase Auth Site URL + redirect URLs).
5. **بدون تأكيد بريد إلكتروني الآن** (بريد سوبابيس المدمج محدود جداً) — يُفعَّل لاحقاً مع مزود SMTP.
6. **بروتوكول العمل**: كل التطوير على فرع `alezz-test` → عرض النتيجة → تأكيد المستخدم → دمج في `main`. تعديلات قاعدة البيانات: عرض ملف SQL → تأكيد المستخدم → تطبيق عبر MCP `apply_migration` (ملف المستودع = المحتوى المطبق بنفس الاسم).

### حقائق تقنية مثبتة (تعتمد عليها الخطة)
- `vercel.json`: بلا CSP → الاتصال المباشر بـ `https://rkdwqptiaknoedmsmrjk.supabase.co` من المتصفح متاح. `cleanUrls: true`.
- المفتاح العام publishable موجود: `sb_publishable_RHPNqmH06RXBrwkMmLPBLQ_G3nuhMym` (آمن للتضمين في الكود). مفتاح service_role يبقى فقط في متغيرات بيئة Vercel + `.env` المحلي (git-ignored).
- `tailwind.config.js` → `content` ناقص أصلاً `auctions.html`/`auction-car.html`؛ كل صفحة جديدة تُضاف له ويُعاد التوليد: `npx tailwindcss@3 -o tailwind.css --minify`.
- أزرار الطلب الحالية: `car.html` `#t-wa` (~سطر 125)، `auction-car.html` `#wa-cta` (~سطر 515). بطاقات السيارات تُبنى بدوال `cardHTML()` نصية (`cars.html:617`، `auctions.html:405`) مع `onclick` للتنقل → أزرار القلب تحتاج `stopPropagation`.
- منطق جلب تفاصيل Lotte داخل `api/auctions.mjs` (`fetchLotteDetail()` ~256-286) — يُستخرج لمكتبة مشتركة. Vercel لا ينشر `api/_lib/**` كمسارات (بادئة `_`).
- حساب المالك الذي سيصبح super_admin: `a115351401@gmail.com`.

---

## قرارات معمارية عامة

1. **توصيل supabase-js**: تضمين نسخة UMD مثبتة الإصدار في المستودع `vendor/supabase-js-v2.min.js` (تُحمَّل مرة من jsDelivr، تُذكر النسخة في تعليق رأس الملف). سكربت كلاسيكي يعرض `window.supabase` — يطابق نمط `i18n.js`/`currency.js` وسابقة تضمين `tailwind.css`.
2. **صفحة مصادقة واحدة** `auth.html` (تبويبات دخول/تسجيل/استعادة، معاملات `?mode=` و`?next=`).
3. **لوحة تحكم واحدة** `admin.html` بتبويبات مقيدة بالدور (اللوجستي يرى تبويب الطلبات/المراحل فقط) — RLS هو الحماية الفعلية، إخفاء الواجهة تحسين شكلي فقط.
4. **استراتيجية Snapshot للسيارات الخارجية**: `favorites` و`orders` تشير لـ `vehicles`؛ نقطة `/api` بمفتاح service-role تعيد جلب السيارة **من المصدر سيرفرياً** وتعمل upsert في `vehicles` على مفتاح `(source, source_id)` — السعر محسوب سيرفرياً ولا يمكن تزويره من العميل.
5. **ميزانية الدوال**: نقطتان جديدتان فقط (`api/account.mjs`, `api/admin.mjs`) بنمط `{action: ...}` + كود مشترك في `api/_lib/` (غير منشور كمسار). المجموع 6 من حد 12 لخطة Vercel Hobby.
6. **إضافات على مواصفات المستخدم** (كلها إضافية وتُعرض عليه مع SQL):
   - `profiles.email` (تُنسخ من `auth.users` في التريغر) — وإلا لا يمكن عرض بريد العملاء في لوحة التحكم.
   - قيد فريد جزئي `unique(source, source_id) where source_id is not null` على `vehicles` — لازم لعمل upsert.
   - `unique(user_id, role)` على `user_roles`.
   - سياستا SELECT إضافيتان على `vehicles`: صاحب طلب/مفضلة يقرأ سيارته حتى لو حالتها `pending` — وإلا «طلباتي» لا تعرض بيانات السيارة.
   - دالة RPC `phone_taken(text)` (SECURITY DEFINER) لفحص تكرار الجوال قبل التسجيل بدل خطأ 500 مبهم.

---

## المراحل

> **بوابة كل مرحلة**: تنفيذ على `alezz-test` → تحقق حسب قائمة المرحلة → commit → **تأكيد المستخدم** → دمج في `main`. مراحل قاعدة البيانات: عرض SQL → تأكيد → `apply_migration`. كل migration تُكتب idempotent (`if not exists` / `on conflict do nothing`) مع توثيق عبارات التراجع في تعليق رأس الملف (لا يوجد Supabase branches — مشروع إنتاجي واحد).

### المرحلة 0 — السقالة والعميل المشترك (صفر تغيير مرئي)
**ملفات جديدة:**
- `vendor/supabase-js-v2.min.js` — نسخة UMD مثبتة.
- `supabase-client.js` — كائن `window.SB`: `SB.client` (جلسة localStorage + `detectSessionInUrl: true`)، `SB.session()/user()`، `SB.roles()` (جلب أدوار مرة واحدة مع كاش + `isStaff/isAdmin/isSuperAdmin/isLogistics`)، `SB.requireAuth(next)/requireStaff()`، `SB.authHeader()` لنداءات `/api`، `SB.mountNavAuth(el)` (زر دخول/شريحة حساب + عداد إشعارات — يُستخدم بالمرحلة 5)، حدث `sb:auth` على نمط `langchange`.
- `supabase/migrations/` + `supabase/README.md` (توثيق سير العمل + سكربت تعيين super_admin).
- تعديل `.env.example`: إضافة `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (تحذير: سيرفر فقط).

**تحقق**: `npm run dev` والموقع بلا أي تغيير؛ لا أسرار في git.

### المرحلة 1 — قاعدة البيانات كاملة (4 migrations)
**`001_core_tables.sql`** — الجداول السبعة حسب المواصفات حرفياً + الإضافات المعلنة أعلاه + دالة/تريغر `set_updated_at()` على `profiles` + فهارس على كل أعمدة FK المستخدمة في السياسات: `user_roles(user_id)`, `vehicles(status)`, `vehicles(created_by)`, `favorites(user_id/vehicle_id)`, `orders(customer_id/vehicle_id/status)`, `order_milestones(order_id)`, `in_app_notifications(user_id, is_read)`.

**`002_functions_triggers.sql`** — قلب منظومة الأمان:
- `has_role(uuid, text)` + `is_admin(uuid)` + `is_staff(uuid)`: دوال SQL بـ `SECURITY DEFINER` و`set search_path = ''` — تمنع الـ infinite recursion على سياسات `user_roles`.
- `handle_new_user()` (AFTER INSERT على `auth.users`): إنشاء profile (email + full_name + phone_number من `raw_user_meta_data` مع `coalesce/nullif` حتى لا يفشل التسجيل) + دور **`'customer'` مكتوب صراحة في الدالة** (الميتاداتا لا تؤثر على الدور إطلاقاً — حاجز تصعيد صلاحيات ‎#1).
- `notify_order_status()` (AFTER UPDATE على `orders` بشرط `old.status is distinct from new.status`): إدراج إشعار عربي للعميل بخريطة `CASE` لتسميات الحالات.
- `phone_taken(text)`.

**`003_rls_policies.sql`** — تفعيل RLS على الجداول السبعة، وكل `auth.uid()` مغلف `(select auth.uid())`:
- `profiles`: قراءة/تعديل الذات؛ admin الكل؛ لا INSERT/DELETE من العميل (التريغر هو المُنشئ).
- `user_roles`: super_admin كل شيء؛ admin قراءة؛ المستخدم يقرأ صف دوره فقط.
- `vehicles`: قراءة عامة (حتى anon) لـ `approved` فقط؛ admin كامل؛ + سياستا مالك-الطلب/مالك-المفضلة.
- `favorites`: مالك CRUD (`with check user_id = auth.uid`)؛ admin قراءة.
- `orders`: العميل يقرأ طلباته؛ الطاقم الثلاثة قراءة+تحديث؛ INSERT للعميل لطلبه فقط أو `is_admin`.
- `order_milestones`: العميل قراءة عبر `exists` على طلباته؛ الطاقم إدراج/تعديل.
- `in_app_notifications`: المالك قراءة + تعديل `is_read` فقط؛ **لا سياسة INSERT** (تريغر/service-role فقط).
- Realtime: `alter publication supabase_realtime add table orders, order_milestones, in_app_notifications;`

**`004_storage.sql`** — الحاويات الثلاث (`on conflict do nothing`): `vehicle-images` و`inspection-reports` عامّتا القراءة والكتابة لـ `is_admin` فقط؛ `user-documents` خاصة بنمط مسار `{user_id}/...` عبر `(storage.foldername(name))[1] = auth.uid()::text` + قراءة admin.

**تحقق**: `list_tables` (7)، `list_migrations` (4)، `get_advisors` أمن + أداء = صفر أخطاء (خاصة search_path و auth.uid re-evaluation و RLS بلا سياسات)، واختبار سياسات عبر `execute_sql` بمحاكاة JWT.

### المرحلة 2 — صفحة المصادقة + إعداد Auth + تعيين super_admin
- **`auth.html`** (بهوية التصميم: navbar-glass, .panel, .btn-gold): دخول / تسجيل (الاسم، البريد، الجوال إلزامي بتطبيع `+9665XXXXXXXX` وفحص مسبق عبر `rpc('phone_taken')`، كلمة مرور ≥ 8) عبر `signUp({options.data: {full_name, phone_number}})` / استعادة كلمة المرور (`resetPasswordForEmail` مع `redirectTo` نحو `?mode=reset`) + رسائل خطأ عربية مفهومة + تحويل إلى `?next=` أو `account.html`.
- تعديل `i18n.js` (نصوص ar/en/ko) + `tailwind.config.js` (إضافة auth.html **و** auctions.html و auction-car.html الناقصتين) + إعادة توليد `tailwind.css`.
- **إعدادات يدوية (بتأكيد المستخدم)**: Supabase Auth → Site URL = `https://alezz-alaalmi.vercel.app` + redirect URLs (الإنتاج + `http://localhost:5173`)؛ إيقاف Confirm email؛ Vercel → إضافة `SUPABASE_URL` و`SUPABASE_SERVICE_ROLE_KEY`.
- **تعيين super_admin** (بعد تسجيل المالك بحسابه): تنفيذ لمرة واحدة عبر `execute_sql` (ليست migration):
  `insert into user_roles (user_id, role, assigned_by) select id, 'super_admin', id from auth.users where email = 'a115351401@gmail.com' on conflict do nothing;`

**تحقق**: تسجيل عميل تجريبي → صف profiles كامل + دور customer؛ تكرار جوال = رسالة واضحة؛ دخول/خروج؛ المالك يصبح super_admin.

### المرحلة 3 — ميزات العميل: نقاط `/api` + `account.html`
**ملفات جديدة:**
- `api/_lib/supa.mjs`: `serviceClient()`، `getCallerFromReq(req)` (تحقق JWT عبر `auth.getUser(token)`)، `callerHasRole()`.
- `api/_lib/sources.mjs`: نقل `fetchLotteDetail()` من `auctions.mjs` + `fetchEncarListing(id)` بنفس منطق مفاتيح Carapis + `toVehicleRow(source, data)` بسعر SAR **محسوب سيرفرياً** (Lotte: USD×3.75 كما اليوم؛ Encar: KRW→USD→SAR باحتياطي 1360).
- `api/account.mjs` (POST فقط، JWT إلزامي، **بدون** CORS مفتوح):
  - `action=snapshot {source, source_id}` → جلب من المصدر → upsert في `vehicles` (الحالة تبقى `pending` للجديد ولا تتراجع للموجود) → `{vehicle_id}`.
  - `action=order {source, source_id}` أو `{vehicle_id}` → snapshot إن لزم → إدراج service-role في `orders` بـ `customer_id` من JWT حصراً (ليس من الجسم) و`final_price_sar` من السيرفر و`status='pending_payment'` + أول milestone «تم استلام طلبك» + إشعار ترحيبي → `{order_id, vehicle_id}`. أخطاء: 401/404/502.
- تعديل `api/auctions.mjs` ليستورد من `_lib/sources.mjs` (سلوك مطابق — يُتحقق قبل/بعد على id حي).
- **`account.html`** (محمي بـ `requireAuth`) بتبويبات hash:
  - **طلباتي**: بطاقات طلبات مع join للسيارة + خط زمني عمودي (7 حالات كسكة تقدم + milestones بموقع وتاريخ) + **Realtime** (`postgres_changes` على orders بفلتر `customer_id` وعلى order_milestones — RLS يفلتر) + toast.
  - **المفضلة**: قائمة مع حذف (RLS) وروابط رجوع لصفحات المصدر.
  - **الإشعارات**: قائمة + تعليم مقروء (فردي/الكل) + اشتراك INSERT حي + عداد غير المقروء.
  - **الملف الشخصي**: تعديل الاسم/الجوال، البريد للقراءة، تغيير كلمة المرور، خروج.
- تعديل `i18n.js` + `tailwind.config.js` + regen.

**تحقق**: طلب على سيارة Encar حية وأخرى Lotte → صفوف صحيحة بسعر السيرفر (ومحاولة تزوير السعر من الجسم تُتجاهل)؛ تحديث حالة الطلب عبر SQL → إشعار يظهر + الواجهة تتحدث حية بلا refresh (وإن لم تصل الأحداث: `SB.client.realtime.setAuth(access_token)` بعد الدخول — نقطة فحص صريحة)؛ upsert idempotent (طلب ثانٍ لنفس السيارة يعيد استخدام نفس صف vehicle)؛ `/api/_lib/supa` يرجع 404 على النشر.

### المرحلة 4 — لوحة التحكم `admin.html` + نقطة إنشاء الموظفين
- **`api/admin.mjs`**: `action=create-user {email, password, full_name, phone_number, role}` — admin ينشئ `customer` فقط (لعملاء الواتساب)؛ **super_admin فقط** ينشئ `admin`/`logistics` (حاجز تصعيد ‎#2)؛ عبر `auth.admin.createUser({email_confirm: true, user_metadata})` ثم إدراج الدور بـ `assigned_by`. كل الباقي مباشر من المتصفح تحت RLS.
- **`admin.html`** (محمي بـ `requireStaff`، تبويبات حسب الدور):
  - **السيارات** (admin+): طابور الموافقة (pending → approve/hide/sold)، CRUD يدوي كامل (source=manual)، رفع صور متعددة إلى `vehicle-images/{vehicle_id}/{n}` وتقرير فحص إلى `inspection-reports/` مع تعبئة `images[]`/`inspection_report_url`، و«استيراد من رابط» عبر `action=snapshot`.
  - **الطلبات** (admin + logistics): جدول بفلاتر (حالة/بحث جوال)، تغيير الحالة (→ إشعار تلقائي بالتريغر)، مؤلف milestones (عنوان/وصف/موقع)، وإنشاء طلب يدوي (اختيار عميل بالبحث + سيارة من المخزون أو snapshot + السعر النهائي). اللوجستي يرى هذا التبويب فقط (وتُخفى عنه أزرار الحالة/الإنشاء واجهياً — مع التنويه أن RLS يسمح له بتحديث orders حسب المواصفات؛ تقييد الأعمدة الصارم مؤجل بعلم المستخدم).
  - **العملاء** (admin+): قائمة profiles (اسم/بريد/جوال/تاريخ/شارات أدوار) + رابط طلبات كل عميل + «إنشاء حساب عميل».
  - **فريق العمل** (super_admin فقط): قائمة الطاقم، إنشاء موظفين، منح/سحب أدوار (مباشر تحت RLS).
- تعديل `i18n.js` + `tailwind.config.js` + regen.

**تحقق (سيناريو لكل دور)**: super_admin ينشئ admin وlogistics تجريبيين؛ admin يوافق على snapshot وينشئ سيارة يدوية بصور وطلباً يدوياً ويغير حالة → إشعار حي للعميل؛ logistics يرى تبويب الطلبات فقط ويضيف milestone (يظهر حياً عند العميل) **ويفشل** (فحص RLS من console) في لمس vehicles/user_roles؛ admin يفشل في إنشاء أدوار طاقم (403) وفي الإدراج المباشر في user_roles؛ العميل يُطرد من `/admin` وتفشل كتاباته المباشرة. إعادة `get_advisors`.

### المرحلة 5 — ربط الصفحات الخمس الحالية (المرحلة الوحيدة التي تلمس صفحات حية)
- **الصفحات الخمس**: إضافة سكربتي vendor + `supabase-client.js` (defer، بعد i18n/currency) + نقطة تعليق في الـ navbar → `SB.mountNavAuth()`: زر «تسجيل الدخول» للزائر / شريحة حساب + جرس إشعارات للمسجل / رابط «لوحة التحكم» للطاقم. **كل JS الجديد ملفوف بحيث غياب `window.SB` يعيد سلوك اليوم حرفياً** (شبكة أمان ضد الكسر).
- **البطاقات** (`cars.html:617`، `auctions.html:405`، شبكة index): زر قلب بزاوية الصورة (absolute + `stopPropagation`)؛ الزائر → توجيه للدخول مع `?next=`؛ المسجل → snapshot ثم إدراج/حذف `favorites`؛ تلوين القلوب بجلب مفضلات المستخدم مرة واحدة (`select vehicle_id, vehicles(source, source_id) from favorites`).
- **صفحتا التفاصيل**: زران متراصان — أساسي ذهبي «اطلب هذه السيارة» (مسجل → `action=order` → مودال نجاح + رابط `/account#orders`؛ زائر → مودال: تسجيل الدخول / متابعة عبر واتساب) + ثانوي واتساب **بنفس منطق الرسالة الحالي** (استمرارية العمل). + قلب في التفاصيل.
- `i18n.js` + `tailwind.config.js` + regen + التأكد أن الحاسبة (`updateCalc`) لم تُمس.

**تحقق**: رحلة كاملة: تصفح → قلب → تسجيل بمنتصف الرحلة والعودة عبر `?next` → طلب من الصفحتين → خط زمني حي بعد تغيير الأدمن للحالة؛ اللغات الثلاث + RTL/LTR سليمة؛ تجربة الزائر مطابقة لليوم عدا زر الدخول؛ مسار واتساب يعمل بكل مكان؛ console نظيف على الصفحات الخمس. **مخاطر خاصة**: قوالب البطاقات نصية (الحذر مع escaping وبقاء onclick)؛ TreeWalker في i18n لا يعبث بالمحتوى المحقون (استخدام `data-no-i18n` كنمط `#locale-ctrl`)؛ نسيان regen للتيلويند = اختفاء تنسيقات.

### المرحلة 6 — التحقق النهائي والتقسية والتسليم
- `get_advisors` (أمن + أداء) → أي ملاحظات تُعالج في `005_hardening.sql` (عرض → تأكيد → تطبيق).
- ملف `supabase/TESTING.md`: مصفوفة اختبار الأدوار الأربعة × كل قدرة، مع فحوص رفض RLS الصريحة من console.
- حارس إساءة خفيف في `api/account.mjs`: سقف طلبات مفتوحة لكل مستخدم (مثلاً رفض أكثر من 10 بحالة `pending_payment`).
- `robots` noindex على auth/account/admin (ولا تُضاف لـ sitemap)؛ تحديث `supabase/README.md` (سكربت البوتستراب، سير migrations، تدوير المفاتيح).
- الدمج النهائي في `main` بعد تأكيد المستخدم + اختبار نهائي على الإنتاج بحساب المالك الحقيقي.

**مؤجل بعلم المستخدم**: مزود SMTP + تفعيل تأكيد البريد، حالة إلغاء الطلب، الدفع الإلكتروني، تقييد أعمدة orders عن اللوجستي، إشعارات push/بريد.

---

## جدول نقاط API الجديدة

| المسار | Method | Action | التحقق | المدخل | الأثر |
|---|---|---|---|---|---|
| `/api/account.mjs` | POST | `snapshot` | JWT صالح | `{source, source_id}` | جلب سيرفري من المصدر → upsert في `vehicles` → `{vehicle_id}` |
| `/api/account.mjs` | POST | `order` | JWT صالح | `{source, source_id}` أو `{vehicle_id}` | snapshot إن لزم → إدراج order بمفتاح service (العميل من JWT، السعر من السيرفر) → `{order_id}` |
| `/api/admin.mjs` | POST | `create-user` | JWT + is_admin (لدور customer) / super_admin (لأدوار الطاقم) | `{email, password, full_name, phone_number, role}` | `auth.admin.createUser` + إدراج الدور بـ `assigned_by` |

كل ما عدا ذلك (مفضلة، ملف شخصي، إشعارات، CRUD سيارات، قراءة/تحديث طلبات، milestones، إدارة أدوار، رفع ملفات) = مباشر من المتصفح تحت RLS.

## الملفات الحرجة
- `supabase-client.js` (جديد — كل الصفحات تعتمد عليه)
- `supabase/migrations/001..004_*.sql` (جديدة — العقد الكامل للباك إند؛ `003` هو قلب الأمان)
- `api/account.mjs` + `api/_lib/{supa,sources}.mjs` (جديدة — نزاهة الأسعار والطلبات)
- `api/auctions.mjs` (تعديل — استخراج fetchLotteDetail)
- `api/admin.mjs` + `auth.html` + `account.html` + `admin.html` (جديدة)
- `i18n.js` + `tailwind.config.js` + `tailwind.css` (تعديل في كل مرحلة واجهية)
- الصفحات الخمس الحالية (تعديل بالمرحلة 5 فقط)

## التحقق الشامل النهائي (end-to-end)
1. زائر: يرى السيارات المعتمدة فقط من `vehicles`، الحاسبة تعمل، واتساب يعمل.
2. عميل: تسجيل → مفضلة → طلب من Encar وطلب من مزاد → متابعة حية للخط الزمني → إشعارات.
3. logistics: milestones فقط (+ إثبات رفض RLS لغيرها).
4. admin: موافقات، مخزون، طلب يدوي، تغيير حالات.
5. super_admin: إدارة الطاقم.
6. `get_advisors` نظيف أمنياً وأدائياً.
