import type { Money } from '@kliks/shared';

export enum PaymentState {
  Created = 'CREATED',
  RequiresAuthorization = 'REQUIRES_AUTHORIZATION',
  Processing = 'PROCESSING',
  Succeeded = 'SUCCEEDED',
  Rejected = 'REJECTED',
  Failed = 'FAILED',
  Cancelled = 'CANCELLED',
}

export interface Payment {
  readonly id: string;
  readonly payerId: string;
  readonly payeeId: string;
  readonly amount: Money;
  readonly state: PaymentState;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface NewPayment {
  id: string;
  payerId: string;
  payeeId: string;
  amount: Money;
}

const allowedTransitions: Readonly<Record<PaymentState, readonly PaymentState[]>> = {
  [PaymentState.Created]: [PaymentState.RequiresAuthorization, PaymentState.Cancelled],
  [PaymentState.RequiresAuthorization]: [
    PaymentState.Processing,
    PaymentState.Rejected,
    PaymentState.Cancelled,
  ],
  [PaymentState.Processing]: [PaymentState.Succeeded, PaymentState.Failed],
  [PaymentState.Succeeded]: [],
  [PaymentState.Rejected]: [],
  [PaymentState.Failed]: [],
  [PaymentState.Cancelled]: [],
};

export class InvalidPaymentTransitionError extends Error {
  constructor(from: PaymentState, to: PaymentState) {
    super(`Payment cannot transition from ${from} to ${to}.`);
    this.name = 'InvalidPaymentTransitionError';
  }
}

export function createPayment(input: NewPayment, now = new Date()): Payment {
  if (!input.id.trim() || !input.payerId.trim() || !input.payeeId.trim()) {
    throw new RangeError('Payment and participant IDs must not be empty.');
  }
  if (input.amount.amountMinor <= 0) {
    throw new RangeError('Payment amount must be greater than zero.');
  }

  return {
    ...input,
    state: PaymentState.Created,
    createdAt: now,
    updatedAt: now,
  };
}

export function transitionPayment(payment: Payment, nextState: PaymentState, now = new Date()): Payment {
  if (!allowedTransitions[payment.state].includes(nextState)) {
    throw new InvalidPaymentTransitionError(payment.state, nextState);
  }

  return { ...payment, state: nextState, updatedAt: now };
}