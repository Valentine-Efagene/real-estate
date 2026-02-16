const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function main() {
    const prisma = new PrismaClient();
    const user = await prisma.user.findUnique({
        where: { email: 'adaeze@mailsac.com' },
    });
    
    if (!user) {
        console.log('USER NOT FOUND!');
        await prisma.$disconnect();
        return;
    }
    
    const pw = user.password || '';
    console.log('User email:', user.email);
    console.log('firstName:', user.firstName);
    console.log('isActive:', user.isActive);
    console.log('emailVerifiedAt:', user.emailVerifiedAt);
    console.log('Hash prefix:', pw.substring(0, 20));
    console.log('Hash length:', pw.length);
    
    const isValid = await bcrypt.compare('password', pw);
    console.log('bcrypt.compare result:', isValid);
    
    await prisma.$disconnect();
}

main().catch(console.error);
