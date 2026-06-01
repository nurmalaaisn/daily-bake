import { BadRequestException } from '@nestjs/common';

export const imageFileFilter = (
    _req: any,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.mimetype)) {
        return callback(
            new BadRequestException('Hanya file JPG, PNG, atau WEBP yang diizinkan'),
            false,
        );
    }
    callback(null, true);
};

export const maxFileSize = 2 * 1024 * 1024; // 2MB