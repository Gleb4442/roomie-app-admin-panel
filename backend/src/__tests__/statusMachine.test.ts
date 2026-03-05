/**
 * Tests for statusMachine.ts
 * Validates state transitions and role-based action availability.
 */

import { validateTransition, getValidNextStatuses, getAvailableActions } from '../modules/task/statusMachine';

// ── validateTransition ──────────────────────────────────────

describe('validateTransition', () => {
  describe('INTERNAL tasks', () => {
    it('должен разрешить переход NEW → ASSIGNED', () => {
      expect(validateTransition('INTERNAL', 'NEW', 'ASSIGNED')).toBe(true);
    });

    it('должен разрешить переход NEW → CANCELLED', () => {
      expect(validateTransition('INTERNAL', 'NEW', 'CANCELLED')).toBe(true);
    });

    it('должен запретить переход NEW → COMPLETED (прыжок через статусы)', () => {
      expect(validateTransition('INTERNAL', 'NEW', 'COMPLETED')).toBe(false);
    });

    it('должен разрешить переход ASSIGNED → ACCEPTED', () => {
      expect(validateTransition('INTERNAL', 'ASSIGNED', 'ACCEPTED')).toBe(true);
    });

    it('должен разрешить переход ASSIGNED → IN_PROGRESS (skip accept)', () => {
      expect(validateTransition('INTERNAL', 'ASSIGNED', 'IN_PROGRESS')).toBe(true);
    });

    it('должен разрешить переход IN_PROGRESS → ON_HOLD', () => {
      expect(validateTransition('INTERNAL', 'IN_PROGRESS', 'ON_HOLD')).toBe(true);
    });

    it('должен разрешить переход ON_HOLD → IN_PROGRESS (resume)', () => {
      expect(validateTransition('INTERNAL', 'ON_HOLD', 'IN_PROGRESS')).toBe(true);
    });

    it('должен разрешить переход COMPLETED → INSPECTED', () => {
      expect(validateTransition('INTERNAL', 'COMPLETED', 'INSPECTED')).toBe(true);
    });

    it('должен разрешить переход COMPLETED → IN_PROGRESS (reopen)', () => {
      expect(validateTransition('INTERNAL', 'COMPLETED', 'IN_PROGRESS')).toBe(true);
    });

    it('должен запретить переход из CLOSED', () => {
      expect(validateTransition('INTERNAL', 'CLOSED', 'NEW')).toBe(false);
      expect(validateTransition('INTERNAL', 'CLOSED', 'IN_PROGRESS')).toBe(false);
    });

    it('должен запретить переход из CANCELLED', () => {
      expect(validateTransition('INTERNAL', 'CANCELLED', 'NEW')).toBe(false);
    });

    it('должен разрешить ESCALATED → ASSIGNED', () => {
      expect(validateTransition('INTERNAL', 'ESCALATED', 'ASSIGNED')).toBe(true);
    });

    it('должен вернуть false для несуществующего fromStatus', () => {
      expect(validateTransition('INTERNAL', 'NONEXISTENT', 'ASSIGNED')).toBe(false);
    });
  });

  describe('SERVICE_REQUEST tasks', () => {
    it('должен разрешить переход NEW → ASSIGNED', () => {
      expect(validateTransition('SERVICE_REQUEST', 'NEW', 'ASSIGNED')).toBe(true);
    });

    it('должен разрешить переход IN_PROGRESS → ON_HOLD', () => {
      expect(validateTransition('SERVICE_REQUEST', 'IN_PROGRESS', 'ON_HOLD')).toBe(true);
    });

    it('должен разрешить COMPLETED → CLOSED (без INSPECTED)', () => {
      expect(validateTransition('SERVICE_REQUEST', 'COMPLETED', 'CLOSED')).toBe(true);
    });

    it('должен запретить COMPLETED → INSPECTED (только для INTERNAL)', () => {
      expect(validateTransition('SERVICE_REQUEST', 'COMPLETED', 'INSPECTED')).toBe(false);
    });
  });

  describe('ORDER tasks', () => {
    it('должен разрешить ASSIGNED → ACCEPTED', () => {
      expect(validateTransition('ORDER', 'ASSIGNED', 'ACCEPTED')).toBe(true);
    });

    it('должен запретить IN_PROGRESS → ON_HOLD (нет паузы для заказов)', () => {
      expect(validateTransition('ORDER', 'IN_PROGRESS', 'ON_HOLD')).toBe(false);
    });

    it('должен запретить ASSIGNED → ESCALATED (нет эскалации для заказов)', () => {
      expect(validateTransition('ORDER', 'ASSIGNED', 'ESCALATED')).toBe(false);
    });

    it('должен разрешить IN_PROGRESS → COMPLETED', () => {
      expect(validateTransition('ORDER', 'IN_PROGRESS', 'COMPLETED')).toBe(true);
    });
  });
});

