import { Logo } from '@/components/icons';
import { cn } from '@/lib/utils';

export function SiteFooter({ className }: React.HTMLAttributes<HTMLElement>) {
  return (
    <footer className={cn('bg-card', className)}>
      <div className="mx-auto flex w-full max-w-screen-2xl flex-col items-center justify-between gap-4 px-4 py-10 md:h-24 md:flex-row md:px-6 md:py-0">
        <div className="flex flex-col items-center gap-4 md:flex-row md:gap-2">
          <Logo className="h-6 w-6 text-primary" />
          <p className="text-center text-sm leading-loose text-muted-foreground md:text-left">
            Built by your friendly neighborhood AI.
          </p>
        </div>
        <p className="text-center text-sm text-muted-foreground md:text-left">
          © {new Date().getFullYear()} Albomit, Inc. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
