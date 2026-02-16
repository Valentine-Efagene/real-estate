const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function main() {
    const url = new URL(process.env.DATABASE_URL);
    const conn = await mysql.createConnection({
        host: url.hostname,
        port: parseInt(url.port || '3306'),
        user: url.username,
        password: url.password,
        database: url.pathname.replace('/', ''),
    });

    const [rows] = await conn.query(
        'SELECT id, email, firstName, isActive, isEmailVerified, emailVerifiedAt, password FROM User WHERE email = ?',
        ['adaeze@mailsac.com']
    );

    if (rows.length === 0) {
        console.log('USER NOT FOUND!');
        await conn.end();
        return;
    }

    const user = rows[0];
    console.log('email:', user.email);
    console.log('firstName:', user.firstName);
    console.log('isActive:', user.isActive);
    console.log('emailVerifiedAt:', user.emailVerifiedAt);
    console.log('password hash prefix:', user.password.substring(0, 30));
    console.log('password hash length:', user.password.length);

    const isValid = await bcrypt.compare('password', user.password);
    console.log('bcrypt.compare("password"):', isValid);

    await conn.end();
}

main().catch(console.error);
