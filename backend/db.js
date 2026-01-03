const path = require("path");
const sqlite3 = require("sqlite3").verbose();

// Detectar producción
const isProd = process.env.TAURI_ENV === "production";

let dbPath;

if (isProd) {
  // Cuando está instalado, Tauri siempre copia recursos en:
  // C:\Users\user\AppData\Local\Sistema Negocio\_up_\backend\databases\data.db
  dbPath = path.join(__dirname, "databases", "data.db");
} else {
  // En desarrollo (VSCode)
  dbPath = path.join(__dirname, "databases", "data.db");
}

console.log("📦 Usando base SQLite en:", dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("❌ Error abriendo SQLite:", err.message);
  } else {
    console.log("✅ SQLite conectado correctamente");
  }
});

// Query promisificada
db.query = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    const isSelect = sql.trim().toLowerCase().startsWith("select");

    if (isSelect) {
      db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve([rows]);
      });
    } else {
      db.run(sql, params, function (err) {
        if (err) reject(err);
        else resolve([{ insertId: this.lastID, changes: this.changes }]);
      });
    }
  });
};

module.exports = db;
