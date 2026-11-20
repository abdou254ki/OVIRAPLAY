# 🚀 OVIRA PLAY — منصة الاشتراكات الرقمية الذكية

> **المتجر الرقمي الرائد للاشتراكات والخدمات الرقمية بالدينار الجزائري (RTL)**  
> **الإصدار الحالي:** 1.0.0 (Foundation Hardened)  
> **البنية التقنية:** Vanilla JS (SPA) + Express / Node.js + MongoDB Atlas + Telegram Bot

---

## 📋 نظرة عامة

**OVIRA PLAY** منصة تجارة إلكترونية متخصصة في بيع وتوزيع الاشتراكات الرقمية (Netflix, Spotify, ChatGPT Plus, YouTube Premium, إلخ) بطريقة مؤتمتة وآمنة، مصممة بالكامل لتوفير تجربة مستخدم عربية سلسة (RTL) مع خيارات دفع محلية (BaridiMob, CCP) وعالمية (Chargily Pay)، بالإضافة إلى لوحة تحكم إدارية متقدمة ونظام أتمتة عبر بوت Telegram.

---

## 🏗️ هيكلية المشروع (Project Architecture)

```
OVIRA-LOCAL-DEV/
├── OVIRAPLAY-main/                  # 🖥️ واجهة المستخدم ولوحة التحكم (Frontend SPA)
│   ├── index.html                   # نقطة الدخول الرئيسية للمتجر
│   ├── admin.html                   # نقطة الدخول للوحة الإدارة
│   ├── app.js                       # منطق المتجر والزبائن (Router, State, Views)
│   ├── admin.js                     # منطق لوحة الإدارة
│   ├── ovira-core.css               # معمارية التصميم الأساسية (Design Tokens + V4 Constitution)
│   ├── ovira-experience.css         # طبقة التجربة البصرية المتقدمة والخطوط المحلية
│   ├── style.css                    # أنماط ومكونات المتجر الكلاسيكية
│   ├── admin.css                    # أنماط لوحة الإدارة
│   ├── sw.js / pwa.js               # Service Worker ودعم تطبيقات الويب التقدمية (PWA)
│   ├── assets/                      # الخطوط المحلية (Noto Sans Arabic) والأيقونات والشعارات
│   ├── admin/                       # مكونات وأقسام لوحة الإدارة المساعدة
│   └── shared/                      # الجسور المشتركة للمتغيرات (ovira-tokens.css)
│
├── ovira-api-main/                  # ⚙️ خادم الواجهة الخلفية (Backend API)
│   ├── server.js                    # نقطة الانطلاق الأساسية وإعدادات Express
│   ├── local-dev.js                 # سكريبت التشغيل المحلي مع مراقبة البيئة
│   ├── routes/                      # 15 ملف مسارات API مقسمة وظيفياً
│   │   ├── orders.js                # معالجة الطلبات والكتالوج وبوابة Chargily
│   │   ├── admin.js                 # عمليات لوحة الإدارة والمصادقة
│   │   ├── account.js               # حسابات الزبائن، 2FA، والملف الشخصي
│   │   ├── conversations.js         # محادثات الدعم المباشر
│   │   ├── aiControl.js             # التحكم في خدمات ووكلاء الذكاء الاصطناعي
│   │   └── ...                      # مسارات الإشعارات، المالية، والأمان
│   ├── models/                      # 25 نموذج Mongoose (Order, Product, Customer, Stock...)
│   ├── services/                    # 22 ملف خدمات للأعمال (Stock, Renewal, Backup, Chargily...)
│   ├── bot/                         # بوت Telegram الإداري التفاعلي (telegram.js)
│   └── tests/                       # اختبارات الأمان والتعاقدات (Contract & Security Tests)
│
├── .editorconfig                    # توحيد تنسيق الكود والمسافات
├── eslint.config.js                 # قواعد فحص الجودة (ESLint 9+ Flat Config)
├── .gitignore                       # استبعاد الملفات الحساسة والمخرجات المؤقتة
├── README.md                        # هذا الملف
├── API-DOCS.md                      # التوثيق الشامل لجميع مسارات الـ API
└── ROLES.md                         # تفصيل نظام الأدوار والصلاحيات (RBAC)
```

---

## ⚡ متطلبات التشغيل (Prerequisites)

- **Node.js**: إصدار `18.0.0` أو أحدث.
- **npm**: إصدار `9.0.0` أو أحدث.
- **قاعدة بيانات MongoDB**: حساب محلي أو عنقود سحابي في MongoDB Atlas.
- **متصفح حديث**: Chrome, Edge, Safari أو Firefox.

---

## 🛠️ التثبيت والتشغيل المحلي (Local Setup)

### 1. إعداد الخادم الخلفي (Backend API)

