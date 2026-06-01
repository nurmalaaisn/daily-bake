import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
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
                (error, result: UploadApiResponse) => {
                    if (error) {
                        reject(new BadRequestException(`Upload gagal: ${error.message}`));
                    } else {
                        resolve(result.secure_url);
                    }
                },
            );

            const stream = Readable.from(file.buffer);
            stream.pipe(upload);
        });
    }

    async deleteFile(imageUrl: string): Promise<void> {
        try {
            // Ambil public_id dari URL Cloudinary
            // Format URL: https://res.cloudinary.com/cloud-name/image/upload/v123/dailybake/products/filename.jpg
            const urlParts = imageUrl.split('/');
            const uploadIndex = urlParts.indexOf('upload');
            if (uploadIndex === -1) return;

            // Ambil bagian setelah "upload/vXXXXXX/"
            const pathWithVersion = urlParts.slice(uploadIndex + 1).join('/');
            // Hapus versi (vXXXXXX/) jika ada
            const publicId = pathWithVersion.replace(/^v\d+\//, '').replace(/\.[^/.]+$/, '');

            await cloudinary.uploader.destroy(publicId);
        } catch {
            // Jika hapus gagal, tidak perlu throw error — lanjutkan proses
            console.warn('Gagal menghapus file dari Cloudinary:', imageUrl);
        }
    }
}