"use client";
import { useState } from "react";
import { CALENDAR_SCHEDULES } from "./calendar-schedules";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent, PopoverTitle } from "@/components/ui/popover";
import { SidePanel } from "@/components/ui/side-panel";
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { useIsMobile } from "@/hooks/use-mobile";

export const WEEKLY_RESET_REFERENCE = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье",
].map((day, index) => ({
  day,
  instances: CALENDAR_SCHEDULES.filter((r) => !r.days.length || r.days.includes(index + 1))
    .map((r) => (r.code === "FREYA_NORMAL" ? "Фрея / Блесс" : r.name))
    .join("; "),
}));
function ReferenceTable() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Недельная памятка по вашей таблице. Время откатов — 06:30, Europe/Kyiv.
      </p>
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-28">День</TableHead>
            <TableHead>Инстансы</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {WEEKLY_RESET_REFERENCE.map((row) => (
            <TableRow key={row.day}>
              <TableCell className="whitespace-normal align-top font-medium">{row.day}</TableCell>
              <TableCell className="whitespace-normal leading-6">{row.instances}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="text-sm text-muted-foreground">
        Лаба — общий откат для всех уровней. Закен — один общий откат. Фрея и Блесс делят один
        откат.
      </p>
      <p className="text-xs text-muted-foreground">
        Справочный текст не изменяет данные. Календарь использует это расписание сервера
        автоматически.
      </p>
    </div>
  );
}
export function WeeklyResetReference() {
  const mobile = useIsMobile();
  const [open, setOpen] = useState(false);
  if (mobile)
    return (
      <>
        <Button variant="outline" className="min-h-11" onClick={() => setOpen(true)}>
          <BookOpen />
          Расписание откатов
        </Button>
        <SidePanel
          open={open}
          onOpenChange={setOpen}
          title="Расписание откатов"
          description="Статическая памятка по дням недели"
        >
          <ReferenceTable />
        </SidePanel>
      </>
    );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="outline" className="min-h-11" />}>
        <BookOpen />
        Расписание откатов
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="max-h-[80dvh] w-[560px] max-w-[calc(100vw-2rem)] overflow-y-auto p-5"
      >
        <PopoverTitle>Расписание откатов</PopoverTitle>
        <ReferenceTable />
      </PopoverContent>
    </Popover>
  );
}
