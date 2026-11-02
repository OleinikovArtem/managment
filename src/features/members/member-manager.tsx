"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { Pencil, Plus, UserRound, UserRoundMinus, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

type MemberRow = {
  id: string;
  nickname: string;
  distributionWeight: number;
  isActive: boolean;
  comment: string | null;
  createdAt: string;
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
        const weightError = result.fieldErrors?.distributionWeight?.[0];
        const commentError = result.fieldErrors?.comment?.[0];
        if (nicknameError) {
          form.setError("nickname", { message: nicknameError });
        }
        if (commentError) {
          form.setError("comment", { message: commentError });
        }
        if (weightError) {
          form.setError("distributionWeight", { message: weightError });
        }
        return;
      }

      toast.success(result.message);
      onSuccess();
      if (!initialValues) {
        form.reset({ nickname: "", distributionWeight: 1, comment: "" });
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

      <div className="space-y-2">
        <label
          htmlFor={initialValues ? "edit-distribution-weight" : "new-distribution-weight"}
          className="text-sm font-medium"
        >
          Вес распределения
        </label>
        <Input
          id={initialValues ? "edit-distribution-weight" : "new-distribution-weight"}
          type="number"
          min={1}
          max={2_147_483_647}
          step={1}
          aria-invalid={Boolean(form.formState.errors.distributionWeight)}
          {...form.register("distributionWeight", { valueAsNumber: true })}
        />
        <p className="text-xs text-muted-foreground">
          Доля участника в распределении Adena относительно остальных PRESENT.
        </p>
        {form.formState.errors.distributionWeight && (
          <p className="text-xs text-destructive">
            {form.formState.errors.distributionWeight.message}
          </p>
        )}
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

export function MemberManager({ members }: { members: MemberRow[] }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const activeCount = members.filter((member) => member.isActive).length;

  function refreshAfterSave(successMessage: string) {
    setMessage(successMessage);
    setEditingId(null);
    setIsCreateOpen(false);
    router.refresh();
  }

  function handleDeactivate(member: MemberRow) {
    if (!window.confirm(`Деактивировать участника «${member.nickname}»? История будет сохранена.`)) {
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const result = await deactivateMemberAction(member.id);
      if (!result.ok) {
        setMessage(result.message);
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      refreshAfterSave(result.message);
    });
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Card className="h-fit">
        <CardHeader className="flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <CardTitle>Состав группы</CardTitle>
            <CardDescription>
              Ники уникальны внутри группы без учёта регистра и лишних пробелов.
            </CardDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Badge variant="outline" className="hidden border-emerald-400/30 text-emerald-300 sm:inline-flex">
              {activeCount} активных
            </Badge>
            <Button type="button" size="sm" onClick={() => setIsCreateOpen((open) => !open)} aria-expanded={isCreateOpen}>
              <Plus aria-hidden="true" />
              {isCreateOpen ? "Скрыть форму" : "Добавить участника"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {message && (
            <p role="status" className="rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm">
              {message}
            </p>
          )}

          {isCreateOpen && (
            <div className="rounded-xl border border-primary/25 bg-primary/5 p-4">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-medium">Новый участник</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Заполните только данные, которые нужны для распределения.</p>
                </div>
                <Button type="button" variant="ghost" size="icon-sm" onClick={() => setIsCreateOpen(false)} aria-label="Закрыть форму добавления">
                  <X aria-hidden="true" />
                </Button>
              </div>
              <MemberForm
                submitLabel="Добавить участника"
                action={createMemberAction}
                onSuccess={() => refreshAfterSave("Участник добавлен.")}
                onCancel={() => setIsCreateOpen(false)}
              />
            </div>
          )}

          {members.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border px-6 py-10 text-center">
              <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <UserRound aria-hidden="true" size={20} />
              </span>
              <h2 className="mt-4 font-medium">Пока нет участников</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Добавьте первого персонажа, чтобы начать вести состав.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {members.map((member) => (
                <li key={member.id} className="py-4 first:pt-0 last:pb-0">
                  {editingId === member.id ? (
                    <MemberForm
                      initialValues={{
                        nickname: member.nickname,
                        distributionWeight: member.distributionWeight,
                        comment: member.comment ?? "",
                      }}
                      submitLabel="Сохранить"
                      action={(values) => updateMemberAction(member.id, values)}
                      onSuccess={() => refreshAfterSave("Изменения участника сохранены.")}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{member.nickname}</span>
                          <Badge variant={member.isActive ? "secondary" : "outline"}>
                            {member.isActive ? "Активен" : "Неактивен"}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Вес: {member.distributionWeight} · Добавлен {member.createdAt}
                          {member.comment ? ` · ${member.comment}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setMessage(null);
                            setEditingId(member.id);
                          }}
                        >
                          <Pencil aria-hidden="true" />
                          Изменить
                        </Button>
                        {member.isActive && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={isPending}
                            onClick={() => handleDeactivate(member)}
                          >
                            <UserRoundMinus aria-hidden="true" />
                            Отключить
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
