"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ProfessionSelect } from "@/features/members/profession-select";
import { Input } from "@/components/ui/input";
import { ActionMenu } from "@/components/ui/action-menu";
import { EditorDialog } from "@/components/ui/editor-dialog";
import { GameIcon } from "@/components/ui/game-icon";
import {
  deleteMemberProfileAction,
  updateMemberProfileAction,
} from "@/app/(dashboard)/members/profile-actions";

export type MemberProfileRow = {
  id: string;
  name: string;
  className: string;
  role: string | null;
  level: number | null;
  note: string | null;
  subclassSlot: number | null;
  updatedAt: string;
};

function ProfileFields({ profile }: { profile: MemberProfileRow }) {
  const [className, setClassName] = useState(profile.className);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="space-y-2 text-sm">
        Название профиля
        <Input
          name="name"
          required
          maxLength={80}
          defaultValue={profile?.name}
          placeholder="Основной профиль"
        />
      </label>
      <div className="space-y-2 text-sm">
        <label className="block" htmlFor={`profile-class-${profile.id}`}>
          Класс
        </label>
        <input type="hidden" name="className" value={className} />
        <ProfessionSelect
          id={`profile-class-${profile.id}`}
          aria-label={`Класс Subclass ${profile.subclassSlot ?? "legacy"}`}
          mainClass={profile.className}
          profiles={[]}
          value={className === profile.className ? "main" : `class:${className}`}
          onChange={(option) => setClassName(option?.className ?? "")}
        />
      </div>
      <label className="space-y-2 text-sm">
        Роль
        <Input name="role" defaultValue={profile?.role ?? ""} placeholder="Healer, Buffer, DPS" />
      </label>
      <label className="space-y-2 text-sm sm:col-span-2">
        Заметка
        <Input name="note" defaultValue={profile?.note ?? ""} />
      </label>
    </div>
  );
}

export function MemberProfileManager({
  profiles,
  canManage,
}: {
  profiles: MemberProfileRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<MemberProfileRow | null>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const element = event.currentTarget;
    const data = new FormData(element);
    const values = {
      name: data.get("name"),
      className: data.get("className"),
      role: data.get("role"),
      note: data.get("note"),
      expectedUpdatedAt: editing.updatedAt,
    };
    setMessage(null);
    startTransition(async () => {
      const result = await updateMemberProfileAction(editing.id, values);
      if (!result.ok) {
        setMessage(result.message);
        toast.error(result.message);
        return;
      }
      toast.success(result.message);
      element.reset();
      setEditing(null);
      router.refresh();
    });
  }
  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium">Игровые профили</h3>
      </div>
      {profiles.length === 0 ? (
        <p className="text-sm text-muted-foreground">Subclass редактируются вместе с участником.</p>
      ) : (
        <ul className="divide-y divide-border">
          {profiles.map((profile) => (
            <li key={profile.id} className="flex items-center gap-3 py-3">
              <GameIcon kind="class" name={profile.className} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {profile.name} · {profile.className}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[profile.role, profile.note].filter(Boolean).join(" · ")}
                </p>
              </div>
              {canManage && (
                <ActionMenu
                  label={`Действия профиля ${profile.name}`}
                  disabled={pending}
                  items={[
                    {
                      label: "Изменить профиль",
                      onClick: () => {
                        setEditing(profile);
                        setMessage(null);
                      },
                    },
                    {
                      label: "Отключить профиль",
                      destructive: true,
                      confirmation: {
                        title: `Отключить профиль «${profile.name}»?`,
                        description:
                          "История рейдов сохранится. Профиль перестанет быть доступен для новых составов.",
                        confirmLabel: "Отключить профиль",
                      },
                      onClick: () =>
                        new Promise<void>((resolve, reject) => {
                          startTransition(async () => {
                            try {
                              const result = await deleteMemberProfileAction(profile.id);
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
                          });
                        }),
                    },
                  ]}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <EditorDialog
          open={Boolean(editing)}
          onClose={() => {
            if (!pending) {
              setEditing(null);
            }
          }}
          title="Изменить Subclass"
          description="Изменения используются в будущих составах. История рейдов сохраняется."
        >
          {editing && (
            <form key={editing.id} onSubmit={save} className="space-y-5">
              <ProfileFields profile={editing} />
              {message && (
                <p role="alert" className="text-sm text-destructive">
                  {message}
                </p>
              )}
              <div className="flex gap-2">
                <Button disabled={pending} type="submit">
                  {pending ? "Сохранение…" : "Сохранить"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    setEditing(null);
                  }}
                >
                  Отмена
                </Button>
              </div>
            </form>
          )}
        </EditorDialog>
      )}
    </div>
  );
}
