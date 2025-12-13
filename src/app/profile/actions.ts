/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
'use server';

import { auth } from "@/auth";
import { getUser, addUser, User, BrandingConfig } from "@/lib/user-store";
import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import crypto from 'crypto';

export async function updateBrandingAction(formData: FormData) {
    try {
        const session = await auth();
        // 1. Auth Check
        if (!session?.user?.email) {
            return { success: false, error: "Unauthorized" };
        }

        // 2. Parse Form Data
        const companyName = formData.get('companyName') as string;
        const footerText = formData.get('footerText') as string;
        const logoFile = formData.get('logoFile') as File;

        // Colors
        const colorPrimary = formData.get('color_primary') as string;
        const colorSecondary = formData.get('color_secondary') as string;
        const colorAccent = formData.get('color_accent') as string;

        // Custom Headings & Content
        const mainHeading = formData.get('mainHeading') as string;
        const subHeading = formData.get('subHeading') as string;
        const contentText = formData.get('contentText') as string;

        console.log("SERVER ACTION: Update Branding Received:", {
            companyName, footerText, hasLogoFile: !!logoFile, logoSize: logoFile?.size,
            colors: { colorPrimary, colorSecondary, colorAccent }
        });

        let logoUrl = undefined;

        // 3. Handle File Upload (if provided)
        if (logoFile && logoFile.size > 0) {
            // Validate Size (Max 4MB)
            if (logoFile.size > 4 * 1024 * 1024) {
                return { success: false, error: "Logo file too large. Max 4MB." };
            }

            // Validate Type
            if (!logoFile.type.startsWith('image/')) {
                return { success: false, error: "Invalid file type. Please upload an image." };
            }

            // Upload to Vercel Blob
            const blob = await put(`logos/${session.user.email}-${Date.now()}-${logoFile.name}`, logoFile, {
                access: 'public',
            });
            logoUrl = blob.url;
        }

        // 4. Update User Record
        const currentUser = await getUser(session.user.email);

        if (!currentUser) {
            return { success: false, error: "User not found" };
        }

        // Merge Branding
        const newBranding = {
            ...currentUser.branding,
            ...(companyName !== null && { companyName }),
            ...(footerText !== null && { footerText }),
            ...(logoUrl && { logoUrl }), // URL needs to be valid if present, but we might want to keep old if not provided? logic below handles file upload only if present.
            colors: {
                primary: colorPrimary || currentUser.branding?.colors?.primary || '#0f172a',
                secondary: colorSecondary || currentUser.branding?.colors?.secondary || '#334155',
                accent: colorAccent || currentUser.branding?.colors?.accent || '#f97316'
            },
            customHeadings: {
                mainHeading: mainHeading !== null ? mainHeading : (currentUser.branding?.customHeadings?.mainHeading || 'Strategic Hardware Acquisition'),
                subHeading: subHeading !== null ? subHeading : (currentUser.branding?.customHeadings?.subHeading || 'Prepared For'),
                contentText: contentText !== null ? contentText : (currentUser.branding?.customHeadings?.contentText || '')
            }
        };

        const updatedUser: User = {
            ...currentUser,
            branding: newBranding
        };

        // Save (addUser overwrites)
        await addUser(updatedUser);

        revalidatePath('/profile');
        revalidatePath('/price-list');

        return { success: true };
    } catch (e: any) {
        console.error("Update Branding Error:", e);
        return { success: false, error: e.message || "Failed to update branding" };
    }
}

export async function saveTemplateAction(formData: FormData) {
    try {
        const session = await auth();
        if (!session?.user?.email) {
            return { success: false, error: "Not authenticated" };
        }

        const email = session.user.email;
        const currentUser = await getUser(email);
        if (!currentUser) return { success: false, error: "User not found" };

        const templateName = formData.get('templateName') as string;
        if (!templateName) return { success: false, error: "Template name is required" };

        // Check Limit
        const currentTemplates = currentUser.savedTemplates || [];
        if (currentTemplates.length >= 10) {
            return { success: false, error: "Template limit reached (Max 10). Please delete a template to save a new one." };
        }

        // Colors
        const colorPrimary = formData.get('color_primary') as string;
        const colorSecondary = formData.get('color_secondary') as string;
        const colorAccent = formData.get('color_accent') as string;

        // Headings
        const mainHeading = formData.get('mainHeading') as string;
        const subHeading = formData.get('subHeading') as string;
        const contentText = formData.get('contentText') as string;

        // Additional Text
        const companyName = formData.get('companyName') as string;
        const footerText = formData.get('footerText') as string;

        const newTemplate: BrandingConfig = {
            id: crypto.randomUUID(),
            templateName,
            createdAt: new Date().toISOString(),
            companyName: companyName || currentUser.branding?.companyName,
            footerText: footerText || currentUser.branding?.footerText,
            logoUrl: currentUser.branding?.logoUrl, // Reuse existing logo URL
            colors: {
                primary: colorPrimary || '#0f172a',
                secondary: colorSecondary || '#334155',
                accent: colorAccent || '#f97316'
            },
            customHeadings: {
                mainHeading: mainHeading || 'Strategic Hardware Acquisition',
                subHeading: subHeading || 'Prepared For',
                contentText: contentText || ''
            }
        };

        const updatedTemplates = [...currentTemplates, newTemplate];
        const updatedUser: User = { ...currentUser, savedTemplates: updatedTemplates };

        await addUser(updatedUser);
        revalidatePath('/profile');
        return { success: true };
    } catch (e: any) {
        console.error("Save Template Error:", e);
        return { success: false, error: e.message || "Failed to save template" };
    }
}

export async function deleteTemplateAction(templateId: string) {
    try {
        const session = await auth();
        if (!session?.user?.email) return { success: false, error: "Not authenticated" };

        const currentUser = await getUser(session.user.email);
        if (!currentUser) return { success: false, error: "User not found" };

        const updatedTemplates = (currentUser.savedTemplates || []).filter(t => t.id !== templateId);

        const updatedUser: User = { ...currentUser, savedTemplates: updatedTemplates };
        await addUser(updatedUser);
        revalidatePath('/profile');
        return { success: true };
    } catch (e: any) {
        console.error("Delete Template Error:", e);
        return { success: false, error: e.message || "Failed to delete template" };
    }
}
