export type WeightedParticipant = {
  id: string;
  weight: number;
};

export type CalculatedShare<T extends WeightedParticipant> = {
  participant: T;
  amount: bigint;
};

export function calculateWeightedShares<T extends WeightedParticipant>(
  total: bigint,
  participants: readonly T[],
): CalculatedShare<T>[] {
  if (total <= 0n) {
    throw new RangeError("Сумма продажи должна быть положительной.");
  }
  if (participants.length === 0) {
    throw new RangeError("В рейде нет присутствовавших участников для распределения.");
  }

  const ids = new Set<string>();
  let totalWeight = 0n;
  for (const participant of participants) {
    if (!Number.isSafeInteger(participant.weight) || participant.weight <= 0) {
      throw new RangeError("Вес участника должен быть положительным целым числом.");
    }
    if (!participant.id || ids.has(participant.id)) {
      throw new RangeError("Участники распределения должны иметь уникальные идентификаторы.");
    }
    ids.add(participant.id);
    totalWeight += BigInt(participant.weight);
  }

  const shares = participants.map((participant) => {
    const weightedAmount = total * BigInt(participant.weight);
    return {
      participant,
      amount: weightedAmount / totalWeight,
      remainder: weightedAmount % totalWeight,
    };
  });
  let remaining = total - shares.reduce((sum, share) => sum + share.amount, 0n);
  const remainderOrder = [...shares].sort((left, right) => {
    if (left.remainder > right.remainder) return -1;
    if (left.remainder < right.remainder) return 1;
    if (left.participant.id < right.participant.id) return -1;
    if (left.participant.id > right.participant.id) return 1;
    return 0;
  });

  for (const share of remainderOrder) {
    if (remaining === 0n) break;
    share.amount += 1n;
    remaining -= 1n;
  }
  if (remaining !== 0n) {
    throw new Error("Не удалось распределить всю сумму продажи.");
  }

  return shares
    .map(({ participant, amount }) => ({ participant, amount }))
    .sort((left, right) => {
      if (left.participant.id < right.participant.id) return -1;
      if (left.participant.id > right.participant.id) return 1;
      return 0;
    });
}
