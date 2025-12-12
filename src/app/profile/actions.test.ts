
import { updateBrandingAction, saveTemplateAction } from './actions';
import { getUser, addUser } from '@/lib/user-store';
import { auth } from '@/auth';

// Mock dependencies
jest.mock('@/lib/user-store');
jest.mock('@/auth');
jest.mock('@vercel/blob', () => ({
    put: jest.fn().mockResolvedValue({ url: 'http://blob.url/image.png' }),
}));
jest.mock('next/cache', () => ({
    revalidatePath: jest.fn(),
}));

describe('Profile Actions', () => {
    const mockUser = {
        email: 'test@example.com',
        role: 'reseller',
        branding: {
            companyName: 'Old Company',
            footerText: 'Old Footer',
            colors: { primary: '#000', secondary: '#111', accent: '#222' },
            customHeadings: {
                mainHeading: 'Old Main',
                subHeading: 'Old Sub',
                contentText: 'Old Content',
            },
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
        (auth as jest.Mock).mockResolvedValue({ user: { email: 'test@example.com' } });
        (getUser as jest.Mock).mockResolvedValue(mockUser);
        (addUser as jest.Mock).mockResolvedValue(undefined);
    });

    describe('updateBrandingAction', () => {
        it('should update fields correctly', async () => {
            const formData = new FormData();
            formData.append('companyName', 'New Company');
            formData.append('footerText', 'New Footer');

            const result = await updateBrandingAction(formData);

            expect(result.success).toBe(true);
            expect(addUser).toHaveBeenCalledWith(expect.objectContaining({
                branding: expect.objectContaining({
                    companyName: 'New Company',
                    footerText: 'New Footer',
                }),
            }));
        });

        it('should allow clearing fields (sending empty strings)', async () => {
            const formData = new FormData();
            formData.append('companyName', ''); // Send empty string
            formData.append('footerText', '');

            const result = await updateBrandingAction(formData);

            expect(result.success).toBe(true);
            expect(addUser).toHaveBeenCalledWith(expect.objectContaining({
                branding: expect.objectContaining({
                    companyName: '', // Should be empty
                    footerText: '',
                }),
            }));
        });

        it('should retain old values if fields are not present in FormData (null)', async () => {
            const formData = new FormData();
            // companyName NOT appended
            formData.append('footerText', 'Updated Footer');

            const result = await updateBrandingAction(formData);

            expect(result.success).toBe(true);
            expect(addUser).toHaveBeenCalledWith(expect.objectContaining({
                branding: expect.objectContaining({
                    companyName: 'Old Company', // Retained
                    footerText: 'Updated Footer',
                }),
            }));
        });
    });

    describe('saveTemplateAction', () => {
        it('should save a new template', async () => {
            const formData = new FormData();
            formData.append('templateName', 'My Template');
            formData.append('companyName', 'Templated Company');

            const result = await saveTemplateAction(formData);

            expect(result.success).toBe(true);
            expect(addUser).toHaveBeenCalledWith(expect.objectContaining({
                savedTemplates: expect.arrayContaining([
                    expect.objectContaining({
                        templateName: 'My Template',
                        companyName: 'Templated Company',
                    }),
                ]),
            }));
        });

        it('should enforce template limit', async () => {
            const fullTemplates = Array(10).fill({ id: 't', templateName: 't' });
            (getUser as jest.Mock).mockResolvedValue({ ...mockUser, savedTemplates: fullTemplates });

            const formData = new FormData();
            formData.append('templateName', 'Overflow Template');

            const result = await saveTemplateAction(formData);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Template limit reached');
        });
    });
});
