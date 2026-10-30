export type SplitMode = 'EQUAL' | 'CUSTOM';
export interface SplitParticipant {
  userId: string;
  amountMinor?: number;
}
export interface SplitAllocation {
  userId: string;
  amountMinor: number;
}

export function allocateSplitBill(
  totalMinor: number,
  mode: SplitMode,
  participants: readonly SplitParticipant[],
): SplitAllocation[] {
  if (!Number.isSafeInteger(totalMinor) || totalMinor <= 0)
    throw new RangeError('Bill total must be a positive safe integer.');
  if (participants.length < 2 || participants.length > 20)
    throw new RangeError('A bill needs 2 to 20 participants, including the creator.');
  if (
    participants.some((entry) => !entry.userId) ||
    new Set(participants.map((entry) => entry.userId)).size !== participants.length
  )
    throw new RangeError('Choose distinct participants.');
  if (mode === 'EQUAL') {
    if (participants.some((entry) => entry.amountMinor !== undefined))
      throw new RangeError('Equal splits do not accept custom shares.');
    const total = BigInt(totalMinor);
    const count = BigInt(participants.length);
    const base = total / count;
    const remainder = total % count;
    if (base < 1n) throw new RangeError('Every participant must have at least one cent.');
    return participants.map((entry, index) => ({
      userId: entry.userId,
      amountMinor: Number(base + (BigInt(index) < remainder ? 1n : 0n)),
    }));
  }
  if (mode !== 'CUSTOM') throw new RangeError('Choose an equal or custom split.');
  let total = 0n;
  const allocations = participants.map((entry) => {
    if (
      !Number.isSafeInteger(entry.amountMinor) ||
      entry.amountMinor === undefined ||
      entry.amountMinor <= 0
    )
      throw new RangeError('Every custom share must be a positive safe integer.');
    total += BigInt(entry.amountMinor);
    return { userId: entry.userId, amountMinor: entry.amountMinor };
  });
  if (total !== BigInt(totalMinor))
    throw new RangeError('Custom shares must add up exactly to the bill total.');
  return allocations;
}