```bash
# الانتقال لمجلد الواجهة الخلفية
cd d:/WebStudio/OVIRA-LOCAL-DEV/ovira-api-main

# تثبيت الحزم البرمجية
npm install

# تشغيل الخادم في وضع التطوير المحلي
node local-dev.js
```
> الخادم سيعمل افتراضياً على: `http://127.0.0.1:5001`  
> يمكنك التأكد من عمل الخادم عبر: `http://127.0.0.1:5001/health`

### 2. تشغيل الواجهة الأمامية (Frontend)

لا تحتاج الواجهة إلى أدوات بناء معقدة؛ تم بناؤها بـ Vanilla JS نقية:
- يمكنك فتح `OVIRAPLAY-main/index.html` مباشرة في المتصفح.
- أو استخدام خادم محلي خفيف مثل `live-server` أو إضافة VS Code Live Server على المنفذ `5511`:
  ```bash
  cd d:/WebStudio/OVIRA-LOCAL-DEV/OVIRAPLAY-main
  npx serve -l 5511 .
  ```
- للدخول إلى لوحة الإدارة: تصفح `http://127.0.0.1:5511/admin.html`

---

## 🔑 المتغيرات البيئية (`.env` Template)

يجب توفير ملف `.env` داخل مجلد `ovira-api-main/` بالهيكل التالي:

```ini
# المنفذ وبيئة التشغيل
PORT=5001
NODE_ENV=development
PUBLIC_URL=http://127.0.0.1:5001

# قاعدة البيانات
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/ovira?retryWrites=true&w=majority

# الأمان والجلسات (يجب أن يكون السر أطول من 32 محرفاً)
JWT_SECRET=your_super_secret_jwt_key_minimum_32_characters_long
SESSION_SECRET=your_optional_session_secret_key

# حساب المدير الافتراضي
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD_HASH=$2a$10$...your_bcrypt_hash...

# بوت Telegram
TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRstuVWXyz
TELEGRAM_WEBHOOK_SECRET=your_telegram_webhook_secret_token
TELEGRAM_OWNER_ID=123456789

# بوابات الدفع (Chargily Pay V2)
CHARGILY_APP_KEY=test_api_key_...
CHARGILY_SECRET_KEY=test_secret_key_...
CHARGILY_MODE=test

# إعدادات CORS المسموحة
CORS_ORIGINS=http://127.0.0.1:5511,http://localhost:5511
```

---

## 🛡️ الأمان ونظام الأدوار (Security & RBAC)

المشروع مزود بمنظومة أمان عالية:
1. **المصادقة الثنائية (2FA)**: تدعم رموز TOTP (تطبيقات Google Authenticator وغيرها) أو رموز OTP الفورية عبر Telegram.
2. **عزل الصلاحيات (RBAC)**:
   - `owner`: صلاحيات مطلقة لإدارة النظام، الأسرار، الحذف، والتقارير المالية.
   - `staff`: إدارة الطلبات، المنتجات، والزبائن، وإرسال بيانات التسليم.
   - `viewer`: استعراض البيانات والإحصائيات دون أي إمكانية للتعديل أو الحذف.
3. **حماية الشبكة**: معدلات طلب مقيدة (`express-rate-limit`)، حماية الرؤوس (`helmet`)، وفحص النطاقات المقيدة (`CORS`).
4. **سجل التدقيق (Audit Log)**: تتبع العمليات الإدارية الحساسة وتسجيل التعديلات.

> 📖 للمزيد من التفاصيل، راجع دليل الصلاحيات: [ROLES.md](file:///d:/WebStudio/OVIRA-LOCAL-DEV/ROLES.md).

---

## 🌐 النشر في الإنتاج (Production Deployment)

| الجزء | المنصة | الرابط / الإعداد |
| :--- | :--- | :--- |
| **Frontend** | GitHub Pages / Custom Domain | مُستضاف كـ Static SPA مع التوجيه عبر الـ Hash |
| **Backend** | Render Cloud Application | Web Service (Node.js 18) متصل بـ MongoDB Atlas |
| **Database** | MongoDB Atlas | Cluster مؤمن مع نسخ احتياطي وتشفير أثناء النقل |
| **Telegram Bot** | Render Webhook | يستقبل التحديثات مباشرة من خوادم Telegram |

---

## 📑 مراجع ومستندات إضافية

- [خطة التطوير الشاملة (Master Plan)](file:///d:/WebStudio/MASTER_DEVELOPMENT_PLAN.md)
- [دليل الـ API الكامل (API Documentation)](file:///d:/WebStudio/OVIRA-LOCAL-DEV/API-DOCS.md)
- [معمارية الصلاحيات والأدوار (ROLES.md)](file:///d:/WebStudio/OVIRA-LOCAL-DEV/ROLES.md)
- [خارطة إعادة التصميم (Design Roadmap)](file:///d:/WebStudio/OVIRA-LOCAL-DEV/OVIRA-REDESIGN-ROADMAP-AR.md)
