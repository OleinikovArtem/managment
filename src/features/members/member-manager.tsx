"use client";

import { useState, useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
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
import {
  MemberProfileManager,
  type MemberProfileRow,
} from "@/features/members/member-profile-manager";
import { ClassSelect } from "./class-select";
import { GameIcon } from "@/components/ui/game-icon";

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

function MemberForm({ initialValues, submitLabel, action, onSuccess, onCancel }: MemberFormProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const form = useForm<MemberFormInput, unknown, MemberInput>({
    resolver: zodResolver(memberInputSchema),
    defaultValues: initialValues ?? {
      nickname: "",
      distributionWeight: 1,
      comment: "",
      className: "",
      role: "",
      subclasses: Array.from({ length: 4 }, (_, index) => ({ slot: index + 1, className: "" })),
    },
  });

  const mainClass = useWatch({ control: form.control, name: "className" });
  const subclasses = useWatch({ control: form.control, name: "subclasses" });

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
        form.reset({
          nickname: "",
          distributionWeight: 1,
          comment: "",
          className: "",
          role: "",
          subclasses: Array.from({ length: 4 }, (_, index) => ({ slot: index + 1, className: "" })),
        });
      }
    });
  });

  return (
    <form className="space-y-4" onSubmit={onSubmit} noValidate>
      <div className="space-y-2">
        <label
          htmlFor={initialValues ? "edit-nickname" : "new-nickname"}
          className="text-sm font-medium"
        >
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
          <p className="text-xs text-destructive">{form.formState.errors.nickname.message}</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ClassSelect
          id={initialValues ? "edit-main-class" : "new-main-class"}
          label="Main"
          {...form.register("className")}
          value={mainClass ?? ""}
          disabled={isPending}
        />
        <label className="space-y-1.5 text-xs font-medium">
          Роль
          <Input maxLength={40} {...form.register("role")} placeholder="Healer, Buffer, DPS" />
        </label>
      </div>
      <fieldset disabled={isPending} className="space-y-3 border-t border-border pt-4">
        <legend className="text-sm font-medium">
          Subclass{" "}
          <span className="font-normal text-muted-foreground">· до четырёх, необязательно</span>
        </legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1, 2, 3].map((index) => (
            <ClassSelect
              key={index}
              id={`${initialValues ? "edit" : "new"}-subclass-${index + 1}`}
              label={`Subclass ${index + 1}`}
              {...form.register(`subclasses.${index}.className`)}
              value={subclasses?.[index]?.className ?? ""}
            />
          ))}
        </div>
        {form.formState.errors.subclasses && (
          <p role="alert" className="text-xs text-destructive">
            Проверьте выбранные Subclass.
          </p>
        )}
      </fieldset>

      <div className="space-y-2">
        <label
          htmlFor={initialValues ? "edit-comment" : "new-comment"}
          className="text-sm font-medium"
        >
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
          <p className="text-xs text-destructive">{form.formState.errors.comment.message}</p>
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

