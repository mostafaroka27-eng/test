import test from 'node:test';
import assert from 'node:assert/strict';
import {t, getLanguage, applyLanguage} from './i18n.mjs';

test('Arabic engineering labels and parameterized messages have English fallbacks', () => {
  assert.equal(t('Panel thickness', {}, 'ar'), 'سماكة اللوح');
  assert.equal(t('bay', {number: 3}, 'ar'), 'الحجرة 3');
  assert.equal(t('bay', {number: 3}, 'en'), 'Bay 3');
  assert.equal(t('partsSummary', {parts: 12, area: 4.5, edge: 8}, 'ar'), '12 جزء · 4.5 م² · 8 م حواف');
  assert.equal(t('CAB-001'), 'CAB-001');
  assert.equal(getLanguage(), 'en');
});

test('unsupported locale is rejected before touching the document', () => {
  assert.throws(() => applyLanguage('fr', {}), /Unsupported/);
});

test('planning, grain and cost controls have distinct Arabic labels and stable English labels', () => {
  const labels = {
    'Room plan':'مخطط الغرفة', 'Stock grain axis':'محور عروق اللوح الخام',
    'Legacy Alpha layout':'توزيع النسخ السابقة', 'Kitchen layout':'تخطيط المطبخ',
    'Reference unit':'الوحدة المرجعية', 'Snap to grid':'محاذاة مع الشبكة',
    'Cost estimate':'تقدير التكلفة', 'Price / m²':'السعر / م²',
    'Production cost':'تكلفة الإنتاج', 'Profit margin %':'هامش الربح %',
    'Professional references':'المراجع المهنية',
  };
  for (const [label,arabic] of Object.entries(labels)) {
    assert.equal(t(label,{},'ar'),arabic);
    assert.equal(t(label,{},'en'),label);
  }
  assert.equal(t('CUSTOM MATERIAL NAME',{},'ar'),'CUSTOM MATERIAL NAME');
  assert.equal(t('السعر / م²',{},'en'),'Price / m²');
});
