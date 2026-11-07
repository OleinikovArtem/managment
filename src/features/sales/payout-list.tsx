"use client";

import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { AdenaAmount } from "@/components/ui/adena-amount";
import { Button } from "@/components/ui/button";
import { PaymentForm } from "@/features/sales/payment-form";
import { cn } from "cn";

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
  const activeMember = members.find((member) => member.memberId === activeId);
  const filters = [
    { value: "all", label: "Все" },
    { value: "payable", label: "К выплате" },
    { value: "overpaid", label: "Переплаты" },
  ] as const;
  const visible = (member: Row) =>
    member.nickname.toLocaleLowerCase().includes(query.toLocaleLowerCase()) &&
    (filter === "all" ||
      (filter === "payable" ? BigInt(member.payable) > 0n : BigInt(member.payable) < 0n));
  const count = members.filter(visible).length;
  const counts = {
    all: members.length,
    payable: members.filter((member) => BigInt(member.payable) > 0n).length,
    overpaid: members.filter((member) => BigInt(member.payable) < 0n).length,
  };
  const visibleMembers = members.filter(visible);
  return (
    <section>
      <div className="toolbar finance-toolbar">
        <Input
          aria-label="Поиск получателя"
          placeholder="Ник участника"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="finance-segmented" role="group" aria-label="Тип остатка участника">
          {filters.map((option) => (
            <Button
              key={option.value}
              type="button"
              size="sm"
              variant="ghost"
              className={cn("finance-segmented-option", filter === option.value && "is-active")}
              aria-pressed={filter === option.value}
              onClick={() => setFilter(option.value)}
            >
              {option.label} <span>{counts[option.value]}</span>
            </Button>
          ))}
        </div>
      </div>
      <p className="finance-list-summary" role="status">
        Участников: {count} из {members.length}
      </p>
      {count === 0 && (
        <p className="empty-state">
          {members.length
            ? "Участников по этим условиям нет."
            : "После первой продажи здесь появятся начисленные доли."}
        </p>
      )}
      <ul className="finance-payout-grid">
        {visibleMembers.map((member) => (
          <li key={member.memberId} className="finance-payout-card">
            <PayoutCard
              member={member}
              canManage={canManage}
              onSelect={() => setActiveId(member.memberId)}
            />
          </li>
        ))}
      </ul>
      {canManage && activeMember && BigInt(activeMember.payable) > 0n && (
        <PaymentForm
          key={activeMember.memberId}
          memberId={activeMember.memberId}
          nickname={activeMember.nickname}
          remaining={activeMember.payable}
          partyCash={partyCash}
          totalOutstanding={totalOutstanding}
          open
          onOpenChange={(open) => {
            if (!open) setActiveId(null);
          }}
        />
      )}
    </section>
  );
}

function PayoutCard({
  member,
  canManage,
  onSelect,
}: {
  member: Row;
  canManage: boolean;
  onSelect: () => void;
}) {
  const payable = BigInt(member.payable);
  const body = (
    <>
      <div className="finance-payout-main">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {member.nickname}
            {!member.isActive && <span className="finance-inactive-tag">Неактивен</span>}
          </p>
          <p
            className="finance-payout-kind"
            data-state={payable > 0n ? "payable" : payable < 0n ? "overpaid" : "settled"}
          >
            {payable > 0n ? "К выплате" : payable < 0n ? "Переплата участнику" : "Рассчитано"}
          </p>
        </div>
        <AdenaAmount amount={member.payable} className="finance-payout-amount" />
      </div>
      {canManage && payable > 0n && (
        <span className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2.5 text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground group-focus-visible:text-foreground">
          Передать Adena <ArrowUpRight aria-hidden="true" size={15} />
        </span>
      )}
    </>
  );

  return canManage && payable > 0n ? (
    <button
      type="button"
      className="group block w-full rounded-md text-left text-foreground outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      onClick={onSelect}
      aria-haspopup="dialog"
      aria-label={`Оформить передачу Adena участнику ${member.nickname}: ${member.payable}`}
    >
      {body}
    </button>
  ) : (
    <div>{body}</div>
  );
}
