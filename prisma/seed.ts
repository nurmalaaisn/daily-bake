import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    const hashedPassword = await bcrypt.hash('admin123', 10);

    await prisma.user.upsert({
        where: { email: 'admin@dailybake.com' },
        update: {},
        create: {
            name: 'Admin DailyBake',
            email: 'admin@dailybake.com',
            password: hashedPassword,
            role: 'ADMIN',
        },
    });

    await prisma.user.upsert({
        where: { email: 'baker@dailybake.com' },
        update: {},
        create: {
            name: 'Baker DailyBake',
            email: 'baker@dailybake.com',
            password: hashedPassword,
            role: 'BAKER',
        },
    });

    console.log('Seed berhasil — Admin id: 1, Baker id: 2');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());