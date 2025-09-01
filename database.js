const mysql = require('mysql2');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const promisePool = pool.promise();

const testConnection = async () => {
    try {
        const connection = await promisePool.getConnection();
        console.log('✓ Conexión a MySQL exitosa');
        connection.release();
        return true;
    } catch (error) {
        console.error('✗ Error conectando a MySQL:', error.message);
        return false;
    }
};

module.exports = {
    pool: promisePool,
    testConnection
};