'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Lock } from 'lucide-react';

export default function ComingSoonPage() {
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const response = await fetch('/api/verify-site-access', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ password }),
            });

            const data = await response.json();

            if (response.ok && data.success) {
                // Redirect to home page on success
                router.push('/');
                router.refresh(); // Refresh to update middleware state
            } else {
                setError('Incorrect password. Please try again.');
                setIsLoading(false);
            }
        } catch (err) {
            setError('An error occurred. Please try again.');
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 font-sans">
            <div className="absolute inset-0 z-0 opacity-10">
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-purple-600 blur-3xl" />
            </div>

            <Card className="z-10 w-full max-w-md border-muted-foreground/20 shadow-xl">
                <CardHeader className="text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                        <Lock className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="heading-lg">Coming Soon</CardTitle>
                    <CardDescription className="text-lg">
                        We are building something amazing. <br />
                        Please enter your access code to view the site.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Input
                                type="password"
                                placeholder="Enter password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="text-center text-lg"
                                autoFocus
                            />
                            {error && <p className="text-sm text-destructive text-center font-medium">{error}</p>}
                        </div>
                        <Button type="submit" className="w-full font-bold h-11" disabled={isLoading || !password}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Verifying...
                                </>
                            ) : (
                                'Unlock Access'
                            )}
                        </Button>
                    </form>
                    <div className="mt-6 text-center text-xs text-muted-foreground">
                        &copy; {new Date().getFullYear()} Albomit. All rights reserved.
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
