"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ActionMenu } from "@/components/ui/action-menu";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { GameIcon } from "@/components/ui/game-icon";
import { ProfessionSelect } from "@/features/members/profession-select";
import {
  createCompositionAction,
  deleteCompositionAction,
  updateCompositionAction,
} from "@/app/(dashboard)/members/composition-actions";

export type CompositionProfile = {
  id: string;
  name: string;
  className: string;
  role: string | null;
  level: number | null;
  subclassSlot?: number | null;
};
export type CompositionMember = {
  id: string;
  nickname: string;
  className: string | null;
  role: string | null;
  level: number | null;
  profiles: CompositionProfile[];
  isActive?: boolean;
};
export type CompositionRow = {
  id: string;
  name: string;
  description: string | null;
  focus: string | null;
  members: {
    member: CompositionMember;
    profile: CompositionProfile | null;
    classOverride: string | null;
  }[];
};

export function CompositionManager({
  compositions,
  members,
  canManage,
}: {
  compositions: CompositionRow[];
  members: CompositionMember[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState(compositions[0]?.id ?? "");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [cancelConfirmationOpen, setCancelConfirmationOpen] = useState(false);
  const [builderDirty, setBuilderDirty] = useState(false);
  const [selected, setSelected] = useState<
    { memberId: string; profileId?: string; classOverride?: string }[]
  >([]);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const active = compositions.find((item) => item.id === activeId) ?? compositions[0];
  const editing = compositions.find((item) => item.id === editingId);
  const editingMembers = editing?.members.map(({ member, profile }) => ({
    ...member,
    profiles:
      profile && !member.profiles.some((savedProfile) => savedProfile.id === profile.id)
        ? [...member.profiles, profile]
        : member.profiles,
  }));
  const formMembers = [
    ...members,
    ...(editingMembers ?? []).filter(
      (member) => !members.some((activeMember) => activeMember.id === member.id),
    ),
  ];
  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const data = new FormData(element);
    setMessage(null);
    startTransition(async () => {
      const payload = {
        name: data.get("name"),
        description: data.get("description"),
        focus: data.get("focus"),
        slots: selected,
      };
      const result = editingId
        ? await updateCompositionAction(editingId, payload)
        : await createCompositionAction(payload);
      if (!result.ok) {
        setMessage(result.message);
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      element.reset();
      setSelected([]);
      setEditingId(null);
      setBuilderDirty(false);
      setOpen(false);
      router.refresh();
    });
  }
  function remove(item: CompositionRow) {
    return new Promise<void>((resolve, reject) =>
      startTransition(async () => {
        try {
          const result = await deleteCompositionAction(item.id);
          if (!result.ok) {
            reject(new Error(result.message));
            return;
          }
          toast.success(result.message);
          router.refresh();
          resolve();
        } catch (error) {
          reject(error);
        }
      }),
    );
  }
  function cancelBuilder() {
    setOpen(false);
    setSelected([]);
    setEditingId(null);
    setBuilderDirty(false);
    setMessage(null);
  }

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Сохранённых составов: {compositions.length}</p>
        {canManage && !open && (
          <Button
            onClick={() => {
              setEditingId(null);
              setSelected([]);
              setBuilderDirty(false);
              setOpen(true);
            }}
          >
            Новый состав
          </Button>
        )}
      </div>
      {open ? (
        <form
          key={editingId ?? "new"}
          onSubmit={save}
          onChange={() => setBuilderDirty(true)}
          className="editor-surface space-y-6"
        >
          <h2 className="section-heading">{editing ? "Изменить состав" : "Новый состав"}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-2 text-sm">
              Название
              <Input
                name="name"
                required
                defaultValue={editing?.name}
                placeholder="Основной рейд"
              />
            </label>
            <label className="space-y-2 text-sm">
              Направление
              <Input
                name="focus"
                defaultValue={editing?.focus ?? ""}
                placeholder="Melee, Mage, Archer"
              />
            </label>
            <label className="space-y-2 text-sm sm:col-span-2">
              Описание
              <Input
                name="description"
                defaultValue={editing?.description ?? ""}
                placeholder="Необязательная заметка"
              />
            </label>
          </div>
          <div>
            <h3 className="text-sm font-medium">Выбрано {selected.length} из 36</h3>
            <p className="mt-1 mb-3 text-xs text-muted-foreground">
              Для обычной партии рекомендуется до 9 участников.
            </p>
            {members.length === 0 ? (
              <p className="empty-state">
                Сначала{" "}
                <Link href="/members" className="underline">
                  добавьте участников
                </Link>
                .
              </p>
            ) : (
              formMembers.map((member) => {
                const slot = selected.find((item) => item.memberId === member.id);
                const checked = Boolean(slot);
                const savedSlot = editing?.members.find((row) => row.member.id === member.id);
                const savedProfile = slot?.profileId
                  ? (member.profiles.find((profile) => profile.id === slot.profileId) ??
                    savedSlot?.profile)
                  : null;
                return (
                  <div key={member.id} className="slot-row">
                    <div className="min-w-0">
                      <p className="text-sm font-medium break-words">{member.nickname}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {member.className || member.role || "Класс не указан"}
                        {member.isActive === false && " · Неактивен"}
                      </p>
                    </div>
                    <ProfessionSelect
                      aria-label={`Профессия ${member.nickname}`}
                      mainClass={member.className}
                      profiles={member.profiles}
                      preserved={
                        savedProfile
                          ? { profileId: savedProfile.id, className: savedProfile.className }
                          : null
                      }
                      disabled={!checked || pending || member.isActive === false}
                      value={
                        slot?.profileId
                          ? `profile:${slot.profileId}`
                          : slot?.classOverride
                            ? `class:${slot.classOverride}`
                            : member.className
                              ? "main"
                              : undefined
                      }
                      onChange={(option) =>
                        setSelected((current) =>
                          current.map((item) =>
                            item.memberId !== member.id
                              ? item
                              : {
                                  memberId: member.id,
                                  ...(option?.profileId ? { profileId: option.profileId } : {}),
                                  ...(!option?.profileId &&
                                  (option?.source === "catalog" || option?.source === "legacy")
                                    ? { classOverride: option.className }
                                    : {}),
                                },
                          ),
                        )
                      }
                    />
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={
                        pending ||
                        (!checked && (selected.length >= 36 || member.isActive === false))
                      }
                      aria-label={`Добавить ${member.nickname} в состав`}
                      onChange={() =>
                        setSelected((current) =>
                          checked
                            ? current.filter((item) => item.memberId !== member.id)
                            : [...current, { memberId: member.id }],
                        )
                      }
                    />
                  </div>
                );
              })
            )}
          </div>
          {message && (
            <p role="alert" className="text-sm text-destructive">
              {message}
            </p>
          )}
          <div className="flex gap-2">
            <Button type="submit" disabled={pending || selected.length === 0}>
              {pending ? "Сохранение…" : "Сохранить состав"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={pending}
              onClick={() => {
                if (builderDirty) setCancelConfirmationOpen(true);
                else cancelBuilder();
              }}
            >
              Отмена
            </Button>
          </div>
        </form>
      ) : !active ? (
        <p className="empty-state">
          Создайте состав, чтобы одним выбором подставлять участников и профили в новый рейд.
        </p>
      ) : (
        <div className="composition-layout">
          <nav aria-label="Сохранённые составы" className="space-y-1">
            {compositions.map((item) => (
              <button
                type="button"
                key={item.id}
                aria-current={active.id === item.id ? "true" : undefined}
                className="composition-choice"
                onClick={() => setActiveId(item.id)}
              >
                <span className="block text-sm font-medium">{item.name}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {item.focus || "Общий состав"} · участников: {item.members.length}
                </span>
              </button>
            ))}
          </nav>
          <section className="min-w-0">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="section-heading">{active.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {active.focus || "Общий состав"} · {active.members.length} участников
                </p>
              </div>
              {canManage && (
                <ActionMenu
                  label={`Действия состава ${active.name}`}
                  disabled={pending}
                  items={[
                    {
                      label: "Изменить состав",
                      onClick: () => {
                        setEditingId(active.id);
                        setBuilderDirty(false);
                        setSelected(
                          active.members.map(({ member, profile, classOverride }) => ({
                            memberId: member.id,
                            ...(profile ? { profileId: profile.id } : {}),
                            ...(classOverride ? { classOverride } : {}),
                          })),
                        );
                        setOpen(true);
                      },
                    },
                    {
                      label: "Удалить состав",
                      destructive: true,
                      confirmation: {
                        title: `Удалить состав «${active.name}»?`,
                        description:
                          "Исторические рейды сохраняются. Если состав используется рейдом, сервер запретит удаление.",
                      },
                      onClick: () => remove(active),
                    },
                  ]}
                />
              )}
            </div>
            <ul className="composition-roster">
              {active.members.map(({ member, profile, classOverride }) => (
                <li key={member.id}>
                  <GameIcon
                    kind="class"
                    name={classOverride || profile?.className || member.className || "Support"}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium break-words">{member.nickname}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {classOverride
                        ? classOverride
                        : profile
                          ? `${profile.name} · ${profile.className}`
                          : member.className || "Базовый профиль"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            {active.description && (
              <p className="mt-5 whitespace-pre-wrap text-sm text-muted-foreground">
                {active.description}
              </p>
            )}
          </section>
        </div>
      )}
      <ConfirmationDialog
        open={cancelConfirmationOpen}
        onOpenChange={setCancelConfirmationOpen}
        title={editingId ? "Отменить изменение состава?" : "Отменить создание состава?"}
        description={
          editingId
            ? "Изменения названия, описания и выбранных участников не сохранятся."
            : "Выбранные участники не будут сохранены в состав."
        }
        confirmLabel="Отменить изменения"
        onConfirm={async () => cancelBuilder()}
      />
    </section>
  );
}
