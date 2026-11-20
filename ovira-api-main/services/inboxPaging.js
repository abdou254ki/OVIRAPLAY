'use strict';
// Opaque cursor with strict bounds; no authentication decisions depend on cursor contents.
const isId = value => typeof value === 'string' && /^[0-9a-f]{24}$/i.test(value);
const MAX_PAGE = 50;
function boundedLimit(value, fallback = 30) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? Math.min(MAX_PAGE, n) : fallback;
}
function encodeCursor(row, dateField = 'lastMessageAt') {
  const date = new Date(row[dateField]);
  const id = String(row._id || '');
  if (!Number.isFinite(date.getTime()) || !isId(id)) return null;
  return Buffer.from(JSON.stringify([date.toISOString(), id]),'utf8').toString('base64url');
}
function decodeCursor(text) {
  if (typeof text !== 'string' || text.length < 30 || text.length > 160 || !/^[A-Za-z0-9_-]+$/.test(text)) return null;
  try {
    const values = JSON.parse(Buffer.from(text,'base64url').toString('utf8'));
    if (!Array.isArray(values) || values.length !== 2 || typeof values[0] !== 'string' ||
        !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(values[0]) ||
        !isId(values[1])) return null;
    const date = new Date(values[0]);
    if (!Number.isFinite(date.getTime())) return null;
    return {date,id: values[1]};
  } catch (_) {return null;}
}
function olderThan(cursor, field) {
  return {$or:[{[field]:{$lt:cursor.date}},{[field]:cursor.date,_id:{$lt:cursor.id}}]};
}
function escapedSearch(text) {
  if (typeof text !== 'string') return '';
  return text.trim().slice(0,60).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
}
module.exports={boundedLimit,encodeCursor,decodeCursor,olderThan,escapedSearch};
