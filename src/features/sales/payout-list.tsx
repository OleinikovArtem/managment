"use client";

import { useRef, useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { AdenaAmount } from "@/components/ui/adena-amount";
import { Button } from "@/components/ui/button";
import { PaymentForm } from "@/features/sales/payment-form";
import type { PaymentDraft } from "@/features/sales/payment-form";
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
  const [panelOpen, setPanelOpen] = useState(false);
  const paymentTriggerRef = useRef<HTMLButtonElement | null>(null);
  const [drafts, setDrafts] = useState<Record<string, PaymentDraft>>({});
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
              onSelect={(trigger) => {
                paymentTriggerRef.current = trigger;
                setActiveId(member.memberId);
                setPanelOpen(true);
              }}
            />
          </li>
        ))}
      </ul>
      {canManage && activeMember && (
        <PaymentForm
          returnFocus={paymentTriggerRef}
          key={`${activeMember.memberId}:${activeMember.payable}:${partyCash}:${totalOutstanding}`}
          memberId={activeMember.memberId}
          nickname={activeMember.nickname}
          remaining={activeMember.payable}
          partyCash={partyCash}
          totalOutstanding={totalOutstanding}
          open={panelOpen && BigInt(activeMember.payable) > 0n}
          draft={drafts[activeMember.memberId]}
          onDraftChange={(draft) =>
            setDrafts((current) => ({ ...current, [activeMember.memberId]: draft }))
          }
          onSuccess={() =>
            setDrafts((current) => {
              const next = { ...current };
              delete next[activeMember.memberId];
              return next;
            })
          }
          onOpenChange={(open) => {
            setPanelOpen(open);
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
  onSelect: (trigger: HTMLButtonElement) => void;
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
      onClick={(event) => onSelect(event.currentTarget)}
      aria-haspopup="dialog"
      aria-label={`Оформить передачу Adena участнику ${member.nickname}: ${member.payable}`}
    >
      {body}
    </button>
  ) : (
    <div>{body}</div>
  );
}
