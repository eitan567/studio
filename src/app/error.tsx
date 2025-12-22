'use client';

import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
      <div className="rounded-lg border bg-card p-8 text-center shadow-lg">
        <h2 className="mb-4 text-2xl font-bold text-destructive">
          Oops! Something went wrong.
        </h2>
        <p className="mb-6 text-muted-foreground">
          An unexpected error occurred. Please try again.
        </p>
        <Button onClick={() => reset()}>Try again</Button>
      </div>
    </div>
  );
}
