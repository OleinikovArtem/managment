import { adenaColor, formatAdena } from "@/lib/adena";

export function AdenaAmount({
  amount,
  className = "",
}: {
  amount: bigint | string;
  className?: string;
}) {
  return (
    <span
      className={className}
      style={{ color: adenaColor(amount) }}
      title={`${amount.toString()} Adena`}
    >
      {formatAdena(amount)}
    </span>
  );
}
