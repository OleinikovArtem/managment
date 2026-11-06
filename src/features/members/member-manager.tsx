"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";
import { ActionMenu } from "@/components/ui/action-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { MemberActionResult } from "@/features/members/member-action-result";
import {
  memberInputSchema,
  type MemberFormInput,
  type MemberInput,
} from "@/features/members/member-schema";
import {
  createMemberAction,
  deactivateMemberAction,
  updateMemberAction,
} from "@/app/(dashboard)/members/actions";
import { MemberProfileManager, type MemberProfileRow } from "@/features/members/member-profile-manager";
import { LINEAGE2_HIGH_FIVE_CLASSES } from "@/features/members/lineage2-classes";

type MemberRow = {
  id: string;
  nickname: string;
  distributionWeight: number;
  isActive: boolean;
  comment: string | null;
  createdAt: string;
  className: string | null;
  level: number | null;
  role: string | null;
  profiles: MemberProfileRow[];
};

type MemberFormProps = {
  initialValues?: MemberInput;
  submitLabel: string;
  action: (values: MemberInput) => Promise<MemberActionResult>;
  onSuccess: () => void;
  onCancel?: () => void;
};

function MemberForm({
  initialValues,
  submitLabel,
  action,
  onSuccess,
  onCancel,
}: MemberFormProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const form = useForm<MemberFormInput, unknown, MemberInput>({
    resolver: zodResolver(memberInputSchema),
    defaultValues: initialValues ?? {
      nickname: "",
      distributionWeight: 1,
      comment: "",
      className: "",
      level: null,
      role: "",
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    setMessage(null);
    startTransition(async () => {
      const result = await action(values);
      if (!result.ok) {
        setMessage(result.message);
        toast.error(result.message);
        const nicknameError = result.fieldErrors?.nickname?.[0];
        const commentError = result.fieldErrors?.comment?.[0];
        if (nicknameError) {
          form.setError("nickname", { message: nicknameError });
        }
        if (commentError) {
          form.setError("comment", { message: commentError });
        }
        return;
      }

      toast.success(result.message);
      onSuccess();
      if (!initialValues) {
        form.reset({ nickname: "", distributionWeight: 1, comment: "", className: "", role: "", level: null });
      }
    });
  });

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      <div className="space-y-2">
        <label htmlFor={initialValues ? "edit-nickname" : "new-nickname"} className="text-sm font-medium">
          Игровой ник
        </label>
        <Input
          id={initialValues ? "edit-nickname" : "new-nickname"}
          autoComplete="off"
          maxLength={64}
          aria-invalid={Boolean(form.formState.errors.nickname)}
          {...form.register("nickname")}
          placeholder="Например, NightRaven"
        />
        {form.formState.errors.nickname && (
          <p className="text-xs text-destructive">
            {form.formState.errors.nickname.message}
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="space-y-1.5 text-xs font-medium">Класс<select className="h-9 w-full rounded-lg border border-input bg-background/35 px-3 text-sm" {...form.register("className")}><option value="">Не выбран</option>{LINEAGE2_HIGH_FIVE_CLASSES.map((className) => <option key={className} value={className}>{className}</option>)}</select></label>
        <label className="space-y-1.5 text-xs font-medium">Роль<Input maxLength={40} {...form.register("role")} placeholder="Healer, Buffer, DPS" /></label>
        <label className="space-y-1.5 text-xs font-medium">Уровень<Input type="number" min={1} max={99} aria-invalid={Boolean(form.formState.errors.level)} {...form.register("level", { setValueAs: (value) => value === "" || value == null ? undefined : Number(value) })} placeholder="85" />{form.formState.errors.level && <span className="block text-xs text-destructive">{form.formState.errors.level.message}</span>}</label>
      </div>

      <div className="space-y-2">
        <label htmlFor={initialValues ? "edit-comment" : "new-comment"} className="text-sm font-medium">
          Комментарий <span className="font-normal text-muted-foreground">(необязательно)</span>
        </label>
        <Textarea
          id={initialValues ? "edit-comment" : "new-comment"}
          maxLength={500}
          rows={2}
          aria-invalid={Boolean(form.formState.errors.comment)}
          {...form.register("comment")}
          placeholder="Роль, заметка или предпочтения"
        />
        {form.formState.errors.comment && (
          <p className="text-xs text-destructive">
            {form.formState.errors.comment.message}
          </p>
        )}
      </div>

      {message && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={isPending}>
          <Plus aria-hidden="true" />
          {isPending ? "Сохранение..." : submitLabel}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
            <X aria-hidden="true" />
            Отмена
          </Button>
        )}
      </div>
    </form>
  );
}

export function MemberManager({ members, canManage }: { members: MemberRow[]; canManage: boolean }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const filtered = members.filter(member => (status === "all" || member.isActive === (status === "active")) && `${member.nickname} ${member.className ?? ""} ${member.role ?? ""}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  function saved() { setEditingId(null); setIsCreateOpen(false); router.refresh(); }
  function deactivate(member: MemberRow) {
    if (!window.confirm(`Деактивировать участника «${member.nickname}»? История будет сохранена.`)) return;
    startTransition(async () => {
      const result = await deactivateMemberAction(member.id);
      setMessage(result.message);
      if (result.ok) { toast.success(result.message); router.refresh(); } else toast.error(result.message);
    });
  }

  return <section>
    <div className="toolbar"><Input aria-label="Поиск участников" placeholder="Ник, класс или роль" value={query} onChange={e => setQuery(e.target.value)} /><select aria-label="Статус участников" value={status} onChange={e => setStatus(e.target.value)}><option value="all">Все участники</option><option value="active">Активные</option><option value="inactive">Неактивные</option></select>{canManage && !isCreateOpen && <Button className="sm:ml-auto" onClick={() => { setIsCreateOpen(true); setEditingId(null); }}>Добавить участника</Button>}</div>
    {message && <p className="mb-4 text-sm text-muted-foreground" role="status">{message}</p>}
    {canManage && isCreateOpen && <div className="editor-surface mb-6"><h2 className="section-heading mb-4">Новый участник</h2><MemberForm submitLabel="Добавить участника" action={createMemberAction} onSuccess={saved} onCancel={() => setIsCreateOpen(false)} /></div>}
    <p className="mb-3 text-xs text-muted-foreground" role="status">Показано: {filtered.length} из {members.length} · активных: {members.filter(member => member.isActive).length}</p>
    {filtered.length === 0 ? <p className="empty-state">{members.length ? "Участники не найдены. Измените поиск или статус." : "Добавьте первого участника, чтобы собрать группу для рейда."}</p> : <ul className="data-list">{filtered.map(member => <li key={member.id} className="relative pr-12">
      {canManage && <div className="absolute top-3 right-0"><ActionMenu label={`Действия: ${member.nickname}`} disabled={isPending} items={[
        { label: "Изменить участника", onClick: () => { setEditingId(member.id); setIsCreateOpen(false); } },
        ...(member.isActive ? [{ label: "Деактивировать", destructive: true, onClick: () => deactivate(member) }] : []),
      ]} /></div>}
      {editingId === member.id ? <div className="editor-surface"><MemberForm initialValues={{ nickname: member.nickname, distributionWeight: member.distributionWeight, comment: member.comment ?? "", className: member.className ?? "", level: member.level, role: member.role ?? "" }} submitLabel="Сохранить" action={values => updateMemberAction(member.id, values)} onSuccess={saved} onCancel={() => setEditingId(null)} /></div> : <details className="disclosure" name="member-profiles">
        <summary><span className="min-w-0"><span className="block text-sm font-medium">{member.nickname}{!member.isActive && <span className="ml-2 text-xs font-normal text-muted-foreground">Неактивен</span>}</span><span className="mt-1 block text-xs text-muted-foreground">{[member.className, member.role, member.level ? `Lv. ${member.level}` : null].filter(Boolean).join(" · ") || "Класс не указан"} · профилей: {member.profiles.length}</span></span></summary>
        <div className="pt-3">{member.comment && <p className="mb-3 whitespace-pre-wrap text-sm text-muted-foreground">{member.comment}</p>}{member.isActive ? <MemberProfileManager memberId={member.id} profiles={member.profiles} canManage={canManage} /> : <p className="text-sm text-muted-foreground">Участник неактивен. Данные его рейдов и начислений сохранены.</p>}</div>
      </details>}
    </li>)}</ul>}
  </section>;
}
