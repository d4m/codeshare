const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./server/code.db');
db.run('CREATE TABLE IF NOT EXISTS code(id text, value text, mode text, create_date text, modify_date text, create_ip, modify_ip, UNIQUE ("id"))');

module.exports = db;
