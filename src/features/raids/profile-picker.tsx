"use client";
import { ChevronDown } from "lucide-react";
import "./profile-picker.css";
import type { RaidMemberOption } from "./raid-form";
export function RaidProfilePicker({ member, value, onChange, disabled }: { member: RaidMemberOption; value?: string; onChange: (id: string | undefined) => void; disabled: boolean }) {
  const selected=member.profiles?.find(profile=>profile.id===value);
  const label=value?(selected?.subclassSlot?`Subclass ${selected.subclassSlot}`:selected?.name||"Исторический профиль"):"Main";
  const name=selected?.className??member.className;
  return <div className="raid-profile-control"><div className="raid-profile-display" aria-hidden="true"><span>{label}</span><strong>{name||"Класс не указан"}</strong><ChevronDown size={13}/></div><select className="raid-profile-native" aria-label={`Профиль ${member.nickname}`} value={value??""} disabled={disabled} onChange={event=>onChange(event.target.value||undefined)}><option value="">Main{member.className?` · ${member.className}`:""}</option>{value&&!selected&&<option value={value}>Исторический профиль</option>}{member.profiles?.map(profile=><option key={profile.id} value={profile.id}>{profile.subclassSlot?`Subclass ${profile.subclassSlot}`:profile.name} · {profile.className}</option>)}</select></div>;
}
