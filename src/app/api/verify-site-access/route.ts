import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { password } = body;

        // Hardcoded password as requested: 567567567
        if (password === '567567567') {
            const response = NextResponse.json({ success: true });

            // Set a long-lived cookie to bypass the coming soon page
            response.cookies.set('site_access_granted', 'true', {
                httpOnly: true, // Not accessible via client-side JS (more secure)
                secure: process.env.NODE_ENV === 'production', // Only over HTTPS in production
                path: '/',
                maxAge: 60 * 60 * 24 * 30, // 30 days
                sameSite: 'lax',
            });

            return response;
        }

        return NextResponse.json(
            { success: false, message: 'Invalid password' },
            { status: 401 }
        );
    } catch (error) {
        return NextResponse.json(
            { success: false, message: 'Internal server error' },
            { status: 500 }
        );
    }
}
