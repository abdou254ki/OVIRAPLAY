// يضمن سلامة فهارس مجموعة customers دون لمس أي بيانات أو حسابات.
// المشكلة التي يعالجها: فهرس فريد قديم (phone_1 / googleId_1) أُنشئ بدون sparse/partial،
// فيرفض MongoDB (E11000) أي حساب ثانٍ بلا رقم هاتف — وهذا ما يحدث عند الدخول بـ Google أو Telegram.
// Mongoose لا يستطيع تعديل فهرس موجود، لذلك نستبدله هنا يدويًا وبأمان.
const Customer = require('../models/Customer');

const WANTED = [
  { key: { phone: 1 }, unique: true, partial: { phone: { $gt: '' } } },
  { key: { googleId: 1 }, unique: true, partial: { googleId: { $gt: '' } } },
  { key: { email: 1 } },
  { key: { telegramChatId: 1 } },
  { key: { blocked: 1 } },
  { key: { linkCode: 1 } }
];

const sameKey = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// الفهرس الفريد مقبول فقط إذا كان يتجاهل القيم المفقودة (sparse أو partial)
const uniqueIsSafe = (idx) => !!(idx.sparse || idx.partialFilterExpression);

function specOf(idx) {
  const { key, name, v, ns, ...opts } = idx; // eslint-disable-line no-unused-vars
  return { key, name, opts };
}

async function ensureCustomerIndexes() {
  const report = [];
  try {
    let existing = [];
    try {
      existing = await Customer.collection.indexes();
    } catch (e) {
      if (e.codeName !== 'NamespaceNotFound' && e.code !== 26) throw e;
    }

    for (const want of WANTED) {
      const field = Object.keys(want.key)[0];
      const found = existing.find((i) => sameKey(i.key, want.key));
      const wantUnique = !!want.unique;

      if (found) {
        const ok = wantUnique ? (found.unique && uniqueIsSafe(found)) : !found.unique;
        if (ok) { report.push(`${field}: ok`); continue; }

        // فهرس موجود لكنه غير سليم → استبداله، مع استرجاع القديم إن فشل الإنشاء.
        const old = specOf(found);
        try {
          await Customer.collection.dropIndex(found.name);
          await Customer.collection.createIndex(want.key, wantUnique
            ? { name: found.name, unique: true, partialFilterExpression: want.partial }
            : { name: found.name });
          report.push(`${field}: replaced`);
        } catch (e) {
          console.error(`[indexes] تعذّر استبدال فهرس ${field}:`, e.message);
          try { await Customer.collection.createIndex(old.key, { name: old.name, ...old.opts }); } catch (e2) {
            console.error(`[indexes] تعذّر استرجاع فهرس ${field} القديم:`, e2.message);
          }
          report.push(`${field}: FAILED`);
        }
      } else {
        try {
          await Customer.collection.createIndex(want.key, wantUnique
            ? { unique: true, partialFilterExpression: want.partial }
            : {});
          report.push(`${field}: created`);
        } catch (e) {
          console.error(`[indexes] تعذّر إنشاء فهرس ${field}:`, e.message);
          report.push(`${field}: FAILED`);
        }
      }
    }
  } catch (e) {
    console.error('[indexes] فحص فهارس customers فشل:', e.message);
  }
  console.log('[indexes] customers →', report.join(' | '));
  return report;
}

module.exports = { ensureCustomerIndexes };
