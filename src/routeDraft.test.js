import { normalizeRouteDraft } from './routeDraft';

describe('normalizeRouteDraft', () => {
  test('requires core fields', () => {
    const result = normalizeRouteDraft({}, []);
    expect(result.ok).toBe(false);
    expect(result.errors.some((message) => /route number/i.test(message))).toBe(true);
    expect(result.errors.some((message) => /stop id/i.test(message))).toBe(true);
  });

  test('creates uppercase route row with next ID', () => {
    const existing = [{ id: 10, route: '54' }];
    const result = normalizeRouteDraft(
      {
        route: ' n68 ',
        stop_id: 'ABCD123',
        bound: 'inbound',
        service_type: 2,
        stopName: 'Test Stop',
        destination: 'Mong Kok',
        routeName: 'N68 display',
      },
      existing
    );

    expect(result.ok).toBe(true);
    expect(result.route.route).toBe('N68');
    expect(result.route.stop_id).toBe('ABCD123');
    expect(result.route.bound).toBe('inbound');
    expect(result.route.service_type).toBe(2);
    expect(result.route.destination).toBe('Mong Kok');
    expect(result.route.id).toBe(11);
  });

  test('defaults invalid service type to 1', () => {
    const result = normalizeRouteDraft(
      {
        route: '64K',
        stop_id: 'S1',
        stopName: 'A',
        destination: 'B',
        routeName: 'C',
        service_type: 'not-a-number',
      },
      []
    );

    expect(result.ok).toBe(true);
    expect(result.route.service_type).toBe(1);
  });

  test('treats unknown bound values as outbound', () => {
    const result = normalizeRouteDraft(
      {
        route: '1',
        stop_id: 'S1',
        stopName: 'A',
        destination: 'B',
        routeName: 'C',
        bound: 'sideways',
      },
      []
    );

    expect(result.ok).toBe(true);
    expect(result.route.bound).toBe('outbound');
  });
});
