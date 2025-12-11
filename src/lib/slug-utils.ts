export function slugify(text: string): string {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')        // Replace spaces with -
        .replace(/[^\w\-]+/g, '')    // Remove all non-word chars
        .replace(/\-\-+/g, '-');     // Replace multiple - with single -
}

export function deslugify(slug: string): string {
    return slug.replace(/-/g, ' ');
    // Note: This is lossy (capitalization, special chars). 
    // Better to use slug to look up the original object.
}
