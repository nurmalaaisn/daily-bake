import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';

@Injectable()
export class CloudinaryService {
    constructor(private config: ConfigService) {
        cloudinary.config({
            cloud_name: this.config.get<string>('CLOUDINARY_CLOUD_NAME'),
            api_key: this.config.get<string>('CLOUDINARY_API_KEY'),
            api_secret: this.config.get<string>('CLOUDINARY_API_SECRET'),
        });
    }

    async uploadFile(file: Express.Multer.File): Promise<string> {
        return new Promise((resolve, reject) => {
            const upload = cloudinary.uploader.upload_stream(
                {
                    folder: 'dailybake/products',
                    resource_type: 'image',
                    transformation: [
                        { width: 800, height: 800, crop: 'limit' },
                        { quality: 'auto' },
                        { fetch_format: 'auto' },
                    ],
                },
                (error, result) => {
                    if (error) {
                        reject(
                            new BadRequestException(
                                `Upload gagal: ${error.message}`,
                            ),
                        );
                        return;
                    }

                    if (!result) {
                        reject(
                            new BadRequestException(
                                'Upload gagal: hasil upload kosong',
                            ),
                        );
                        return;
                    }

                    resolve(result.secure_url);
                },
            );

            const stream = Readable.from(file.buffer);
            stream.pipe(upload);
        });
    }

    async deleteFile(imageUrl: string): Promise<void> {
        try {
            const urlParts = imageUrl.split('/');
            const uploadIndex = urlParts.indexOf('upload');

            if (uploadIndex === -1) return;

            const pathWithVersion = urlParts
                .slice(uploadIndex + 1)
                .join('/');

            const publicId = pathWithVersion
                .replace(/^v\d+\//, '')
                .replace(/\.[^/.]+$/, '');

            await cloudinary.uploader.destroy(publicId);
        } catch {
            console.warn(
                'Gagal menghapus file dari Cloudinary:',
                imageUrl,
            );
        }
    }
}