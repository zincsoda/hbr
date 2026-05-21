import { normalizeRouteDraft } from './routeDraft';

/** Legacy named test module; fuller coverage lives alongside in `routeDraft.test.js`. */
test('normalizeRouteDraft export remains available', () => {
  expect(typeof normalizeRouteDraft).toBe('function');
});
