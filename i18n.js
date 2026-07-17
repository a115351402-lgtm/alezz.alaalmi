/* ═══════════════════════════════════════════════════════════
   i18n.js — trilingual engine for العز العالمي
   Languages: ar (العربية, RTL) · en (English) · ko (한국어)
   Canonical authoring base is English; the live DOM is Arabic,
   so translation always goes  ar(source) → en / ko, and 'ar'
   simply restores the original text nodes.

   Public API (window.I18N):
     I18N.lang            → current language code
     I18N.set(code)       → switch language (persists + re-applies)
     I18N.t(key, vars)    → translate a dynamic string (KEYS table)
     I18N.apply()         → re-translate the DOM (after injecting nodes)
     I18N.onChange(fn)    → subscribe to language changes
   ═══════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var LANGS = { ar: 'العربية', en: 'English', ko: '한국어' };
  var SHORT = { ar: 'ع', en: 'EN', ko: '한' };

  /* ── KEYS: stable-key table for dynamic / JS-generated strings ── */
  var KEYS = {
    auth_e_frozen: { ar: 'تم تجميد هذا الحساب من قبل الإدارة. يرجى التواصل مع الدعم الفني للاستفسار.',
                     en: 'This account has been frozen by the administration. Please contact support.',
                     ko: '이 계정은 관리자에 의해 정지되었습니다. 고객 지원에 문의해 주세요.' },
    lc_new:        { ar: 'وصل حديثاً', en: 'Just arrived', ko: '방금 입고' },
    lc_ask:        { ar: 'اسأل عن هذه السيارة', en: 'Ask about this car', ko: '이 차량 문의' },
    lc_no_results: { ar: 'لا توجد نتائج لهذا البحث حالياً', en: 'No results for this search right now', ko: '현재 검색 결과가 없습니다' },
    lc_load_fail:  { ar: 'تعذّر تحميل السيارات مؤقتاً —', en: "Couldn't load cars right now —", ko: '차량을 불러오지 못했습니다 —' },
    lc_retry:      { ar: 'أعد المحاولة', en: 'Retry', ko: '다시 시도' },
    lc_browse_n:   { ar: 'تصفح {n} سيارة بأسعار وصور حقيقية — محدّثة لحظياً من كوريا',
                     en: 'Browse {n} cars with real prices and photos — updated live from Korea',
                     ko: '{n}대의 차량을 실제 가격과 사진으로 — 한국에서 실시간 업데이트' },
    unit_km:       { ar: 'كم', en: 'km', ko: 'km' },
    src_korea:     { ar: 'كوريا', en: 'Korea', ko: '한국' },
    fuel_gasoline: { ar: 'بنزين', en: 'Gasoline', ko: '가솔린' },
    fuel_diesel:   { ar: 'ديزل', en: 'Diesel', ko: '디젤' },
    fuel_hybrid:   { ar: 'هايبرد', en: 'Hybrid', ko: '하이브리드' },
    fuel_electric: { ar: 'كهربائية', en: 'Electric', ko: '전기' },
    fuel_lpg:      { ar: 'غاز', en: 'LPG', ko: 'LPG' },
    trans_auto:    { ar: 'أوتوماتيك', en: 'Automatic', ko: '자동' },
    trans_manual:  { ar: 'عادي', en: 'Manual', ko: '수동' },
    wa_greeting:   { ar: 'مرحباً، أهتم بهذه السيارة المعروضة في موقعكم:', en: "Hello, I'm interested in this car listed on your site:", ko: '안녕하세요, 사이트에 등록된 이 차량에 관심이 있습니다:' },
    wa_year:       { ar: 'الموديل', en: 'Year', ko: '연식' },
    wa_price:      { ar: 'السعر', en: 'Price', ko: '가격' },
    wa_ref:        { ar: 'رقم المرجع', en: 'Ref. No.', ko: '참조 번호' },
    calc_saving:   { ar: 'توفير', en: 'saved', ko: '절감' },

    // cars.html (search page)
    cars_deal:     { ar: '🔥 صفقة', en: '🔥 Deal', ko: '🔥 특가' },
    cars_none:     { ar: 'لا توجد سيارات مطابقة لبحثك — جرّب تعديل الفلاتر', en: 'No cars match your search — try adjusting the filters', ko: '검색과 일치하는 차량이 없습니다 — 필터를 조정해 보세요' },
    cars_count:    { ar: 'وجدنا {n} سيارة مطابقة', en: 'Found {n} matching cars', ko: '{n}대의 일치하는 차량을 찾았습니다' },
    cars_fail:     { ar: 'تعذّر التحميل مؤقتاً —', en: 'Loading failed —', ko: '불러오기 실패 —' },
    cars_no_brand: { ar: 'لا نتائج', en: 'No results', ko: '결과 없음' },
    price_range:   { ar: 'نطاق السعر', en: 'Price range', ko: '가격 범위' },
    ph_from:       { ar: 'من', en: 'From', ko: '최소' },
    ph_to:         { ar: 'إلى', en: 'To', ko: '최대' },
    ph_brand:      { ar: 'ابحث: Genesis، Kia، BMW…', en: 'Search: Genesis, Kia, BMW…', ko: '검색: Genesis, Kia, BMW…' },
    ph_model:      { ar: 'مثال: G80، Sorento، Carnival', en: 'e.g. G80, Sorento, Carnival', ko: '예: G80, Sorento, Carnival' },
    ph_ref:        { ar: 'أدخل الرقم المرجعي', en: 'Enter reference number', ko: '참조 번호 입력' },
    filter_btn:    { ar: 'الفلاتر والبحث', en: 'Filters & Search', ko: '필터 및 검색' },

    // car.html (detail page)
    car_back:      { ar: '← رجوع', en: '← Back', ko: '← 뒤로' },
    car_loading:   { ar: 'جارٍ تحميل بيانات السيارة…', en: 'Loading vehicle data…', ko: '차량 정보를 불러오는 중…' },
    car_not_found: { ar: 'تعذّر العثور على السيارة', en: 'Vehicle not found', ko: '차량을 찾을 수 없습니다' },
    car_not_found_d:{ ar: 'ربما بيعت السيارة أو انتهى عرضها. تصفح سيارات أخرى متاحة.', en: 'The car may be sold or no longer listed. Browse other available cars.', ko: '차량이 판매되었거나 더 이상 등록되어 있지 않을 수 있습니다. 다른 차량을 둘러보세요.' },
    car_browse:    { ar: 'تصفح السيارات المتاحة', en: 'Browse available cars', ko: '구매 가능 차량 보기' },
    car_disclaimer:{ ar: '* السعر لا يشمل الشحن والجمارك', en: '* Price excludes shipping and customs', ko: '* 가격은 배송 및 통관 비용 제외' },
    car_ask_wa:    { ar: 'اطلب هذه السيارة عبر واتساب', en: 'Request this car via WhatsApp', ko: 'WhatsApp으로 이 차량 문의' },
    car_specs:     { ar: 'المواصفات', en: 'Specifications', ko: '사양' },
    car_report:    { ar: 'تقرير الحالة', en: 'Condition Report', ko: '상태 보고서' },
    car_market:    { ar: 'تحليل سعر السوق', en: 'Market Price Analysis', ko: '시세 분석' },
    car_desc:      { ar: 'الوصف', en: 'Description', ko: '설명' },
    car_features:  { ar: 'المزايا والتجهيزات', en: 'Features & Equipment', ko: '옵션 및 사양' },
    sp_year:       { ar: 'سنة الصنع', en: 'Year', ko: '연식' },
    sp_mileage:    { ar: 'الكيلومترات', en: 'Mileage', ko: '주행거리' },
    sp_fuel:       { ar: 'الوقود', en: 'Fuel', ko: '연료' },
    sp_trans:      { ar: 'ناقل الحركة', en: 'Transmission', ko: '변속기' },
    sp_body:       { ar: 'نوع المركبة', en: 'Body type', ko: '차종' },
    sp_color:      { ar: 'اللون', en: 'Color', ko: '색상' },
    sp_engine:     { ar: 'سعة المحرك', en: 'Engine', ko: '배기량' },
    sp_drive:      { ar: 'نظام الدفع', en: 'Drivetrain', ko: '구동 방식' },
    sp_seats:      { ar: 'عدد المقاعد', en: 'Seats', ko: '좌석 수' },
    sp_owners:     { ar: 'عدد المُلّاك', en: 'Owners', ko: '소유자 수' },
    sp_seller:     { ar: 'نوع البائع', en: 'Seller type', ko: '판매자 유형' },
    sp_region:     { ar: 'المنطقة', en: 'Region', ko: '지역' },
    rp_accident:   { ar: 'حوادث سابقة', en: 'Prior accidents', ko: '사고 이력' },
    rp_repair:     { ar: 'إصلاحات بسيطة', en: 'Minor repairs', ko: '단순 수리' },
    rp_recall:     { ar: 'استدعاء مصنعي', en: 'Manufacturer recall', ko: '제조사 리콜' },
    rp_recall_ok:  { ar: 'تم تنفيذ الاستدعاء', en: 'Recall fulfilled', ko: '리콜 완료' },
    rp_inspect:    { ar: 'اجتاز الفحص الرسمي', en: 'Passed official inspection', ko: '공식 검사 통과' },
    rp_warranty:   { ar: 'الضمان', en: 'Warranty', ko: '보증' },
    rp_vin:        { ar: 'رقم الهيكل (VIN)', en: 'VIN', ko: '차대번호 (VIN)' },
    val_yes:       { ar: 'نعم', en: 'Yes', ko: '예' },
    val_no:        { ar: 'لا', en: 'No', ko: '아니오' },
    val_none:      { ar: 'لا يوجد', en: 'None', ko: '없음' },
    mk_great:      { ar: 'أقل من سعر السوق', en: 'Below market', ko: '시세 이하' },
    mk_good:       { ar: 'سعر جيد', en: 'Good price', ko: '좋은 가격' },
    mk_fair:       { ar: 'سعر عادل', en: 'Fair price', ko: '적정 가격' },
    mk_high:       { ar: 'أعلى من سعر السوق', en: 'Above market', ko: '시세보다 높음' },
    mk_status:     { ar: 'تقييم السعر', en: 'Price rating', ko: '가격 평가' },
    mk_estimate:   { ar: 'السعر التقديري العادل', en: 'Estimated fair price', ko: '예상 적정가' },
    mk_diff:       { ar: 'الفرق عن السوق', en: 'Difference vs. market', ko: '시세 대비 차이' },
    mk_compared:   { ar: 'سيارات مشابهة قورنت', en: 'Similar cars compared', ko: '비교된 유사 차량' },
    mk_none:       { ar: 'لا يتوفر تحليل سعري لهذه السيارة بعد', en: 'No price analysis available for this car yet', ko: '아직 이 차량의 가격 분석이 없습니다' },
    mk_lowest:     { ar: 'الأرخص', en: 'Lowest', ko: '최저' },
    mk_median:     { ar: 'الوسيط', en: 'Median', ko: '중간값' },
    mk_highest:    { ar: 'الأغلى', en: 'Highest', ko: '최고' },
    cars_new_badge:{ ar: 'جديد', en: 'New', ko: '신차' },
    badge_noacc:   { ar: 'بدون حوادث', en: 'No accidents', ko: '무사고' },
    unit_cc:       { ar: 'سي سي', en: 'cc', ko: 'cc' },
    unit_seats:    { ar: 'مقاعد', en: 'seats', ko: '석' },

    // auth.html (login / signup / reset)
    auth_back_home:   { ar: '← الرئيسية', en: '← Home', ko: '← 홈' },
    auth_title:       { ar: 'حسابك في العز العالمي', en: 'Your Al-Ezz account', ko: '알에즈 계정' },
    auth_subtitle:    { ar: 'تابع طلباتك وشحناتك ومفضلتك من مكان واحد', en: 'Track your orders, shipments and favorites in one place', ko: '주문·배송·즐겨찾기를 한곳에서 관리하세요' },
    auth_tab_login:   { ar: 'تسجيل الدخول', en: 'Sign in', ko: '로그인' },
    auth_tab_signup:  { ar: 'حساب جديد', en: 'Create account', ko: '회원가입' },
    auth_email:       { ar: 'البريد الإلكتروني', en: 'Email', ko: '이메일' },
    auth_password:    { ar: 'كلمة المرور', en: 'Password', ko: '비밀번호' },
    auth_new_password:{ ar: 'كلمة المرور الجديدة', en: 'New password', ko: '새 비밀번호' },
    auth_fullname:    { ar: 'الاسم الكامل', en: 'Full name', ko: '성명' },
    auth_fullname_ph: { ar: 'مثال: محمد العتيبي', en: 'e.g. Mohammed Alotaibi', ko: '예: 홍길동' },
    auth_phone:       { ar: 'رقم الجوال', en: 'Mobile number', ko: '휴대폰 번호' },
    auth_phone_hint:  { ar: 'سعودي: 05XXXXXXXX — دولي: ابدأ بـ +', en: 'Saudi: 05XXXXXXXX — International: start with +', ko: '사우디: 05XXXXXXXX — 국제: +로 시작' },
    auth_pass_ph:     { ar: '8 أحرف على الأقل', en: 'At least 8 characters', ko: '8자 이상' },
    auth_login_btn:   { ar: 'دخول', en: 'Sign in', ko: '로그인' },
    auth_signup_btn:  { ar: 'إنشاء الحساب', en: 'Create account', ko: '계정 만들기' },
    auth_forgot:      { ar: 'نسيت كلمة المرور؟', en: 'Forgot password?', ko: '비밀번호를 잊으셨나요?' },
    auth_forgot_hint: { ar: 'أدخل بريدك الإلكتروني وسنرسل لك رابط إعادة تعيين كلمة المرور', en: "Enter your email and we'll send you a password reset link", ko: '이메일을 입력하시면 비밀번호 재설정 링크를 보내드립니다' },
    auth_forgot_btn:  { ar: 'إرسال رابط الاستعادة', en: 'Send reset link', ko: '재설정 링크 보내기' },
    auth_back_login:  { ar: '← العودة لتسجيل الدخول', en: '← Back to sign in', ko: '← 로그인으로 돌아가기' },
    auth_reset_hint:  { ar: 'أدخل كلمة المرور الجديدة لحسابك', en: 'Enter the new password for your account', ko: '계정의 새 비밀번호를 입력하세요' },
    auth_reset_btn:   { ar: 'تحديث كلمة المرور', en: 'Update password', ko: '비밀번호 변경' },
    auth_signedin_as: { ar: 'أنت مسجل الدخول باسم', en: 'You are signed in as', ko: '다음 계정으로 로그인됨' },
    auth_continue:    { ar: 'متابعة', en: 'Continue', ko: '계속' },
    auth_logout:      { ar: 'تسجيل الخروج', en: 'Sign out', ko: '로그아웃' },
    auth_terms:       { ar: 'بإنشائك الحساب فأنت توافق على تواصلنا معك بخصوص طلباتك', en: 'By creating an account you agree that we may contact you about your orders', ko: '계정을 만들면 주문 관련 연락에 동의하는 것입니다' },
    auth_help:        { ar: 'تحتاج مساعدة؟', en: 'Need help?', ko: '도움이 필요하세요?' },
    auth_e_fill:      { ar: 'يرجى تعبئة جميع الحقول', en: 'Please fill in all fields', ko: '모든 항목을 입력해 주세요' },
    auth_e_creds:     { ar: 'البريد أو كلمة المرور غير صحيحة', en: 'Incorrect email or password', ko: '이메일 또는 비밀번호가 올바르지 않습니다' },
    auth_e_email_taken:{ ar: 'هذا البريد مسجل مسبقاً — جرّب تسجيل الدخول', en: 'This email is already registered — try signing in', ko: '이미 등록된 이메일입니다 — 로그인해 보세요' },
    auth_e_phone_taken:{ ar: 'رقم الجوال هذا مسجل مسبقاً بحساب آخر', en: 'This mobile number is already registered to another account', ko: '이미 다른 계정에 등록된 휴대폰 번호입니다' },
    auth_e_bad_phone: { ar: 'أدخل رقم جوال صحيح (مثال: 05XXXXXXXX)', en: 'Enter a valid mobile number (e.g. 05XXXXXXXX)', ko: '올바른 휴대폰 번호를 입력하세요 (예: 05XXXXXXXX)' },
    auth_e_bad_email: { ar: 'أدخل بريداً إلكترونياً صحيحاً', en: 'Enter a valid email address', ko: '올바른 이메일 주소를 입력하세요' },
    auth_e_weak:      { ar: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل', en: 'Password must be at least 8 characters', ko: '비밀번호는 8자 이상이어야 합니다' },
    auth_e_unconfirmed:{ ar: 'يجب تفعيل بريدك أولاً — تحقق من صندوق الوارد', en: 'Please confirm your email first — check your inbox', ko: '먼저 이메일을 인증해 주세요 — 받은편지함을 확인하세요' },
    auth_e_rate:      { ar: 'محاولات كثيرة — انتظر قليلاً ثم أعد المحاولة', en: 'Too many attempts — wait a moment and try again', ko: '시도 횟수가 너무 많습니다 — 잠시 후 다시 시도하세요' },
    auth_e_generic:   { ar: 'حدث خطأ غير متوقع — أعد المحاولة', en: 'Something went wrong — please try again', ko: '예상치 못한 오류가 발생했습니다 — 다시 시도하세요' },
    auth_ok_confirm_email:{ ar: 'تم إنشاء حسابك ✓ أرسلنا رابط تفعيل إلى بريدك — افتحه لإكمال التسجيل', en: 'Account created ✓ We sent a confirmation link to your email — open it to finish', ko: '계정이 생성되었습니다 ✓ 이메일로 인증 링크를 보냈습니다' },
    auth_ok_reset_sent:{ ar: 'إن كان البريد مسجلاً لدينا فستصلك رسالة برابط الاستعادة خلال دقائق', en: 'If this email is registered, a reset link is on its way', ko: '등록된 이메일이라면 재설정 링크가 곧 도착합니다' },
    auth_ok_pass_updated:{ ar: 'تم تحديث كلمة المرور بنجاح ✓', en: 'Password updated successfully ✓', ko: '비밀번호가 변경되었습니다 ✓' },

    // account.html (customer area)
    acc_hello:        { ar: 'مرحباً', en: 'Welcome', ko: '환영합니다' },
    acc_sub:          { ar: 'تابع طلباتك ومفضلتك وإشعاراتك من هنا', en: 'Track your orders, favorites and notifications here', ko: '주문·즐겨찾기·알림을 여기서 확인하세요' },
    acc_admin_link:   { ar: 'لوحة التحكم', en: 'Dashboard', ko: '대시보드' },
    acc_tab_orders:   { ar: 'طلباتي', en: 'My orders', ko: '내 주문' },
    acc_tab_favs:     { ar: 'المفضلة', en: 'Favorites', ko: '즐겨찾기' },
    acc_tab_ntfs:     { ar: 'الإشعارات', en: 'Notifications', ko: '알림' },
    acc_tab_profile:  { ar: 'حسابي', en: 'Profile', ko: '내 정보' },
    acc_no_orders:    { ar: 'لا توجد طلبات بعد', en: 'No orders yet', ko: '아직 주문이 없습니다' },
    acc_no_orders_d:  { ar: 'تصفح السيارات واضغط «اطلب هذه السيارة» وسيظهر طلبك هنا مع تتبع مباشر لكل مرحلة', en: 'Browse cars and tap "Order this car" — your order will appear here with live tracking', ko: '차량을 둘러보고 "이 차량 주문하기"를 누르면 실시간 추적과 함께 여기에 표시됩니다' },
    acc_browse:       { ar: 'تصفح السيارات', en: 'Browse cars', ko: '차량 둘러보기' },
    acc_no_favs:      { ar: 'مفضلتك فارغة', en: 'No favorites yet', ko: '즐겨찾기가 비어 있습니다' },
    acc_no_favs_d:    { ar: 'اضغط على القلب في أي سيارة لحفظها هنا', en: 'Tap the heart on any car to save it here', ko: '차량의 하트를 누르면 여기에 저장됩니다' },
    acc_no_ntfs:      { ar: 'لا توجد إشعارات', en: 'No notifications', ko: '알림이 없습니다' },
    acc_read_all:     { ar: 'تحديد الكل كمقروء', en: 'Mark all as read', ko: '모두 읽음 처리' },
    acc_profile_title:{ ar: 'بياناتي', en: 'My details', ko: '내 정보' },
    acc_pass_title:   { ar: 'تغيير كلمة المرور', en: 'Change password', ko: '비밀번호 변경' },
    acc_pass_btn:     { ar: 'تحديث كلمة المرور', en: 'Update password', ko: '비밀번호 변경' },
    acc_save:         { ar: 'حفظ التغييرات', en: 'Save changes', ko: '변경 사항 저장' },
    acc_saved:        { ar: 'تم الحفظ ✓', en: 'Saved ✓', ko: '저장됨 ✓' },
    acc_remove:       { ar: 'إزالة', en: 'Remove', ko: '삭제' },
    acc_order_date:   { ar: 'تاريخ الطلب', en: 'Order date', ko: '주문일' },
    acc_show_timeline:{ ar: 'عرض مراحل الشحنة ▾', en: 'Show shipment timeline ▾', ko: '배송 단계 보기 ▾' },
    acc_hide_timeline:{ ar: 'إخفاء مراحل الشحنة ▴', en: 'Hide shipment timeline ▴', ko: '배송 단계 숨기기 ▴' },
    acc_no_ms:        { ar: 'لا توجد مراحل مسجلة بعد — سيصلك إشعار مع كل تحديث', en: 'No milestones yet — you will be notified on every update', ko: '아직 기록된 단계가 없습니다 — 업데이트마다 알림을 받게 됩니다' },
    acc_order_updated:{ ar: 'تحديث على طلبك', en: 'Order updated', ko: '주문 업데이트' },
    acc_load_err:     { ar: 'تعذر التحميل — أعد المحاولة', en: 'Loading failed — try again', ko: '불러오기 실패 — 다시 시도하세요' },

    // admin.html (dashboard)
    adm_title:        { ar: 'لوحة التحكم', en: 'Dashboard', ko: '대시보드' },
    adm_tab_vehicles: { ar: 'السيارات', en: 'Vehicles', ko: '차량' },
    adm_tab_orders:   { ar: 'الطلبات', en: 'Orders', ko: '주문' },
    adm_tab_customers:{ ar: 'العملاء', en: 'Customers', ko: '고객' },
    adm_tab_staff:    { ar: 'فريق العمل', en: 'Staff', ko: '직원' },
    adm_f_pending:    { ar: 'بانتظار الموافقة', en: 'Pending', ko: '대기 중' },
    adm_f_approved:   { ar: 'معتمدة', en: 'Approved', ko: '승인됨' },
    adm_f_sold:       { ar: 'مباعة', en: 'Sold', ko: '판매됨' },
    adm_f_hidden:     { ar: 'مخفية', en: 'Hidden', ko: '숨김' },
    adm_f_all:        { ar: 'الكل', en: 'All', ko: '전체' },
    adm_f_open:       { ar: 'الجارية', en: 'Open', ko: '진행 중' },
    adm_f_delivered:  { ar: 'المُسلّمة', en: 'Delivered', ko: '완료' },
    adm_import:       { ar: 'استيراد من المصادر', en: 'Import from sources', ko: '소스에서 가져오기' },
    adm_import_hint:  { ar: 'تُسحب بيانات السيارة والسعر من المصدر مباشرة وتُضاف كسيارة «بانتظار الموافقة»', en: 'Car data and price are pulled from the source and added as "pending"', ko: '차량 정보와 가격을 소스에서 가져와 "대기" 상태로 추가합니다' },
    adm_import_go:    { ar: 'استيراد', en: 'Import', ko: '가져오기' },
    adm_import_ok:    { ar: 'تم الاستيراد ✓ السيارة بانتظار موافقتك', en: 'Imported ✓ pending your approval', ko: '가져오기 완료 ✓ 승인 대기 중' },
    adm_import_fail:  { ar: 'تعذر الاستيراد', en: 'Import failed', ko: '가져오기 실패' },
    adm_source:       { ar: 'المصدر', en: 'Source', ko: '소스' },
    adm_source_id:    { ar: 'معرّف السيارة', en: 'Car ID', ko: '차량 ID' },
    adm_new_veh:      { ar: '+ سيارة يدوية', en: '+ Manual car', ko: '+ 수동 등록' },
    adm_veh_edit:     { ar: 'تعديل السيارة', en: 'Edit vehicle', ko: '차량 수정' },
    adm_veh_modal:    { ar: 'بيانات السيارة', en: 'Vehicle details', ko: '차량 정보' },
    adm_veh_empty:    { ar: 'لا توجد سيارات بهذا الفلتر', en: 'No vehicles match this filter', ko: '해당 필터의 차량이 없습니다' },
    adm_make:         { ar: 'الماركة', en: 'Make', ko: '제조사' },
    adm_model:        { ar: 'الموديل', en: 'Model', ko: '모델' },
    adm_price_sar:    { ar: 'السعر (ريال)', en: 'Price (SAR)', ko: '가격 (SAR)' },
    adm_status:       { ar: 'الحالة', en: 'Status', ko: '상태' },
    adm_images:       { ar: 'الصور (يمكن اختيار عدة صور)', en: 'Photos (multiple allowed)', ko: '사진 (여러 장 가능)' },
    adm_insp:         { ar: 'تقرير الفحص (PDF أو صورة)', en: 'Inspection report (PDF or image)', ko: '점검 보고서 (PDF/이미지)' },
    adm_approve:      { ar: 'اعتماد', en: 'Approve', ko: '승인' },
    adm_mark_sold:    { ar: 'بيعت', en: 'Sold', ko: '판매됨' },
    adm_hide:         { ar: 'إخفاء', en: 'Hide', ko: '숨기기' },
    adm_confirm_del:  { ar: 'متأكد من الحذف؟ لا يمكن التراجع', en: 'Delete permanently? This cannot be undone', ko: '영구 삭제하시겠습니까?' },
    adm_del_has_orders:{ ar: 'لا يمكن الحذف — توجد طلبات مرتبطة بهذه السيارة', en: 'Cannot delete — orders are linked to this vehicle', ko: '삭제 불가 — 연결된 주문이 있습니다' },
    adm_cancel:       { ar: 'إلغاء', en: 'Cancel', ko: '취소' },
    adm_ord_search:   { ar: 'بحث: اسم / جوال العميل', en: 'Search: customer name / phone', ko: '검색: 고객명/전화' },
    adm_ord_empty:    { ar: 'لا توجد طلبات', en: 'No orders', ko: '주문 없음' },
    adm_new_ord:      { ar: '+ طلب يدوي', en: '+ Manual order', ko: '+ 수동 주문' },
    adm_ord_cust:     { ar: 'العميل (ابحث بالجوال أو الاسم)', en: 'Customer (search by phone or name)', ko: '고객 (전화/이름 검색)' },
    adm_ord_cust_ph:  { ar: '05XXXXXXXX أو الاسم', en: '05XXXXXXXX or name', ko: '05XXXXXXXX 또는 이름' },
    adm_ord_veh:      { ar: 'السيارة (ابحث بالماركة أو الموديل)', en: 'Vehicle (search by make or model)', ko: '차량 (제조사/모델 검색)' },
    adm_ord_veh_ph:   { ar: 'مثال: G80', en: 'e.g. G80', ko: '예: G80' },
    adm_ord_price:    { ar: 'السعر النهائي (ريال)', en: 'Final price (SAR)', ko: '최종 가격 (SAR)' },
    adm_ord_create:   { ar: 'إنشاء الطلب', en: 'Create order', ko: '주문 생성' },
    adm_ord_pick:     { ar: 'اختر العميل والسيارة من نتائج البحث أولاً', en: 'Pick the customer and vehicle from the search results first', ko: '검색 결과에서 고객과 차량을 먼저 선택하세요' },
    adm_cust_hidden:  { ar: 'بيانات العميل غير متاحة لدورك', en: 'Customer details not visible for your role', ko: '고객 정보 열람 권한 없음' },
    adm_milestones:   { ar: 'مراحل الشحن ▾', en: 'Milestones ▾', ko: '배송 단계 ▾' },
    adm_ms_title:     { ar: 'عنوان المرحلة (مثال: وصلت ميناء الدمام)', en: 'Milestone title (e.g. Arrived at Dammam port)', ko: '단계 제목' },
    adm_ms_desc:      { ar: 'وصف مختصر (اختياري)', en: 'Short description (optional)', ko: '간단 설명 (선택)' },
    adm_ms_loc:       { ar: 'الموقع (مثال: إنشون، كوريا)', en: 'Location (e.g. Incheon, Korea)', ko: '위치' },
    adm_ms_add:       { ar: '+ إضافة المرحلة (يصل العميل إشعار فوري)', en: '+ Add milestone (customer is notified live)', ko: '+ 단계 추가 (고객에게 실시간 알림)' },
    adm_status_sent:  { ar: 'تم التحديث ✓ وصل العميل إشعار تلقائي', en: 'Updated ✓ the customer was notified automatically', ko: '업데이트됨 ✓ 고객에게 자동 알림 발송' },
    adm_cust_search:  { ar: 'بحث بالاسم / الجوال / البريد', en: 'Search by name / phone / email', ko: '이름/전화/이메일 검색' },
    adm_new_cust:     { ar: '+ حساب عميل', en: '+ Customer account', ko: '+ 고객 계정' },
    adm_new_staff:    { ar: '+ حساب موظف', en: '+ Staff account', ko: '+ 직원 계정' },
    adm_no_staff:     { ar: 'لا يوجد موظفون بعد', en: 'No staff yet', ko: '아직 직원이 없습니다' },
    adm_role:         { ar: 'الدور', en: 'Role', ko: '역할' },
    adm_user_create:  { ar: 'إنشاء الحساب', en: 'Create account', ko: '계정 만들기' },
    adm_user_ok:      { ar: 'تم إنشاء الحساب ✓', en: 'Account created ✓', ko: '계정 생성됨 ✓' },
    adm_grant:        { ar: 'منح دور لمستخدم حالي', en: 'Grant role to existing user', ko: '기존 사용자에게 역할 부여' },
    adm_grant_go:     { ar: 'منح الدور', en: 'Grant role', ko: '역할 부여' },
    adm_role_dup:     { ar: 'هذا المستخدم يحمل الدور بالفعل', en: 'User already has this role', ko: '이미 해당 역할을 보유 중' },
    adm_confirm_revoke:{ ar: 'سحب هذا الدور من المستخدم؟', en: 'Revoke this role from the user?', ko: '이 역할을 회수하시겠습니까?' },

    // site-auth.js (public pages wiring)
    site_fav_login_t:  { ar: 'سجّل الدخول لحفظ المفضلة', en: 'Sign in to save favorites', ko: '즐겨찾기는 로그인 후 이용 가능' },
    site_fav_login_b:  { ar: 'أنشئ حساباً مجانياً خلال دقيقة لتحفظ سياراتك المفضلة وتتابع طلباتك', en: 'Create a free account in a minute to save cars and track your orders', ko: '1분 만에 무료 계정을 만들어 차량을 저장하고 주문을 추적하세요' },
    site_fav_added:    { ar: 'أُضيفت للمفضلة ❤', en: 'Added to favorites ❤', ko: '즐겨찾기에 추가됨 ❤' },
    site_fav_removed:  { ar: 'أُزيلت من المفضلة', en: 'Removed from favorites', ko: '즐겨찾기에서 제거됨' },
    site_order_btn:    { ar: 'اطلب هذه السيارة الآن', en: 'Order this car now', ko: '지금 이 차량 주문하기' },
    site_wa_alt:       { ar: 'أو اطلب عبر واتساب', en: 'Or order via WhatsApp', ko: '또는 WhatsApp으로 주문' },
    site_order_login_t:{ ar: 'خطوة واحدة تفصلك عن طلبك', en: 'One step away from your order', ko: '주문까지 한 단계 남았습니다' },
    site_order_login_b:{ ar: 'سجّل الدخول ليُسجَّل طلبك باسمك وتتابع كل مراحل الشحن لحظة بلحظة، أو تابع عبر واتساب مباشرة', en: 'Sign in so your order is registered to you with live shipment tracking, or continue via WhatsApp', ko: '로그인하면 주문이 등록되고 실시간 배송 추적이 가능합니다. 또는 WhatsApp으로 진행하세요' },
    site_order_login_go:{ ar: 'تسجيل الدخول وإتمام الطلب', en: 'Sign in & complete the order', ko: '로그인 후 주문 완료' },
    site_order_wa:     { ar: 'المتابعة عبر واتساب', en: 'Continue via WhatsApp', ko: 'WhatsApp으로 계속' },
    site_order_ok_t:   { ar: 'تم استلام طلبك بنجاح', en: 'Your order was received', ko: '주문이 접수되었습니다' },
    site_order_ok_b:   { ar: 'سيتواصل معك فريقنا قريباً لتأكيد التفاصيل، ويمكنك متابعة كل مراحل الشحن من صفحة طلباتي', en: 'Our team will contact you soon. Track every shipment milestone from My Orders', ko: '팀에서 곧 연락드립니다. 내 주문에서 모든 배송 단계를 추적하세요' },
    site_order_dup_t:  { ar: 'لديك طلب قائم على هذه السيارة', en: 'You already have an open order for this car', ko: '이 차량에 대한 진행 중인 주문이 있습니다' },
    site_order_dup_b:  { ar: 'طلبك السابق ما زال قيد المعالجة — تابعه من صفحة طلباتي', en: 'Your previous order is still in progress — track it in My Orders', ko: '이전 주문이 진행 중입니다 — 내 주문에서 확인하세요' },
    site_order_view:   { ar: 'عرض طلباتي', en: 'View my orders', ko: '내 주문 보기' },
    site_order_stay:   { ar: 'متابعة التصفح', en: 'Keep browsing', ko: '계속 둘러보기' },
    site_order_fail:   { ar: 'تعذر تسجيل الطلب — أعد المحاولة أو تواصل عبر واتساب', en: 'Could not place the order — retry or contact us on WhatsApp', ko: '주문 실패 — 다시 시도하거나 WhatsApp으로 문의하세요' }
  };

  /* ── TEXT_MAP: static visible text, keyed by normalized Arabic ──
     (Engine restores Arabic for lang='ar', so only en/ko needed.)  */
  var TEXT_MAP = {
    // Brand / nav
    'معرض العز العالمي': { en: 'AL-EZZ International', ko: '알에즈 인터내셔널' },
    'استيراد سيارات كورية فاخرة': { en: 'Premium Korean Car Imports', ko: '프리미엄 한국 자동차 수입' },
    'مميزاتنا': { en: 'Features', ko: '장점' },
    'المزادات': { en: 'Auctions', ko: '경매' },
    'قصص النجاح': { en: 'Success Stories', ko: '성공 사례' },
    'الأسئلة الشائعة': { en: 'FAQ', ko: '자주 묻는 질문' },
    'السيارات المتاحة': { en: 'Available Cars', ko: '구매 가능 차량' },
    'تواصل معنا': { en: 'Contact Us', ko: '문의하기' },
    'تواصل معنا الآن': { en: 'Contact Us Now', ko: '지금 문의하기' },
    'القائمة': { en: 'Menu', ko: '메뉴' },
    'تواصل عبر واتساب': { en: 'Contact via WhatsApp', ko: 'WhatsApp으로 문의' },

    // Hero (s1)
    'منذ 2019 — أكثر من 3000 سيارة': { en: 'Since 2019 — 3000+ cars', ko: '2019년부터 — 3,000대 이상' },
    'استورد سيارتك الكورية الفاخرة': { en: 'Import your premium Korean car', ko: '프리미엄 한국 차량을 수입하세요' },
    'مع معرض العز العالمي': { en: 'with AL-EZZ International', ko: '알에즈 인터내셔널과 함께' },
    'خبرة منذ 2019، استوردنا أكثر من': { en: 'With experience since 2019, we have successfully imported over', ko: '2019년부터의 경험으로 다음 이상을 성공적으로 수입했습니다' },
    'بنجاح. نرافقك في رحلة ميدانية من كوريا إلى الرياض.': { en: 'cars. We accompany you on a field journey from Korea to Riyadh.', ko: '대. 한국에서 리야드까지 현장 여정을 함께합니다.' },
    'تواصل معنا للبحث عن سيارتك': { en: 'Contact us to find your car', ko: '차량 찾기 문의하기' },
    'اكتشف رحلة الاستيراد الميدانية': { en: 'Discover the field import journey', ko: '현장 수입 여정 보기' },
    'ضمان الجودة': { en: 'Quality Guarantee', ko: '품질 보증' },
    'فحص فني شامل': { en: 'Full Technical Inspection', ko: '정밀 기술 점검' },
    'رضا 100%': { en: '100% Satisfaction', ko: '100% 만족' },
    'سيارة مُستوردة': { en: 'Imported Cars', ko: '수입 차량' },
    'تأسيس الشركة': { en: 'Company Founded', ko: '회사 설립' },
    'مرِّر للأسفل': { en: 'Scroll down', ko: '아래로 스크롤' },

    // Field journey (s2)
    'الرحلة الميدانية إلى كوريا': { en: 'The Field Journey to Korea', ko: '한국 현장 여정' },
    'نرافقك خطوةً بخطوة': { en: 'We accompany you step by step', ko: '단계별로 함께합니다' },
    'من إنتشون إلى الرياض': { en: 'From Incheon to Riyadh', ko: '인천에서 리야드까지' },
    'استقبال في مطار إنتشون وإقامة فندقية': { en: 'Airport pickup at Incheon & hotel stay', ko: '인천공항 영접 및 호텔 숙박' },
    'جولة على المزادات وفحص السيارات': { en: 'Auction tours & vehicle inspection', ko: '경매장 투어 및 차량 점검' },
    'تفاوض مباشر وإتمام صفقة الشراء': { en: 'Direct negotiation & closing the deal', ko: '직접 협상 및 구매 완료' },
    'شحن وتخليص جمركي حتى الرياض': { en: 'Shipping & customs clearance to Riyadh', ko: '리야드까지 배송 및 통관' },
    'احجز رحلتك الميدانية الآن': { en: 'Book your field trip now', ko: '지금 현장 방문 예약' },
    'تابع التمرير': { en: 'Keep scrolling', ko: '계속 스크롤' },
    '١': { en: '1', ko: '1' }, '٢': { en: '2', ko: '2' }, '٣': { en: '3', ko: '3' }, '٤': { en: '4', ko: '4' },

    // Live cars
    'مباشر من كوريا الآن': { en: 'Live from Korea Now', ko: '지금 한국에서 실시간' },
    'سيارات متاحة': { en: 'Cars available', ko: '구매 가능한 차량' },
    'الآن في كوريا': { en: 'now in Korea', ko: '지금 한국에' },
    'أسعار وصور حقيقية محدّثة لحظياً من المزادات والمعارض الكورية': { en: 'Real prices & photos, updated live from Korean auctions and showrooms', ko: '한국 경매장과 전시장에서 실시간 업데이트되는 실제 가격과 사진' },
    'الكل': { en: 'All', ko: '전체' },
    'جينيسيس': { en: 'Genesis', ko: '제네시스' },
    'هيونداي': { en: 'Hyundai', ko: '현대' },
    'كيا': { en: 'Kia', ko: '기아' },
    'مرسيدس': { en: 'Mercedes', ko: '메르세데스' },
    'تصفح جميع السيارات': { en: 'Browse all cars', ko: '모든 차량 보기' },
    'تصفح 3,409+ سيارة بأسعار وصور حقيقية — محدّثة لحظياً من كوريا': { en: 'Browse 3,409+ cars with real prices and photos — updated live from Korea', ko: '실제 가격과 사진이 있는 3,409대 이상의 차량 — 한국에서 실시간 업데이트' },

    // Full-screen visual (s3)
    'الفخامة بلا حدود': { en: 'Luxury Without Limits', ko: '한계 없는 럭셔리' },
    'استوردنا أكثر من': { en: 'We have imported over', ko: '지금까지 수입한 차량' },
    '3000 سيارة فاخرة': { en: '3000 luxury cars', ko: '3,000대의 럭셔리 차량' },
    'تجربة مرئية حية من أرض المزادات الكورية — كل سيارة رحلة وقصة': { en: "A live visual experience from Korea's auction grounds — every car a journey and a story", ko: '한국 경매 현장의 생생한 영상 경험 — 모든 차량은 하나의 여정이자 이야기' },
    'ابدأ رحلتك الآن': { en: 'Start your journey now', ko: '지금 여정을 시작하세요' },
    'نسبة رضا العملاء': { en: 'Customer Satisfaction', ko: '고객 만족도' },
    'سنة التأسيس': { en: 'Year Founded', ko: '설립 연도' },
    'سنوات خبرة': { en: 'Years of Experience', ko: '경력 연수' },
    'معرض (رياض + كوريا)': { en: 'Showrooms (Riyadh + Korea)', ko: '전시장 (리야드 + 한국)' },

    // Features
    'لماذا معرض العز العالمي؟': { en: 'Why AL-EZZ International?', ko: '왜 알에즈 인터내셔널인가?' },
    'مزاياكم التنافسية': { en: 'Your Competitive Advantages', ko: '당신의 경쟁 우위' },
    'نقدم تجربة استيراد متكاملة ومضمونة من أول اتصال حتى استلام مفاتيح سيارتك': { en: 'We offer a complete, guaranteed import experience — from the first call to handing you the keys', ko: '첫 연락부터 차 키를 건네받는 순간까지 완벽하고 보장된 수입 경험을 제공합니다' },
    'خبرة منذ 2019': { en: 'Experience since 2019', ko: '2019년부터의 경험' },
    'تم استيرادها بنجاح. تاريخ حافل يتحدث عن نفسه.': { en: 'successfully imported. A track record that speaks for itself.', ko: '대를 성공적으로 수입했습니다. 실적이 스스로 말해줍니다.' },
    'خدمة مرافقة ميدانية': { en: 'Field Accompaniment Service', ko: '현장 동행 서비스' },
    'استقبال، إقامة، فحص دقيق، وتفاوض مباشر في كوريا. نحن معك خطوة بخطوة.': { en: 'Pickup, accommodation, precise inspection, and direct negotiation in Korea. We are with you every step.', ko: '영접, 숙박, 정밀 점검, 그리고 한국에서의 직접 협상. 매 단계 함께합니다.' },
    'فحص فني دقيق': { en: 'Precise Technical Inspection', ko: '정밀 기술 점검' },
    'تواجد محلي ودولي': { en: 'Local & International Presence', ko: '국내외 네트워크' },
    'وفي': { en: 'and in', ko: '그리고' },

    // Auctions
    'فرص حصرية': { en: 'Exclusive Opportunities', ko: '독점 기회' },
    'مزادات كوريا': { en: 'Korea Auctions', ko: '한국 경매' },
    'اليوم': { en: 'Today', ko: '오늘' },
    'أسعار المزادات محدَّثة — تواصل معنا فوراً للتزايد قبل فوات الأوان': { en: 'Auction prices updated — contact us now to bid before it is too late', ko: '경매 가격 업데이트 — 늦기 전에 지금 입찰 문의하세요' },
    'جينيسس 2025': { en: 'Genesis 2025', ko: '제네시스 2025' },
    'هونداي ازيرا 2025': { en: 'Hyundai Azera 2025', ko: '현대 아제라 2025' },
    'كيا كي 8': { en: 'Kia K8', ko: '기아 K8' },
    'متاح الآن': { en: 'Available Now', ko: '지금 구매 가능' },
    'مزاد حار': { en: 'Hot Auction', ko: '인기 경매' },
    'ينتهي قريباً': { en: 'Ending Soon', ko: '곧 종료' },
    'السعر الحالي في المزاد': { en: 'Current auction price', ko: '현재 경매가' },
    'سعر الشركة التقديري': { en: 'Estimated dealer price', ko: '예상 딜러 가격' },
    'توفيرك المتوقع:': { en: 'Your expected savings:', ko: '예상 절감액:' },
    'زايد الآن': { en: 'Bid Now', ko: '지금 입찰' },
    'زايد الآن عبر واتساب': { en: 'Bid now via WhatsApp', ko: 'WhatsApp으로 지금 입찰' },
    'عرض جميع سيارات المزاد': { en: 'View all auction cars', ko: '모든 경매 차량 보기' },
    'مباشر من مزادات كوريا': { en: 'Live from Korean auctions', ko: '한국 경매 실시간' },
    'سيارات المزاد': { en: 'Auction cars', ko: '경매 차량' },
    'أسعار وصور حقيقية من أرض المزاد — زايد قبل فوات الأوان': { en: 'Real prices and photos from the auction floor — bid before it is too late', ko: '경매 현장의 실제 가격과 사진 — 늦기 전에 입찰하세요' },
    'عرض المزيد من المزادات': { en: 'Show more auctions', ko: '더 많은 경매 보기' },
    '← رجوع إلى المزادات': { en: '← Back to auctions', ko: '← 경매로 돌아가기' },
    'تعذّر العثور على السيارة': { en: 'Vehicle not found', ko: '차량을 찾을 수 없습니다' },
    'ربما بيعت السيارة أو انتهى عرضها في المزاد. تصفح سيارات مزاد أخرى متاحة.': { en: 'The car may be sold or its auction listing has ended. Browse other available auction cars.', ko: '차량이 판매되었거나 경매가 종료되었을 수 있습니다. 다른 경매 차량을 둘러보세요.' },
    'المواصفات': { en: 'Specifications', ko: '사양' },
    'المزايا والتجهيزات': { en: 'Features & Equipment', ko: '옵션 및 사양' },
    'تقرير الحالة': { en: 'Condition Report', ko: '상태 보고서' },
    'بنود خاصة': { en: 'Special notes', ko: '특이사항' },
    'مخطط حالة الهيكل — تقرير الفحص الرسمي': { en: 'Body condition map — official inspection report', ko: '차체 상태도 — 공식 검사 보고서' },
    'لا يوفر المزاد مخطط فحص رسمي لهذه السيارة.': { en: 'The auction does not provide an official inspection sheet for this car.', ko: '이 차량에 대한 공식 검사표는 경매장에서 제공되지 않습니다.' },
    'لم ينشر المزاد تقرير حالة لهذه السيارة بعد — فريقنا في كوريا يفحصها لك ميدانياً قبل المزايدة.': { en: 'The auction has not published a condition report for this car — our team in Korea inspects it for you on-site before bidding.', ko: '이 차량의 상태 보고서가 아직 공개되지 않았습니다 — 입찰 전 한국 현지 팀이 직접 점검해 드립니다.' },
    'اطلب تقرير الفحص عبر واتساب': { en: 'Request the inspection report via WhatsApp', ko: 'WhatsApp으로 검사 보고서 요청' },
    '* السعر لا يشمل الشحن والجمارك': { en: '* Price excludes shipping and customs', ko: '* 가격은 배송 및 통관 비용 제외' },
    'الأحدث إضافة': { en: 'Recently added', ko: '최근 등록순' },
    'السعر: من الأقل': { en: 'Price: low to high', ko: '가격 낮은순' },
    'السعر: من الأعلى': { en: 'Price: high to low', ko: '가격 높은순' },
    'الموديل الأحدث': { en: 'Newest model year', ko: '최신 연식순' },
    'أودي': { en: 'Audi', ko: '아우디' },
    '2025 — 1,200 كم': { en: '2025 — 1,200 km', ko: '2025 — 1,200 km' },
    '2025 — 3,200 كم': { en: '2025 — 3,200 km', ko: '2025 — 3,200 km' },
    '2025 — 4,500 كم': { en: '2025 — 4,500 km', ko: '2025 — 4,500 km' },

    // Calculator
    'حساب توفير الاستيراد': { en: 'Import Savings Calculator', ko: '수입 절감 계산기' },
    'محاكي التوفير التفاعلي': { en: 'Interactive Savings Simulator', ko: '인터랙티브 절감 시뮬레이터' },
    'قارن تكلفة الاستيراد شاملة الشحن والجمارك مع أسعار السوق المحلي مباشرة': { en: 'Compare the full import cost (shipping + customs) against local market prices instantly', ko: '배송과 통관을 포함한 전체 수입 비용을 국내 시장 가격과 즉시 비교하세요' },
    'قيمة المركبة': { en: 'Vehicle value', ko: '차량 가치' },
    'تكلفة الشحن البحري': { en: 'Sea freight cost', ko: '해상 운송비' },
    'الجمارك والرسوم': { en: 'Customs & fees', ko: '관세 및 수수료' },
    'قيمة الفائدة': { en: 'Service value', ko: '서비스 가치' },
    'ثابت': { en: 'Fixed', ko: '고정' },
    '٢٠٪': { en: '20%', ko: '20%' },
    'التكلفة التقريبية للاستيراد': { en: 'Approx. import cost', ko: '대략적인 수입 비용' },
    'نتائج الحساب المباشرة': { en: 'Live calculation results', ko: '실시간 계산 결과' },
    'التكلفة الإجمالية معك': { en: 'Total cost with us', ko: '당사 이용 시 총 비용' },
    '* تشمل سعر المزاد، الشحن والرسوم': { en: '* Includes auction price, shipping and fees', ko: '* 경매가, 배송비, 수수료 포함' },
    'السوق المحلي': { en: 'Local market', ko: '국내 시장' },
    'وفرت مع العز': { en: 'You saved with AL-EZZ', ko: '알에즈로 절감' },
    'نسبة التوفير التقديرية': { en: 'Estimated savings rate', ko: '예상 절감률' },
    'ابدأ رحلة الاستيراد والتوفير': { en: 'Start importing and saving', ko: '수입과 절감을 시작하세요' },

    // Stats band
    'سنوات خبرة': { en: 'Years of Experience', ko: '경력 연수' },

    // Success stories
    'عملاؤنا يتحدثون': { en: 'Our Clients Speak', ko: '고객의 목소리' },
    'قصص نجاح من معرض العز العالمي': { en: 'Success stories from AL-EZZ International', ko: '알에즈 인터내셔널의 성공 사례' },
    'خالد العتيبي — الرياض': { en: 'Khalid Al-Otaibi — Riyadh', ko: '칼리드 알오타이비 — 리야드' },
    'محمد الشمري — جدة': { en: 'Mohammed Al-Shammari — Jeddah', ko: '모하메드 알샴마리 — 제다' },
    'عبدالله الدوسري — الدمام': { en: 'Abdullah Al-Dosari — Dammam', ko: '압둘라 알도사리 — 담맘' },
    '"استوردت جينيسس 2025 موفراً أكثر من 22,000 ريال مقارنة بالوكيل. الفريق رافقني في كوريا وأشرف على كل شيء. تجربة لا تُنسى!"': { en: '"I imported a Genesis 2025, saving over 22,000 SAR versus the dealer. The team accompanied me in Korea and oversaw everything. Unforgettable!"', ko: '"제네시스 2025를 수입해 딜러 대비 22,000 SAR 이상 절감했습니다. 팀이 한국에서 동행하며 모든 것을 챙겨주었어요. 잊지 못할 경험!"' },
    '"ما توقعت الخدمة تكون بهذا المستوى. الشفافية الكاملة في الأسعار والفحص الدقيق أعطاني ثقة كبيرة. نصحت كل أصدقائي بهم."': { en: '"I never expected this level of service. Full price transparency and precise inspection gave me great confidence. I recommended them to all my friends."', ko: '"이 정도의 서비스는 기대하지 못했어요. 완전한 가격 투명성과 정밀 점검이 큰 신뢰를 주었습니다. 친구들에게 모두 추천했어요."' },
    '"اشتريت كيا كي 8 وتم التسليم خلال 45 يوماً بالضبط. السيارة وصلت بحالة ممتازة تماماً كما وُصفت. أفضل قرار اتخذته."': { en: '"I bought a Kia K8 and it was delivered in exactly 45 days. The car arrived in excellent condition, exactly as described. Best decision I made."', ko: '"기아 K8을 구매했고 정확히 45일 만에 배송되었습니다. 차량은 설명 그대로 훌륭한 상태로 도착했어요. 최고의 선택이었습니다."' },

    // Tracking map
    'خريطة التتبع التفاعلية ثلاثية الأبعاد': { en: '3D Interactive Tracking Map', ko: '3D 인터랙티브 추적 지도' },
    'مسار الاستيراد: الرياض': { en: 'Import route: Riyadh', ko: '수입 경로: 리야드' },
    'المرحلة الحالية': { en: 'Current stage', ko: '현재 단계' },

    // FAQ
    'كل ما تريد معرفته': { en: 'Everything You Want to Know', ko: '알고 싶은 모든 것' },
    'كيف تضمنون مطابقة المواصفات المطلوبة؟': { en: 'How do you guarantee the car matches the required specs?', ko: '요청한 사양과 일치함을 어떻게 보장하나요?' },
    'نعتمد على قائمة تفصيلية دقيقة تشمل الموديل، السنة، اللون، المحرك، والمواصفات التقنية. يتم مراجعتها مع العميل قبل الذهاب للمزاد، ولا يُشترى إلا ما يطابقها 100%.': { en: 'We rely on a precise, detailed checklist covering model, year, color, engine, and technical specs. It is reviewed with the client before the auction, and we only buy what matches it 100%.', ko: '모델, 연식, 색상, 엔진, 기술 사양을 포함한 정밀한 체크리스트를 사용합니다. 경매 전 고객과 검토하며, 100% 일치하는 차량만 구매합니다.' },
    'ما هي آلية الفحص الفني قبل الشراء؟': { en: 'What is the technical inspection process before purchase?', ko: '구매 전 기술 점검 절차는 어떻게 되나요?' },
    'نستخدم أجهزة فحص معتمدة تكشف الحوادث السابقة، التصوير الكامل، وتقرير المصنع. يُرسل للعميل تقرير PDF شامل مع صور 360° قبل المصادقة على الشراء.': { en: 'We use certified inspection equipment that detects prior accidents, full photography, and the factory report. A comprehensive PDF report with 360° photos is sent to the client before approving the purchase.', ko: '이전 사고를 감지하는 인증 점검 장비, 전체 촬영, 제조사 보고서를 사용합니다. 구매 승인 전 360° 사진이 포함된 종합 PDF 보고서를 고객에게 보냅니다.' },
    'كم تستغرق مدة الشحن من كوريا إلى الرياض؟': { en: 'How long does shipping take from Korea to Riyadh?', ko: '한국에서 리야드까지 배송은 얼마나 걸리나요?' },
    'ما هي إجراءات الجمارك والتخليص؟': { en: 'What are the customs and clearance procedures?', ko: '관세 및 통관 절차는 어떻게 되나요?' },
    'هل يمكنني مرافقتكم شخصياً إلى كوريا؟': { en: 'Can I personally accompany you to Korea?', ko: '한국에 직접 동행할 수 있나요?' },
    // FAQ answers (Q3 is split into 3 text nodes by the <strong> tag)
    'متوسط مدة الشحن البحري من إنتشون إلى ميناء جدة أو الدمام': { en: 'Average sea shipping time from Incheon to Jeddah or Dammam port is', ko: '인천에서 제다 또는 담맘 항구까지의 평균 해상 운송 기간은' },
    '30–40 يوماً': { en: '30–40 days', ko: '30–40일' },
    '. بعد وصول السيارة يتم استيفاء إجراءات الجمارك خلال 3–7 أيام عمل ثم التسليم في الرياض.': { en: '. After the car arrives, customs is cleared within 3–7 business days, then it is delivered in Riyadh.', ko: '입니다. 차량 도착 후 3–7 영업일 내에 통관이 완료되며 이후 리야드에서 인도됩니다.' },
    'نتولى كامل عملية التخليص الجمركي نيابةً عنك. تشمل: شهادة المنشأ، فاتورة الشراء، وثائق الشحن، وتسديد الرسوم الجمركية (5% + ضريبة القيمة المضافة). لا تحتاج لأي تدخل شخصي.': { en: 'We handle the entire customs clearance process on your behalf, including: certificate of origin, purchase invoice, shipping documents, and payment of customs duties (5% + VAT). No personal involvement is needed.', ko: '통관 절차 전체를 대행해 드립니다. 원산지 증명서, 구매 송장, 선적 서류, 관세 납부(5% + 부가가치세)가 포함되며 개인적인 개입이 전혀 필요 없습니다.' },
    'نعم، هذه خدمتنا الأكثر تميزاً! نوفر لك رحلة ميدانية كاملة: استقبال في مطار إنتشون، إقامة فندقية، جولة على المزادات، والتفاوض بالنيابة عنك. تواصل معنا لحجز موعد الرحلة القادمة.': { en: 'Yes — this is our signature service! We provide a complete field trip: pickup at Incheon Airport, hotel accommodation, auction tours, and negotiation on your behalf. Contact us to book the next trip.', ko: '네, 저희의 가장 특별한 서비스입니다! 인천공항 영접, 호텔 숙박, 경매장 투어, 대리 협상까지 완전한 현장 여행을 제공합니다. 다음 여행 예약은 문의해 주세요.' },

    // Footer
    'شركة متخصصة في استيراد السيارات الكورية الفاخرة منذ عام 2019. نقدم خدمة مرافقة ميدانية متكاملة من لحظة البحث عن السيارة في كوريا حتى تسليمها بيدك في الرياض.': { en: 'A company specialized in importing premium Korean cars since 2019. We provide a complete field accompaniment service — from finding the car in Korea to handing it to you in Riyadh.', ko: '2019년부터 프리미엄 한국 차량 수입을 전문으로 하는 회사입니다. 한국에서 차량을 찾는 순간부터 리야드에서 인도하기까지 완벽한 현장 동행 서비스를 제공합니다.' },
    'مواقعنا': { en: 'Our Locations', ko: '지점 안내' },
    'معرض الرياض ↗': { en: 'Riyadh Showroom ↗', ko: '리야드 전시장 ↗' },
    'واتساب مباشر': { en: 'Direct WhatsApp', ko: 'WhatsApp 바로가기' },
    'تابعونا على': { en: 'Follow us on', ko: '팔로우하기' },
    '© 2025 معرض العز العالمي لاستيراد السيارات. جميع الحقوق محفوظة.': { en: '© 2025 AL-EZZ International for Car Imports. All rights reserved.', ko: '© 2025 알에즈 인터내셔널 자동차 수입. 모든 권리 보유.' },
    'الرياض، المملكة العربية السعودية | إنتشون، كوريا الجنوبية': { en: 'Riyadh, Saudi Arabia | Incheon, South Korea', ko: '리야드, 사우디아라비아 | 인천, 대한민국' },

    // ── cars.html search page ──
    'العز العالمي': { en: 'AL-EZZ International', ko: '알에즈 인터내셔널' },
    '← الرئيسية': { en: '← Home', ko: '← 홈' },
    'مباشر من مزادات كوريا': { en: 'Live from Korean auctions', ko: '한국 경매 실시간' },
    'تصفح': { en: 'Browse', ko: '둘러보기' },
    'جميع السيارات': { en: 'all cars', ko: '모든 차량' },
    'جارٍ التحميل…': { en: 'Loading…', ko: '불러오는 중…' },
    '⚙️ الفلاتر والبحث': { en: '⚙️ Filters & Search', ko: '⚙️ 필터 및 검색' },
    'الفلاتر': { en: 'Filters', ko: '필터' },
    'الشركة المصنعة': { en: 'Make', ko: '제조사' },
    'الموديل': { en: 'Model', ko: '모델' },
    'سنة الصنع': { en: 'Year', ko: '연식' },
    'من سنة': { en: 'From year', ko: '시작 연도' },
    'إلى سنة': { en: 'To year', ko: '종료 연도' },
    'الحالة': { en: 'Condition', ko: '상태' },
    'جديد': { en: 'New', ko: '신차' },
    'مستعمل': { en: 'Used', ko: '중고' },
    'ناقل الحركة': { en: 'Transmission', ko: '변속기' },
    'أوتوماتيك': { en: 'Automatic', ko: '자동' },
    'يدوي': { en: 'Manual', ko: '수동' },
    'نوع الوقود': { en: 'Fuel type', ko: '연료' },
    'بنزين': { en: 'Gasoline', ko: '가솔린' },
    'ديزل': { en: 'Diesel', ko: '디젤' },
    'هايبرد': { en: 'Hybrid', ko: '하이브리드' },
    'بلج-إن': { en: 'Plug-in', ko: '플러그인' },
    'كهربائي': { en: 'Electric', ko: '전기' },
    'غاز': { en: 'LPG', ko: 'LPG' },
    'نوع المركبة': { en: 'Body type', ko: '차종' },
    'سيدان': { en: 'Sedan', ko: '세단' },
    'هاتشباك': { en: 'Hatchback', ko: '해치백' },
    'فان': { en: 'Van', ko: '밴' },
    'كوبيه': { en: 'Coupe', ko: '쿠페' },
    'بيك أب': { en: 'Pickup', ko: '픽업' },
    'واغن': { en: 'Wagon', ko: '왜건' },
    'كشف': { en: 'Convertible', ko: '컨버터블' },
    'نطاق السعر (ريال سعودي)': { en: 'Price range', ko: '가격 범위' },
    'الكيلومترات': { en: 'Mileage', ko: '주행거리' },
    'اللون': { en: 'Color', ko: '색상' },
    'أبيض': { en: 'White', ko: '흰색' },
    'أسود': { en: 'Black', ko: '검정' },
    'رمادي': { en: 'Gray', ko: '회색' },
    'فضي': { en: 'Silver', ko: '은색' },
    'أزرق': { en: 'Blue', ko: '파랑' },
    'أحمر': { en: 'Red', ko: '빨강' },
    'بني': { en: 'Brown', ko: '갈색' },
    'أخضر': { en: 'Green', ko: '초록' },
    'ذهبي': { en: 'Gold', ko: '금색' },
    'أصفر': { en: 'Yellow', ko: '노랑' },
    'آخر': { en: 'Other', ko: '기타' },
    'مزايا إضافية': { en: 'Extra features', ko: '추가 옵션' },
    'بدون حوادث مسجلة': { en: 'No recorded accidents', ko: '사고 이력 없음' },
    'مجتاز الفحص الرسمي': { en: 'Passed official inspection', ko: '공식 검사 통과' },
    'صفقات أقل من سعر السوق 🔥': { en: 'Below-market deals 🔥', ko: '시세 이하 매물 🔥' },
    'رقم الإعلان / مرجع': { en: 'Listing / reference no.', ko: '매물 / 참조 번호' },
    '🔍 بحث': { en: '🔍 Search', ko: '🔍 검색' },
    'إعادة تعيين': { en: 'Reset', ko: '초기화' },
    'عرض المزيد من السيارات': { en: 'Show more cars', ko: '더 많은 차량 보기' },

    // ── car.html detail page (static markup) ──
    '← جميع السيارات': { en: '← All cars', ko: '← 모든 차량' },
    'تعذّر العثور على هذه السيارة': { en: 'This car could not be found', ko: '차량을 찾을 수 없습니다' },
    'ربما بِيعت أو أُزيلت من الكتالوج': { en: 'It may be sold or removed from the catalog', ko: '판매되었거나 카탈로그에서 삭제되었을 수 있습니다' },
    'تصفح سيارات أخرى': { en: 'Browse other cars', ko: '다른 차량 보기' },
    'السعر في كوريا': { en: 'Price in Korea', ko: '한국 현지 가격' },
    '* السعر لا يشمل الشحن والجمارك — تواصل معنا لحساب التكلفة النهائية': { en: '* Price excludes shipping and customs — contact us for the final cost', ko: '* 가격은 배송 및 통관 비용 제외 — 최종 비용은 문의해 주세요' },
    'اطلب هذه السيارة الآن': { en: 'Request this car now', ko: '지금 이 차량 문의하기' },
    'الرقم المرجعي:': { en: 'Reference no.:', ko: '참조 번호:' },
    'المواصفات': { en: 'Specifications', ko: '사양' },
    'تقرير الحالة': { en: 'Condition Report', ko: '상태 보고서' },
    'تحليل السعر مقابل السوق': { en: 'Price vs. Market Analysis', ko: '시세 대비 가격 분석' },
    'وصف السيارة': { en: 'Vehicle Description', ko: '차량 설명' },
    'التجهيزات': { en: 'Equipment', ko: '사양 및 옵션' }
  };

  /* ───────────────────────── engine ───────────────────────── */
  function norm(s) { return (s || '').replace(/\s+/g, ' ').trim(); }

  var state = { lang: 'ar' };
  var listeners = [];
  var originals = new WeakMap(); // text node → original Arabic value

  function detect() {
    try {
      var saved = localStorage.getItem('alezz_lang');
      if (saved && LANGS[saved]) return saved;
    } catch (e) {}
    var navs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || ''];
    for (var i = 0; i < navs.length; i++) {
      var l = (navs[i] || '').toLowerCase();
      if (l.indexOf('ar') === 0) return 'ar';
      if (l.indexOf('ko') === 0) return 'ko';
      if (l.indexOf('en') === 0) return 'en';
    }
    return 'ar'; // Arabic fallback
  }

  function t(key, vars) {
    var entry = KEYS[key];
    var s = entry ? (entry[state.lang] || entry.ar || key) : key;
    if (vars) s = s.replace(/\{(\w+)\}/g, function (_, k) { return vars[k] != null ? vars[k] : ''; });
    return s;
  }

  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEXTAREA: 1, CODE: 1, SVG: 1 };
  function skip(el) {
    while (el) {
      if (el.nodeType === 1) {
        if (SKIP_TAGS[(el.tagName || '').toUpperCase()]) return true;
        if (el.hasAttribute && (el.hasAttribute('data-no-i18n') || el.hasAttribute('data-sar') || el.hasAttribute('data-usd'))) return true;
      }
      el = el.parentNode;
    }
    return false;
  }

  function translateTextNodes(root) {
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
    var node, batch = [];
    while ((node = walker.nextNode())) batch.push(node);
    batch.forEach(function (n) {
      var raw = n.nodeValue;
      if (!raw || !raw.trim()) return;
      if (skip(n.parentNode)) return;
      var key = norm(raw);
      if (!originals.has(n)) {
        // only track nodes we can actually translate
        if (!TEXT_MAP[key]) return;
        originals.set(n, raw);
      }
      var origKey = norm(originals.get(n));
      if (state.lang === 'ar') { n.nodeValue = originals.get(n); return; }
      var tr = TEXT_MAP[origKey];
      if (tr && tr[state.lang]) {
        // preserve leading / trailing whitespace of the original node
        var lead = (raw.match(/^\s*/) || [''])[0];
        var tail = (raw.match(/\s*$/) || [''])[0];
        n.nodeValue = lead + tr[state.lang] + tail;
      } else {
        n.nodeValue = originals.get(n);
      }
    });
  }

  function applyAttrs(root) {
    if (!root.querySelectorAll) return;
    // data-i18n="key" → textContent ; data-i18n-html="key" → innerHTML
    root.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    root.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      el.innerHTML = t(el.getAttribute('data-i18n-html'));
    });
    root.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
      el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
        var kv = pair.split(':'); if (kv.length === 2) el.setAttribute(kv[0].trim(), t(kv[1].trim()));
      });
    });
  }

  function apply(root) {
    root = root || document.body;
    if (!root) return;
    translateTextNodes(root);
    applyAttrs(root);
  }

  function setHtmlState() {
    var html = document.documentElement;
    html.setAttribute('lang', state.lang);
    html.setAttribute('dir', state.lang === 'ar' ? 'rtl' : 'ltr');
  }

  function injectFontsOnce() {
    if (document.getElementById('i18n-fonts')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700;900&family=Inter:wght@300;400;600;700;900&display=swap';
    document.head.appendChild(link);
    var st = document.createElement('style');
    st.id = 'i18n-fonts';
    st.textContent =
      'html[lang="ko"] body, html[lang="ko"] .font-cairo, html[lang="ko"] .font-tajawal, html[lang="ko"] h1, html[lang="ko"] h2, html[lang="ko"] h3, html[lang="ko"] h4, html[lang="ko"] h5 { font-family:"Noto Sans KR",sans-serif !important; }' +
      'html[lang="en"] body, html[lang="en"] .font-tajawal { font-family:"Inter","Segoe UI",system-ui,sans-serif !important; }' +
      'html[lang="en"] .font-cairo, html[lang="en"] h1, html[lang="en"] h2, html[lang="en"] h3, html[lang="en"] h4, html[lang="en"] h5 { font-family:"Inter","Segoe UI",system-ui,sans-serif !important; }';
    document.head.appendChild(st);
  }

  function emit() {
    setHtmlState();
    try { window.dispatchEvent(new CustomEvent('langchange', { detail: { lang: state.lang } })); } catch (e) {}
    listeners.forEach(function (fn) { try { fn(state.lang); } catch (e) {} });
  }

  function set(lang) {
    if (!LANGS[lang]) return;
    state.lang = lang;
    try { localStorage.setItem('alezz_lang', lang); } catch (e) {}
    setHtmlState();
    apply(document.body);
    emit();
  }

  state.lang = detect();
  injectFontsOnce();
  injectThemeStyles();
  setHtmlState();

  // ─── THEME STYLES ──────────────────────────────────────────────
  function injectThemeStyles() {
    if (document.getElementById('theme-styles')) return;
    var st = document.createElement('style');
    st.id = 'theme-styles';
    st.textContent =
      /* CSS custom properties — dark mode defaults */
      ':root {' +
      '  --bg-primary: #09090F;' +
      '  --text-primary: #C8D8F0;' +
      '  --text-title: #FFFFFF;' +
      '  --text-muted: rgba(200,216,240,0.55);' +
      '  --border-primary: rgba(255,255,255,0.08);' +
      '  --bg-panel: rgba(12,13,26,0.85);' +
      '  --bg-navbar-mobile: #09090F;' +
      '  --bg-card: #11131F;' +
      '}' +
      /* Light mode variables */
      'html.theme-light {' +
      '  --bg-primary: #F1F5F9;' +
      '  --text-primary: #334155;' +
      '  --text-title: #0F172A;' +
      '  --text-muted: #64748B;' +
      '  --border-primary: rgba(15,23,42,0.10);' +
      '  --bg-panel: #FFFFFF;' +
      '  --bg-navbar-mobile: #FFFFFF;' +
      '  --bg-card: #FFFFFF;' +
      '}' +
      /* Body */
      'html.theme-light body {' +
      '  background-color: var(--bg-primary) !important;' +
      '  color: var(--text-primary) !important;' +
      '}' +
      /* Hero canvas: keep animation running, just tint wrapper slightly */
      'html.theme-light #canvas-sticky {' +
      '  background-color: rgba(241,245,249,0.3) !important;' +
      '}' +
      'html.theme-light .seq-overlay {' +
      '  background: rgba(241,245,249,0.25) !important;' +
      '}' +
      'html.theme-light .seq-overlay::before,' +
      'html.theme-light .seq-overlay::after {' +
      '  opacity: 0.4 !important;' +
      '}' +
      'html.theme-light .seq-grain { display: none !important; }' +
      /* section-fade ::before/::after: change from dark to light blending */
      'html.theme-light .section-fade::before {' +
      '  background: linear-gradient(to bottom,#F1F5F9 0%,rgba(241,245,249,.98) 15%,rgba(241,245,249,.7) 50%,rgba(241,245,249,.2) 82%,transparent 100%) !important;' +
      '}' +
      'html.theme-light .section-fade::after {' +
      '  background: linear-gradient(to top,#F1F5F9 0%,rgba(241,245,249,.98) 15%,rgba(241,245,249,.7) 50%,rgba(241,245,249,.2) 82%,transparent 100%) !important;' +
      '}' +
      /* Named sections */
      'html.theme-light #live-cars,' +
      'html.theme-light #s3-section,' +
      'html.theme-light #auctions,' +
      'html.theme-light #horizontal-scroll-container,' +
      'html.theme-light #success,' +
      'html.theme-light #faq {' +
      '  background: var(--bg-primary) !important;' +
      '}' +
      /* Inline-style dark background overrides */
      'html.theme-light [style*="background:#09090F"],' +
      'html.theme-light [style*="background: #09090F"],' +
      'html.theme-light [style*="background:#0F1020"],' +
      'html.theme-light [style*="background: #0F1020"],' +
      'html.theme-light [style*="background:#11131F"],' +
      'html.theme-light [style*="background: #11131F"],' +
      'html.theme-light [style*="background:#1A1C2E"],' +
      'html.theme-light [style*="background: #1A1C2E"] {' +
      '  background: var(--bg-panel) !important;' +
      '}' +
      /* Footer */
      'html.theme-light #footer-section,' +
      'html.theme-light [style*="background:#050508"],' +
      'html.theme-light [style*="background: #050508"] {' +
      '  background: #E2E8F0 !important;' +
      '}' +
      'html.theme-light #footer-section p,' +
      'html.theme-light #footer-section a,' +
      'html.theme-light #footer-section span {' +
      '  color: var(--text-primary) !important;' +
      '}' +
      'html.theme-light #footer-section a:hover {' +
      '  color: #9A7020 !important;' +
      '}' +
      /* Testimonial cards */
      'html.theme-light .testimonial-card {' +
      '  background-color: #FFFFFF !important;' +
      '  background: #FFFFFF !important;' +
      '  border-color: rgba(15,23,42,0.10) !important;' +
      '  color: var(--text-primary) !important;' +
      '}' +
      'html.theme-light .testimonial-card.active-card {' +
      '  background: linear-gradient(135deg,rgba(255,255,255,1) 0%,rgba(245,248,255,1) 100%) !important;' +
      '  border-color: #C9A84C !important;' +
      '  box-shadow: 0 0 30px rgba(201,168,76,0.20) !important;' +
      '}' +
      /* Horizontal panels */
      'html.theme-light .horizontal-panel { background: var(--bg-primary) !important; }' +
      /* Cards and panels */
      'html.theme-light .panel,' +
      'html.theme-light .f-panel,' +
      'html.theme-light .m-body,' +
      'html.theme-light .modal,' +
      'html.theme-light .vehicle-card,' +
      'html.theme-light .auction-card,' +
      'html.theme-light .lc-card,' +
      'html.theme-light .au-card,' +
      'html.theme-light .brand-list,' +
      'html.theme-light .lc-photo,' +
      'html.theme-light .au-photo,' +
      'html.theme-light .success-card {' +
      '  background-color: var(--bg-panel) !important;' +
      '  background: var(--bg-panel) !important;' +
      '  color: var(--text-primary) !important;' +
      '  border-color: var(--border-primary) !important;' +
      '  box-shadow: 0 4px 12px rgba(0,0,0,0.05) !important;' +
      '}' +
      /* WhatsApp button in card */
      'html.theme-light .lc-wa {' +
      '  color: #15803d !important;' +
      '  background: rgba(34, 197, 94, 0.1) !important;' +
      '  border-color: rgba(34, 197, 94, 0.3) !important;' +
      '}' +
      'html.theme-light .lc-wa:hover {' +
      '  color: #ffffff !important;' +
      '  background: #22c55e !important;' +
      '  border-color: #22c55e !important;' +
      '}' +
      'html.theme-light .lc-wa svg {' +
      '  fill: currentColor !important;' +
      '}' +
      /* Calculator result card background and items */
      'html.theme-light .calculator-result-card {' +
      '  background: #FFFFFF !important;' +
      '  border-color: rgba(15, 23, 42, 0.10) !important;' +
      '  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.05) !important;' +
      '}' +
      'html.theme-light .result-comparison-item {' +
      '  background: rgba(15, 23, 42, 0.02) !important;' +
      '  border-color: rgba(15, 23, 42, 0.06) !important;' +
      '}' +
      'html.theme-light .comparison-label {' +
      '  color: var(--text-muted) !important;' +
      '}' +
      /* Hero / Seq content floating panels and layout */
      'html.theme-light .seq-content .bg-black\\/30,' +
      'html.theme-light .seq-content .bg-black\\/40,' +
      'html.theme-light .seq-content .bg-white\\/10 {' +
      '  background: rgba(255, 255, 255, 0.85) !important;' +
      '  border-color: rgba(15, 23, 42, 0.15) !important;' +
      '  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.05) !important;' +
      '}' +
      'html.theme-light .seq-content p,' +
      'html.theme-light .seq-content span,' +
      'html.theme-light .seq-content h1,' +
      'html.theme-light .seq-content h2,' +
      'html.theme-light .seq-content strong {' +
      '  color: var(--text-title) !important;' +
      '  text-shadow: none !important;' +
      '}' +
      'html.theme-light .seq-content .bg-sky\\/80 {' +
      '  background: #1A4DB8 !important;' +
      '  color: #FFFFFF !important;' +
      '}' +
      'html.theme-light .seq-content .bg-gold\\/80 {' +
      '  background: #A07828 !important;' +
      '  color: #FFFFFF !important;' +
      '}' +
      'html.theme-light .seq-content .scroll-indicator svg {' +
      '  fill: var(--text-primary) !important;' +
      '  opacity: 0.8 !important;' +
      '}' +
      /* FAQ items */
      'html.theme-light .faq-item {' +
      '  background: rgba(255,255,255,0.9) !important;' +
      '  border-color: rgba(15,23,42,0.10) !important;' +
      '  box-shadow: 0 2px 8px rgba(0,0,0,0.05) !important;' +
      '}' +
      'html.theme-light .faq-trigger,' +
      'html.theme-light .faq-answer { color: var(--text-title) !important; }' +
      /* Blobs */
      'html.theme-light .success-blob { opacity: 0.3 !important; }' +
      /* Text */
      'html.theme-light .text-white { color: var(--text-title) !important; }' +
      'html.theme-light h1,html.theme-light h2,html.theme-light h3,' +
      'html.theme-light h4,html.theme-light h5,html.theme-light th,' +
      'html.theme-light strong { color: var(--text-title) !important; }' +
      /* Tailwind text-white opacity utility overrides */
      'html.theme-light .text-white\\/95,' +
      'html.theme-light .text-white\\/90,' +
      'html.theme-light .text-white\\/85,' +
      'html.theme-light .text-white\\/80 { color: var(--text-title) !important; }' +
      'html.theme-light .text-white\\/75,' +
      'html.theme-light .text-white\\/70,' +
      'html.theme-light .text-white\\/65,' +
      'html.theme-light .text-white\\/60,' +
      'html.theme-light .text-white\\/50 { color: var(--text-primary) !important; }' +
      'html.theme-light .text-white\\/40,' +
      'html.theme-light .text-white\\/30 { color: var(--text-muted) !important; }' +
      /* Gold & sky accent — keep but adapt to light */
      'html.theme-light .text-gold,[class*="text-gold"] { color: #9A7020 !important; }' +
      'html.theme-light .text-sky,[class*="text-sky"] { color: #1A4DB8 !important; }' +
      /* Spec/chips */
      'html.theme-light .lc-spec,html.theme-light .au-spec,' +
      'html.theme-light .spec-item,html.theme-light .f-chip {' +
      '  background-color: rgba(15,23,42,0.04) !important;' +
      '  border-color: rgba(15,23,42,0.08) !important;' +
      '  color: var(--text-primary) !important;' +
      '}' +
      'html.theme-light .spec-item p:first-child { color: var(--text-muted) !important; }' +
      'html.theme-light .spec-item p:last-child { color: var(--text-title) !important; }' +
      'html.theme-light .rep-row { border-color: rgba(15,23,42,0.06) !important; }' +
      'html.theme-light .rep-na { color: var(--text-muted) !important; }' +
      'html.theme-light .desc-body p,' +
      'html.theme-light .desc-body li { color: var(--text-primary) !important; }' +
      /* Inline text color overrides */
      'html.theme-light [style*="color:#C8D8F0"],' +
      'html.theme-light [style*="color: #C8D8F0"],' +
      'html.theme-light [style*="color:rgb(200,216,240)"],' +
      'html.theme-light [style*="color: rgb(200, 216, 240)"],' +
      'html.theme-light [style*="color:rgba(200,216,240"],' +
      'html.theme-light [style*="color: rgba(200, 216, 240"],' +
      'html.theme-light [style*="color:rgba(255,255,255"],' +
      'html.theme-light [style*="color: rgba(255, 255, 255"],' +
      'html.theme-light [style*="color:rgb(200,216,240"],' +
      'html.theme-light [style*="color:#fff"],' +
      'html.theme-light [style*="color:#FFF"],' +
      'html.theme-light [style*="color:#ffffff"],' +
      'html.theme-light [style*="color:#FFFFFF"] { color: var(--text-primary) !important; }' +
      /* Keep price and model year badge white inside photo container in Light Mode */
      'html.theme-light .lc-photo p.text-white,' +
      'html.theme-light .lc-photo span[style*="color:#fff"],' +
      'html.theme-light .lc-photo span[style*="color: #fff"],' +
      'html.theme-light .lc-photo [style*="color:#ffffff"],' +
      'html.theme-light .lc-photo [style*="color:#FFFFFF"],' +
      'html.theme-light .au-photo p.text-white,' +
      'html.theme-light .au-photo span[style*="color:#fff"],' +
      'html.theme-light .au-photo span[style*="color: #fff"],' +
      'html.theme-light .au-photo [style*="color:#ffffff"],' +
      'html.theme-light .au-photo [style*="color:#FFFFFF"] { color: #ffffff !important; }' +
      /* Ensure absolute white values on dark background of result comparison in simulator */
      'html.theme-light .calculator-result-card [style*="color:#C9A84C"] { color: #C9A84C !important; }' +
      'html.theme-light .calculator-result-card .line-through { color: rgba(15, 23, 42, 0.4) !important; }' +
      /* Inputs */
      'html.theme-light input,html.theme-light select,html.theme-light textarea,html.theme-light .fld {' +
      '  background-color: #FFFFFF !important;' +
      '  color: var(--text-title) !important;' +
      '  border-color: var(--border-primary) !important;' +
      '}' +
      'html.theme-light input::placeholder,html.theme-light textarea::placeholder { color: var(--text-muted) !important; }' +
      /* Dropdown menus */
      'html.theme-light .loc-menu {' +
      '  background: #FFFFFF !important;' +
      '  border-color: rgba(15,23,42,0.10) !important;' +
      '  box-shadow: 0 8px 30px rgba(0,0,0,0.10) !important;' +
      '}' +
      'html.theme-light .loc-opt { color: var(--text-primary) !important; }' +
      /* Mobile navbar */
      '@media (max-width:767px){' +
      '  html.theme-light .navbar-glass {' +
      '    background: var(--bg-navbar-mobile) !important;' +
      '    border-bottom: 1px solid var(--border-primary) !important;' +
      '  }' +
      '}' +
      /* Theme toggle button */
      '.loc-btn#theme-toggle {' +
      '  border: 1.5px solid var(--border-primary);' +
      '  border-radius: 9999px;' +
      '  cursor: pointer;' +
      '  font-size: 0.85rem;' +
      '  transition: all 0.2s ease;' +
      '  background: transparent;' +
      '  color: var(--text-primary);' +
      '}' +
      '.loc-btn#theme-toggle:hover { border-color: #C9A84C; color: #C9A84C; }';
    document.head.appendChild(st);
  }

  // ─── THEME TOGGLE BUTTON ──────────────────────────────────────
  function injectThemeToggle() {
    if (document.getElementById('theme-toggle')) return;
    var btn = document.createElement('button');
    btn.id = 'theme-toggle';
    btn.className = 'loc-btn';
    btn.style.padding = '0.35rem 0.6rem';
    btn.style.display = 'inline-flex';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
    btn.setAttribute('aria-label', 'Toggle Theme');

    function updateIcon() {
      var isLight = document.documentElement.classList.contains('theme-light');
      btn.innerHTML = isLight ? '\uD83C\uDF19' : '\u2600';
    }
    updateIcon();

    btn.addEventListener('click', function () {
      var isLight = document.documentElement.classList.toggle('theme-light');
      try { localStorage.setItem('theme', isLight ? 'light' : 'dark'); } catch (e) {}
      updateIcon();
    });

    var target = document.getElementById('locale-ctrl');
    if (target) {
      target.appendChild(btn);
    } else {
      var navDiv = document.querySelector('nav .flex.items-center.gap-3');
      if (navDiv) navDiv.insertBefore(btn, navDiv.firstChild);
    }
  }

  function boot() { apply(document.body); emit(); injectThemeToggle(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  window.I18N = {
    get lang() { return state.lang; },
    langs: LANGS,
    short: SHORT,
    set: set,
    t: t,
    apply: apply,
    onChange: function (fn) { listeners.push(fn); }
  };
})();
