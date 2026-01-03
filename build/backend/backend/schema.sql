PRAGMA foreign_keys = ON;

-- ====================================
-- 🔹 TABLA PRODUCTOS
-- ====================================
CREATE TABLE IF NOT EXISTS productos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,

  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL,
  codigo_barra TEXT,

  stock REAL DEFAULT 0,
  precio_costo REAL DEFAULT 0,
  precio_venta REAL DEFAULT 0,

  stock_inicial REAL DEFAULT 0,

  precio_unitario REAL,
  costo_unitario REAL,

  precio_kilo REAL,
  costo_kilo REAL,

  precio_gramo REAL,
  costo_gramo REAL
);

-- ====================================
-- 🔹 TABLA VENTAS GENERALES
-- ====================================
CREATE TABLE IF NOT EXISTS ventas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id INTEGER,

  nombre_producto TEXT,
  tipo TEXT,
  cantidad REAL,

  precio_unitario REAL,
  total REAL,
  ganancia REAL,

  forma_pago TEXT,

  fecha TEXT DEFAULT (datetime('now','localtime')),

  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE SET NULL
);

-- ====================================
-- 🔹 VENTAS SUELTOS
-- ====================================
CREATE TABLE IF NOT EXISTS ventas_sueltos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id INTEGER NOT NULL,

  nombre_producto TEXT NOT NULL,
  cantidad_gramos REAL,
  precio_por_kilo REAL,

  total REAL,
  forma_pago TEXT,
  ganancia REAL,

  fecha TEXT DEFAULT (datetime('now','localtime')),

  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
);

-- ====================================
-- 🔹 VENTAS CIGARROS
-- ====================================
CREATE TABLE IF NOT EXISTS ventas_cigarros (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id INTEGER NOT NULL,

  nombre_producto TEXT NOT NULL,
  tipo TEXT DEFAULT 'Paquete',
  cantidad REAL NOT NULL,

  precio_unitario REAL NOT NULL,
  total REAL NOT NULL,
  forma_pago TEXT NOT NULL,
  ganancia REAL NOT NULL,

  fecha TEXT DEFAULT (datetime('now','localtime')),

  FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE
);

-- ====================================
-- 🔹 PASSWORD
-- ====================================
CREATE TABLE IF NOT EXISTS password_sistema (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clave_hash TEXT NOT NULL
);