export function MemberManager({
  members,
  canManage,
}: {
  members: MemberRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const filtered = members.filter(
    (member) =>
      (status === "all" || member.isActive === (status === "active")) &&
      `${member.nickname} ${member.className ?? ""} ${member.role ?? ""} ${member.profiles.map((profile) => profile.className).join(" ")}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase()),
  );
  function saved() {
    setEditingId(null);
    setIsCreateOpen(false);
    router.refresh();
  }
  function deactivate(member: MemberRow) {
    if (!window.confirm(`Деактивировать участника «${member.nickname}»? История будет сохранена.`))
      return;
    startTransition(async () => {
      const result = await deactivateMemberAction(member.id);
      setMessage(result.message);
      if (result.ok) {
        toast.success(result.message);
        router.refresh();
      } else toast.error(result.message);
    });
  }

  return (
    <section>
      <div className="toolbar">
        <Input
          aria-label="Поиск участников"
          placeholder="Ник, класс или роль"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          aria-label="Статус участников"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">Все участники</option>
          <option value="active">Активные</option>
          <option value="inactive">Неактивные</option>
        </select>
        {canManage && !isCreateOpen && (
          <Button
            className="sm:ml-auto"
            onClick={() => {
              setIsCreateOpen(true);
              setEditingId(null);
            }}
          >
            Добавить участника
          </Button>
        )}
      </div>
      {message && (
        <p className="mb-4 text-sm text-muted-foreground" role="status">
          {message}
        </p>
      )}
      {canManage && isCreateOpen && (
        <div className="editor-surface mb-6">
          <h2 className="section-heading mb-4">Новый участник</h2>
          <MemberForm
            submitLabel="Добавить участника"
            action={createMemberAction}
            onSuccess={saved}
            onCancel={() => setIsCreateOpen(false)}
          />
        </div>
      )}
      <p className="mb-3 text-xs text-muted-foreground" role="status">
        Показано: {filtered.length} из {members.length} · активных:{" "}
        {members.filter((member) => member.isActive).length}
      </p>
      {filtered.length === 0 ? (
        <p className="empty-state">
          {members.length
            ? "Участники не найдены. Измените поиск или статус."
            : "Добавьте первого участника, чтобы собрать группу для рейда."}
        </p>
      ) : (
        <ul className="data-list">
          {filtered.map((member) => (
            <li key={member.id} className="relative pr-12">
              {canManage && (
                <div className="absolute top-3 right-0">
                  <ActionMenu
                    label={`Действия: ${member.nickname}`}
                    disabled={isPending}
                    items={[
                      {
                        label: "Изменить участника",
                        onClick: () => {
                          setEditingId(member.id);
                          setIsCreateOpen(false);
                        },
                      },
                      ...(member.isActive
                        ? [
                            {
                              label: "Деактивировать",
                              destructive: true,
                              onClick: () => deactivate(member),
                            },
                          ]
                        : []),
                    ]}
                  />
                </div>
              )}
              {editingId === member.id ? (
                <div className="editor-surface">
                  <MemberForm
                    initialValues={{
                      nickname: member.nickname,
                      distributionWeight: member.distributionWeight,
                      comment: member.comment ?? "",
                      className: member.className ?? "",
                      role: member.role ?? "",
                      subclasses: [1, 2, 3, 4].map((slot) => {
                        const profile = member.profiles.find(
                          (profile) => profile.subclassSlot === slot,
                        );
                        return { slot, id: profile?.id, className: profile?.className ?? "" };
                      }),
                    }}
                    submitLabel="Сохранить"
                    action={(values) => updateMemberAction(member.id, values)}
                    onSuccess={saved}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              ) : (
                <details className="disclosure" name="member-profiles">
                  <summary>
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-semibold">
                        {member.nickname}
                        {!member.isActive && (
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            Неактивен
                          </span>
                        )}
                        {member.role && (
                          <span className="ml-3 text-xs font-normal text-muted-foreground">
                            {member.role}
                          </span>
                        )}
                      </span>
                      <span className="mt-3 flex flex-wrap gap-x-6 gap-y-3">
                        <ClassBadge label="Main" name={member.className} />
                        {member.profiles.map((profile) => (
                          <ClassBadge
                            key={profile.id}
                            label={
                              profile.subclassSlot ? `Subclass ${profile.subclassSlot}` : "Профиль"
                            }
                            name={profile.className}
                          />
                        ))}
                      </span>
                    </span>
                  </summary>
                  <div className="pt-3">
                    {member.comment && (
                      <p className="mb-3 whitespace-pre-wrap text-sm text-muted-foreground">
                        {member.comment}
                      </p>
                    )}
                    {member.profiles.length > 4 ? (
                      <MemberProfileManager
                        memberId={member.id}
                        profiles={member.profiles}
                        canManage={canManage}
                      />
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {member.isActive
                          ? "Main и Subclass выбираются при редактировании участника."
                          : "Участник неактивен. Данные его рейдов и начислений сохранены."}
                      </p>
                    )}
                  </div>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ClassBadge({ label, name }: { label: string; name: string | null }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <GameIcon kind="class" name={name || "Не выбран"} />
      <span className="min-w-0">
        <span
          className={`block text-xs ${label === "Main" ? "text-[#e6be67]" : "text-muted-foreground"}`}
        >
          {label}
        </span>
        <span className="block break-words text-sm">{name || "Не выбран"}</span>
      </span>
    </span>
  );
}