// ── getValidNextStatuses ────────────────────────────────────

describe('getValidNextStatuses', () => {
  it('должен вернуть [ASSIGNED, CANCELLED] для INTERNAL NEW', () => {
    const statuses = getValidNextStatuses('INTERNAL', 'NEW');
    expect(statuses).toContain('ASSIGNED');
    expect(statuses).toContain('CANCELLED');
    expect(statuses).toHaveLength(2);
  });

  it('должен вернуть пустой массив для CLOSED', () => {
    expect(getValidNextStatuses('INTERNAL', 'CLOSED')).toEqual([]);
  });

  it('должен вернуть пустой массив для несуществующего статуса', () => {
    expect(getValidNextStatuses('INTERNAL', 'NONEXISTENT')).toEqual([]);
  });

  it('должен вернуть разные списки для ORDER и INTERNAL при IN_PROGRESS', () => {
    const orderNext = getValidNextStatuses('ORDER', 'IN_PROGRESS');
    const internalNext = getValidNextStatuses('INTERNAL', 'IN_PROGRESS');

    // ORDER: нет ON_HOLD
    expect(orderNext).not.toContain('ON_HOLD');
    // INTERNAL: есть ON_HOLD
    expect(internalNext).toContain('ON_HOLD');
  });
});

// ── getAvailableActions ─────────────────────────────────────

describe('getAvailableActions', () => {
  it('должен вернуть accept и decline для LINE_STAFF-assignee на ASSIGNED', () => {
    const actions = getAvailableActions('INTERNAL', 'ASSIGNED', 'LINE_STAFF' as any, true);
    expect(actions).toContain('accept');
    expect(actions).toContain('decline');
    expect(actions).toContain('start');
    expect(actions).toContain('escalate');
  });

  it('должен запретить accept для LINE_STAFF-не-assignee на ASSIGNED', () => {
    const actions = getAvailableActions('INTERNAL', 'ASSIGNED', 'LINE_STAFF' as any, false);
    expect(actions).not.toContain('accept');
    expect(actions).not.toContain('decline');
    // Escalate доступен всем
    expect(actions).toContain('escalate');
  });

  it('должен разрешить reassign для SUPERVISOR на ESCALATED', () => {
    const actions = getAvailableActions('INTERNAL', 'ESCALATED', 'SUPERVISOR' as any, false);
    expect(actions).toContain('reassign');
  });

  it('должен запретить reassign для LINE_STAFF', () => {
    const actions = getAvailableActions('INTERNAL', 'ESCALATED', 'LINE_STAFF' as any, false);
    expect(actions).not.toContain('reassign');
  });

  it('должен разрешить inspect для SUPERVISOR на COMPLETED INTERNAL', () => {
    const actions = getAvailableActions('INTERNAL', 'COMPLETED', 'SUPERVISOR' as any, false);
    expect(actions).toContain('inspect');
  });

  it('должен запретить inspect для ORDER COMPLETED (нет INSPECTED в transitions)', () => {
    const actions = getAvailableActions('ORDER', 'COMPLETED', 'SUPERVISOR' as any, false);
    // ORDER COMPLETED → CLOSED only, no INSPECTED transition
    expect(actions).not.toContain('inspect');
  });

  it('должен разрешить close для SUPERVISOR на INSPECTED', () => {
    const actions = getAvailableActions('INTERNAL', 'INSPECTED', 'SUPERVISOR' as any, false);
    expect(actions).toContain('close');
  });

  it('должен запретить close для LINE_STAFF', () => {
    const actions = getAvailableActions('INTERNAL', 'INSPECTED', 'LINE_STAFF' as any, false);
    expect(actions).not.toContain('close');
  });

  it('должен вернуть пустой массив для CLOSED', () => {
    const actions = getAvailableActions('INTERNAL', 'CLOSED', 'SUPERVISOR' as any, true);
    expect(actions).toEqual([]);
  });

  it('должен вернуть пустой массив для неизвестного статуса', () => {
    const actions = getAvailableActions('INTERNAL', 'UNKNOWN', 'LINE_STAFF' as any, true);
    expect(actions).toEqual([]);
  });

  it('должен разрешить pause для assignee на IN_PROGRESS INTERNAL', () => {
    const actions = getAvailableActions('INTERNAL', 'IN_PROGRESS', 'LINE_STAFF' as any, true);
    expect(actions).toContain('pause');
    expect(actions).toContain('complete');
  });

  it('должен запретить pause для ORDER IN_PROGRESS (нет ON_HOLD)', () => {
    const actions = getAvailableActions('ORDER', 'IN_PROGRESS', 'LINE_STAFF' as any, true);
    expect(actions).not.toContain('pause');
  });
});
