import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn("glass rounded-2xl border border-line", className)}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  eyebrow,
  description,
  action,
  className,
  titleId,
}: {
  title: ReactNode;
  eyebrow?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  titleId?: string;
}) {
  return (
    <header className={cn("flex items-start justify-between gap-4 px-5 pt-5", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="num mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-dim">{eyebrow}</p>}
        <h2 id={titleId} className="text-[15px] font-semibold tracking-tight text-fg">
          {title}
        </h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("px-5 pb-5 pt-4", className)} {...props} />;
}
