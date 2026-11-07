"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { AdenaAmount } from "@/components/ui/adena-amount";
import { PaymentForm } from "@/features/sales/payment-form";

type Row = { memberId: string; nickname: string; isActive: boolean; payable: string };

export function PayoutList({
  members,
  partyCash,
  totalOutstanding,
  canManage,
}: {
  members: Row[];
  partyCash: string;
  totalOutstanding: string;
  canManage: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const visible = (member: Row) =>
    member.nickname.toLocaleLowerCase().includes(query.toLocaleLowerCase()) &&
    (filter === "all" ||
      (filter === "payable" ? BigInt(member.payable) > 0n : BigInt(member.payable) < 0n));
  const count = members.filter(visible).length;
  return (
    <section>
      <div className="toolbar">
        <Input
          aria-label="Поиск получателя"
          placeholder="Ник участника"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Остатки участников"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="all">Все остатки</option>
          <option value="payable">К выплате</option>
          <option value="overpaid">Переплаты</option>
        </select>
      </div>
      <p className="mb-3 text-xs text-muted-foreground" role="status">
        Участников: {count} из {members.length}
      </p>
      {count === 0 && (
        <p className="empty-state">
          {members.length
            ? "Участников по этим условиям нет."
            : "После первой продажи здесь появятся начисленные доли."}
        </p>
      )}
      <ul className="data-list">
        {members.map((member) => (
          <li key={member.memberId} hidden={!visible(member)}>
            <div className="list-row">
              <div>
                <p className="text-sm font-medium">
                  {member.nickname}
                  {!member.isActive && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      Неактивен
                    </span>
                  )}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {BigInt(member.payable) > 0n
                    ? "К выплате"
                    : BigInt(member.payable) < 0n
                      ? "Переплата участнику"
                      : "Рассчитано"}
                </p>
              </div>
              <p className="text-base font-medium tabular-nums">
                <AdenaAmount amount={member.payable} />
              </p>
            </div>
            {canManage && BigInt(member.payable) > 0n && (
              <div className="inline-payment mt-2">
                <PaymentForm
                  memberId={member.memberId}
                  nickname={member.nickname}
                  remaining={member.payable}
                  partyCash={partyCash}
                  totalOutstanding={totalOutstanding}
                  open={activeId === member.memberId}
                  triggerDisabled={pending}
                  onPendingChange={setPending}
                  onOpenChange={(open) =>
                    setActiveId((current) =>
                      open ? member.memberId : current === member.memberId ? null : current,
                    )
                  }
                />
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
