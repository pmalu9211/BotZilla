// database.js
require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'rootpassword',
  database: process.env.MYSQL_DATABASE || 'meetings_db',
  port: process.env.MYSQL_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function initDatabase() {
  try {
    // Table for storing the host’s Google tokens.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        email VARCHAR(255),
        tokens TEXT
      )
    `);

    // Table for storing meeting records.
    await pool.query(`
      CREATE TABLE IF NOT EXISTS meetings (
        id INT PRIMARY KEY AUTO_INCREMENT,
        google_event_id VARCHAR(255),
        summary VARCHAR(255),
        start DATETIME,
        end DATETIME,
        hangoutLink VARCHAR(255)
      )
    `);

    console.log("Database tables ensured.");
  } catch (error) {
    console.error("Error initializing database:", error);
  }
}

initDatabase();

module.exports = pool;
