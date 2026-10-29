import { describe, expect, it } from 'vitest';
import { Money } from '@kliks/shared';
import {
  createPayment,
  InvalidPaymentTransitionError,
  PaymentState,
  transitionPayment,
} from '../src/modules/payments/domain/payment';

const payment = () =>
  createPayment({
    id: 'payment-internal-1',
    payerId: 'user-internal-1',
    payeeId: 'user-internal-2',
    amount: Money.fromMinor(2000, 'EUR'),
  });

describe('payment state transitions', () => {
  it.each([
    [PaymentState.Created, PaymentState.RequiresAuthorization],
    [PaymentState.Created, PaymentState.Cancelled],
    [PaymentState.RequiresAuthorization, PaymentState.Processing],
    [PaymentState.RequiresAuthorization, PaymentState.Rejected],
    [PaymentState.RequiresAuthorization, PaymentState.Cancelled],
    [PaymentState.Processing, PaymentState.Succeeded],
    [PaymentState.Processing, PaymentState.Failed],
  ])('allows %s -> %s', (initialState, nextState) => {
    const initial = { ...payment(), state: initialState };
    expect(transitionPayment(initial, nextState).state).toBe(nextState);
  });

  it.each([
    [PaymentState.Created, PaymentState.Succeeded],
    [PaymentState.Succeeded, PaymentState.Processing],
    [PaymentState.Failed, PaymentState.Succeeded],
    [PaymentState.Rejected, PaymentState.Processing],
    [PaymentState.Cancelled, PaymentState.Processing],
  ])('rejects %s -> %s', (initialState, nextState) => {
    const initial = { ...payment(), state: initialState };
    expect(() => transitionPayment(initial, nextState)).toThrow(InvalidPaymentTransitionError);
    expect(initial.state).toBe(initialState);
  });

  it.each([PaymentState.Succeeded, PaymentState.Rejected, PaymentState.Failed, PaymentState.Cancelled])(
    'treats %s as terminal',
    (terminalState) => {
      const initial = { ...payment(), state: terminalState };
      for (const nextState of Object.values(PaymentState)) {
        expect(() => transitionPayment(initial, nextState)).toThrow(InvalidPaymentTransitionError);
      }
    },
  );

  it('requires a positive amount', () => {
    expect(() =>
      createPayment({
        id: 'payment-internal-1',
        payerId: 'user-internal-1',
        payeeId: 'user-internal-2',
        amount: Money.fromMinor(0, 'EUR'),
      }),
    ).toThrow('greater than zero');
  });
});