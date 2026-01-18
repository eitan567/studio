import Link from 'next/link';
import { Suspense } from 'react';

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { UserAuthForm } from '@/components/user-auth-form';
import { Logo } from '@/components/icons';
import { Loader2 } from 'lucide-react';

function SignupFormFallback() {
  return (
    <div className="flex items-center justify-center p-8">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function SignupPage() {
  return (
    <div
      className="flex h-screen w-screen flex-col items-center justify-center bg-muted/30 dark:bg-muted/10"
      style={{
        backgroundImage: `
          linear-gradient(to right, hsl(var(--foreground) / 0.04) 1px, transparent 1px),
          linear-gradient(to bottom, hsl(var(--foreground) / 0.04) 1px, transparent 1px)
        `,
        backgroundSize: '20px 20px'
      }}
    >
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mb-4 flex justify-center">
            <Logo className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="heading">Create an Account</CardTitle>
          <CardDescription>
            Enter your details below to create your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<SignupFormFallback />}>
            <UserAuthForm mode="signup" />
          </Suspense>
        </CardContent>
        <CardFooter className="text-sm text-muted-foreground">
          <p>
            Already have an account?{' '}
            <Link
              href="/login"
              className="font-medium text-primary hover:underline"
            >
              Sign in
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
