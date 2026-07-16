# Supabase — العز العالمي (Al-Ezz International)

المشروع: `alezz-alaalmi` — ref: `rkdwqptiaknoedmsmrjk` — <https://rkdwqptiaknoedmsmrjk.supabase.co>

هذا المجلد هو **المرجع الوحيد** لكل تغييرات قاعدة البيانات. الخطة الكاملة في `../BACKEND_PLAN.md`.

## سير العمل (Migrations Workflow)

1. كل تغيير على قاعدة البيانات يُكتب كملف SQL في `migrations/` باسم مرقّم: `NNN_وصف.sql`.
2. يُعرض الملف على المالك **قبل** التطبيق.
3. بعد الموافقة يُطبَّق على المشروع عبر أداة `apply_migration` (بنفس اسم الملف) —
   **محتوى الملف في المستودع = المحتوى المطبَّق فعلياً، حرفياً.**
4. لا يوجد Supabase Branches (مشروع إنتاجي واحد)، لذلك:
   - كل migration تُكتب **idempotent**: `create ... if not exists`، `on conflict do nothing`،
     `drop policy if exists` قبل `create policy`.
   - عبارات التراجع (rollback) تُوثَّق في تعليق رأس كل ملف.

## المفاتيح (Keys)

| المفتاح | مكانه | ملاحظات |
|---|---|---|
| Publishable `sb_publishable_...` | مضمّن في `supabase-client.js` | **عام بالتصميم** — آمن للعميل، RLS يحمي البيانات |
| `service_role` | متغيرات بيئة Vercel + `.env` المحلي فقط | **سرّي** — صلاحية كاملة تتجاوز RLS. لا يُكتب في الكود أو git أبداً |

عند أي شك بتسريب مفتاح service_role: لوحة سوبابيس → Settings → API → Rotate.

## تعيين أول super_admin — ✅ نُفِّذ بتاريخ 2026-07-16

حساب المالك `a115351402@gmail.com` سُجّل من صفحة `auth.html` ثم رُفِّع بالأمر التالي
(يُحتفظ به هنا كمرجع إن احتجنا ترفيع حساب طوارئ آخر مستقبلاً):

```sql
insert into public.user_roles (user_id, role, assigned_by)
select id, 'super_admin', id
from auth.users
where email = 'a115351402@gmail.com'
on conflict (user_id, role) do nothing;
```

## الأدوار (RBAC)

| الدور | الصلاحية |
|---|---|
| `super_admin` | تحكم مطلق + إدارة حسابات الطاقم |
| `admin` | اعتماد السيارات، إدارة الطلبات والعملاء |
| `logistics` | تحديث مراحل الشحن (order_milestones) فقط |
| `customer` | طلباته وملفه ومفضلته وإشعاراته فقط |
