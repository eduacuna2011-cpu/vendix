export default function middleware(request) {
    const host = request.headers.get('host') || '';
    if (host.startsWith('inventory-sales-dashboard-postgres.vercel.app')) {
        const url = new URL(request.url);
        url.host = 'vendix-app.vercel.app';
        return Response.redirect(url.toString(), 301);
    }
}

export const config = { matcher: '/:path*' };
