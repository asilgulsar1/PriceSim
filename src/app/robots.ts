import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.asic.ae';

    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: [
                '/admin-dashboard/',
                '/price-simulator/',
                '/treasury/',
                '/api/', // Generally hide APIs unless public documentation needed? Safe to hide.
                '/login',
            ],
        },
        sitemap: `${baseUrl}/sitemap.xml`,
    };
}
