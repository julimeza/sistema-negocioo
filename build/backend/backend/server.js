const express = require("express");
const path = require("path");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(express.json());

// Detectar producción en Tauri (por ahora no lo usamos mucho)
const isProd = process.env.TAURI_ENV === "production";

// Servir carpeta public
const publicPath = path.join(__dirname, "../public");
console.log("📁 PUBLIC PATH:", publicPath);
app.use(express.static(publicPath));

// Conexión a SQLite (db.js ya adaptado a Tauri 2)
const conexion = require("./db");

// ===================================================
//  CARGAR SCHEMA AL INICIO
// ===================================================
function ejecutarSchema() {
  try {
    const schemaPath = path.join(__dirname, "schema.sql");
    console.log("📄 Ejecutando schema:", schemaPath);
    const sql = fs.readFileSync(schemaPath, "utf8");

    conexion.exec(sql, (err) => {
      if (err) {
        console.error("❌ Error ejecutando schema.sql:", err.message);
      } else {
        console.log("✅ Tablas creadas / verificadas correctamente");
      }
      initPassword();
    });

  } catch (err) {
    console.error("❌ No se pudo leer schema.sql:", err.message);
  }
}
ejecutarSchema();

// ===================================================
//  PASSWORD SISTEMA
// ===================================================
async function initPassword() {
  try {
    const [rows] = await conexion.query(
      "SELECT COUNT(*) AS total FROM password_sistema"
    );
    if (rows[0].total === 0) {
      const hash = await bcrypt.hash("1234", 10); // contraseña inicial
      await conexion.query(
        "INSERT INTO password_sistema (clave_hash) VALUES (?)",
        [hash]
      );
      console.log("🔐 Contraseña inicial creada (1234)");
    } else {
      console.log("🔐 Password ya configurada");
    }
  } catch (err) {
    console.error("❌ Error inicializando password:", err);
  }
}

// validar contraseña
app.post("/api/pass/validar", async (req, res) => {
  try {
    const { pass } = req.body;
    const [rows] = await conexion.query(
      "SELECT clave_hash FROM password_sistema ORDER BY id DESC LIMIT 1"
    );
    if (!rows.length) return res.json({ ok: false });

    const ok = await bcrypt.compare(pass, rows[0].clave_hash);
    return res.json({ ok });
  } catch (err) {
    console.error("❌ Error validando password:", err);
    res.status(500).json({ ok: false, msg: "Error al validar contraseña" });
  }
});

// cambiar contraseña
app.post("/api/pass/cambiar", async (req, res) => {
  try {
    let { actual, nueva } = req.body;

    const [rows] = await conexion.query(
      "SELECT clave_hash FROM password_sistema ORDER BY id DESC LIMIT 1"
    );
    if (!rows.length) {
      return res.status(400).json({ ok: false, msg: "Sin password configurada" });
    }

    const hashActual = rows[0].clave_hash;

    // si viene token de master
    if (actual === "MASTER_BACKUP_PASS") {
      // se saltea el check
    } else {
      const ok = await bcrypt.compare(actual, hashActual);
      if (!ok) {
        return res.json({ ok: false, msg: "Contraseña actual incorrecta" });
      }
    }

    const nuevoHash = await bcrypt.hash(nueva, 10);
    await conexion.query(
      "INSERT INTO password_sistema (clave_hash) VALUES (?)",
      [nuevoHash]
    );

    res.json({ ok: true, msg: "Contraseña actualizada correctamente" });
  } catch (err) {
    console.error("❌ Error cambiando password:", err);
    res.status(500).json({ ok: false, msg: "Error al cambiar contraseña" });
  }
});

// ===================================================
//  PRODUCTOS
// ===================================================

// Obtener todos los productos (para stock, carga, etc.)
app.get("/api/productos", async (req, res) => {
  try {
    const [rows] = await conexion.query(`
      SELECT 
        id,
        nombre,
        tipo,
        codigo_barra,
        stock,
        stock_inicial,
        precio_costo,
        precio_venta,
        precio_unitario,
        costo_unitario,
        precio_kilo,
        costo_kilo,
        precio_gramo,
        costo_gramo
      FROM productos
      ORDER BY nombre ASC
    `);
    res.json(rows);
  } catch (err) {
    console.error("❌ Error obteniendo productos:", err);
    res.status(500).json({ error: "Error al obtener productos" });
  }
});


app.get("/api/productos/:id", async (req, res) => {
  try {
    const [rows] = await conexion.query(
      "SELECT * FROM productos WHERE id = ?",
      [req.params.id]
    );
    if (!rows.length)
      return res.status(404).json({ error: "Producto no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ error: "Error al obtener producto" });
  }
});

// Crear producto
app.post("/api/productos", async (req, res) => {
  try {
    let {
      nombre,
      tipo,
      codigo_barra = null,
      stock = 0,
      precio_costo = 0, // en sueltos: precio 100g
      precio_venta = 0  // en sueltos: precio 100g
    } = req.body;

    stock        = Number(stock) || 0;
    precio_costo = Number(precio_costo) || 0;
    precio_venta = Number(precio_venta) || 0;

    let precio_unitario = null;
    let costo_unitario  = null;
    let precio_kilo     = null;
    let costo_kilo      = null;
    let precio_gramo    = null;
    let costo_gramo     = null;

    if (String(tipo).toLowerCase().includes("suelto") && !tipo.includes("cigarro")) {
      // sueltos: se guarda precio 100g
      precio_kilo  = precio_venta * 10;
      costo_kilo   = precio_costo * 10;
      precio_unitario = precio_kilo;
      costo_unitario  = costo_kilo;
      precio_gramo = precio_kilo / 1000;
      costo_gramo  = costo_kilo / 1000;
    } else {
      precio_unitario = stock > 0 ? precio_venta / stock : precio_venta;
      costo_unitario  = stock > 0 ? precio_costo / stock : precio_costo;
    }

    const [r] = await conexion.query(
      `
      INSERT INTO productos (
        nombre, tipo, codigo_barra, stock,
        precio_costo, precio_venta,
        stock_inicial, precio_unitario, costo_unitario,
        precio_kilo, costo_kilo, precio_gramo, costo_gramo
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        nombre, tipo, codigo_barra, stock,
        precio_costo, precio_venta,
        stock, precio_unitario, costo_unitario,
        precio_kilo, costo_kilo, precio_gramo, costo_gramo
      ]
    );

    const [nuevo] = await conexion.query(
      "SELECT * FROM productos WHERE id = ?",
      [r.insertId]
    );
    res.json(nuevo[0]);
  } catch (err) {
    console.error("❌ Error guardando producto:", err);
    res.status(500).json({ error: "Error al guardar producto" });
  }
});

// Actualizar producto
app.put("/api/productos/:id", async (req, res) => {
  try {
    let {
      nombre,
      tipo,
      codigo_barra = null,
      stock = 0,
      precio_costo = 0,  // 100g en sueltos
      precio_venta = 0   // 100g en sueltos
    } = req.body;

    stock        = Number(stock) || 0;
    precio_costo = Number(precio_costo) || 0;
    precio_venta = Number(precio_venta) || 0;

    let precio_unitario = null;
    let costo_unitario  = null;
    let precio_kilo     = null;
    let costo_kilo      = null;
    let precio_gramo    = null;
    let costo_gramo     = null;

    if (String(tipo).toLowerCase().includes("suelto") && !tipo.includes("cigarro")) {
      precio_kilo  = precio_venta * 10;
      costo_kilo   = precio_costo * 10;
      precio_unitario = precio_kilo;
      costo_unitario  = costo_kilo;
      precio_gramo = precio_kilo / 1000;
      costo_gramo  = costo_kilo / 1000;
    } else {
      precio_unitario = stock > 0 ? precio_venta / stock : precio_venta;
      costo_unitario  = stock > 0 ? precio_costo / stock : precio_costo;
    }

    await conexion.query(
      `
      UPDATE productos SET
        nombre = ?, tipo = ?, codigo_barra = ?, stock = ?,
        precio_costo = ?, precio_venta = ?,
        stock_inicial = ?, precio_unitario = ?, costo_unitario = ?,
        precio_kilo = ?, costo_kilo = ?, precio_gramo = ?, costo_gramo = ?
      WHERE id = ?
      `,
      [
        nombre, tipo, codigo_barra, stock,
        precio_costo, precio_venta,
        stock, precio_unitario, costo_unitario,
        precio_kilo, costo_kilo, precio_gramo, costo_gramo,
        req.params.id
      ]
    );

    const [editado] = await conexion.query(
      "SELECT * FROM productos WHERE id = ?",
      [req.params.id]
    );
    res.json(editado[0]);
  } catch (err) {
    console.error("❌ Error actualizando producto:", err);
    res.status(500).json({ error: "Error al actualizar producto" });
  }
});

// Eliminar producto
app.delete("/api/productos/:id", async (req, res) => {
  try {
    await conexion.query("DELETE FROM productos WHERE id = ?", [req.params.id]);
    res.json({ mensaje: "Producto eliminado" });
  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ error: "Error al eliminar producto" });
  }
});

// ===================================================
//  REGISTRAR VENTA DESDE CARRITO
// ===================================================

app.post("/api/ventas/carrito", async (req, res) => {
  const { forma_pago, items } = req.body;

  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ ok: false, error: "Carrito vacío" });
  }

  try {
    for (const item of items) {
      const {
        producto_id,
        esSuelto,
        cantidad_unidades,
        cantidad_kg,
        cantidad_gramos
      } = item;

      const [rows] = await conexion.query(
        "SELECT * FROM productos WHERE id = ?",
        [producto_id]
      );
      if (!rows.length) {
        throw new Error(`Producto ID ${producto_id} no encontrado`);
      }

      const p = rows[0];
      const tipoStr = String(p.tipo || "").toLowerCase();
      const stockBD = Number(p.stock || 0);

      if (esSuelto || (tipoStr.includes("suelto") && !tipoStr.includes("cigarro"))) {
        const kg     = Number(cantidad_kg || 0);
        const gramos = Number(cantidad_gramos || 0) || kg * 1000;
        if (kg <= 0) throw new Error(`Cantidad inválida para ${p.nombre}`);
        if (stockBD < kg) throw new Error(`Stock insuficiente para ${p.nombre}`);

        const precioGramo = Number(p.precio_gramo || 0);
        const costoGramo  = Number(p.costo_gramo || 0);
        const precioPorKilo = precioGramo * 1000;

        const total    = gramos * precioGramo;
        const ganancia = gramos * (precioGramo - costoGramo);

        await conexion.query(
          `
          INSERT INTO ventas_sueltos (
            producto_id, nombre_producto, cantidad_gramos,
            precio_por_kilo, total, forma_pago, ganancia
          )
          VALUES (?, ?, ?, ?, ?, ?, ?)
          `,
          [
            producto_id,
            p.nombre,
            gramos,
            precioPorKilo,
            total,
            forma_pago,
            ganancia
          ]
        );

        await conexion.query(
          "UPDATE productos SET stock = stock - ? WHERE id = ?",
          [kg, producto_id]
        );
      } else if (tipoStr.includes("cigarro")) {
        const cantidad = Number(cantidad_unidades || 0);
        if (cantidad <= 0)
          throw new Error(`Cantidad inválida para ${p.nombre}`);
        if (stockBD < cantidad)
          throw new Error(`Stock insuficiente para ${p.nombre}`);

        const precioUnit =
          Number(p.precio_unitario || 0) ||
          (Number(p.precio_venta || 0) /
            (Number(p.stock_inicial || p.stock || 1)));
        const costoUnit =
          Number(p.costo_unitario || 0) ||
          (Number(p.precio_costo || 0) /
            (Number(p.stock_inicial || p.stock || 1)));

        const total    = cantidad * precioUnit;
        const ganancia = cantidad * (precioUnit - costoUnit);
        const tipoVenta = tipoStr.includes("suelto") ? "Suelto" : "Paquete";

        await conexion.query(
          `
          INSERT INTO ventas_cigarros (
            producto_id, nombre_producto, tipo, cantidad,
            precio_unitario, total, forma_pago, ganancia
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            producto_id,
            p.nombre,
            tipoVenta,
            cantidad,
            precioUnit,
            total,
            forma_pago,
            ganancia
          ]
        );

        await conexion.query(
          "UPDATE productos SET stock = stock - ? WHERE id = ?",
          [cantidad, producto_id]
        );
      } else {
        // generales
        const cantidad = Number(cantidad_unidades || 0);
        if (cantidad <= 0)
          throw new Error(`Cantidad inválida para ${p.nombre}`);
        if (stockBD < cantidad)
          throw new Error(`Stock insuficiente para ${p.nombre}`);

        const precioUnit =
          Number(p.precio_unitario || 0) ||
          (Number(p.precio_venta || 0) /
            (Number(p.stock_inicial || p.stock || 1)));
        const costoUnit =
          Number(p.costo_unitario || 0) ||
          (Number(p.precio_costo || 0) /
            (Number(p.stock_inicial || p.stock || 1)));

        const total    = cantidad * precioUnit;
        const ganancia = cantidad * (precioUnit - costoUnit);

        await conexion.query(
          `
          INSERT INTO ventas (
            producto_id, nombre_producto, tipo, cantidad,
            precio_unitario, total, ganancia, forma_pago
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            producto_id,
            p.nombre,
            p.tipo,
            cantidad,
            precioUnit,
            total,
            ganancia,
            forma_pago
          ]
        );

        await conexion.query(
          "UPDATE productos SET stock = stock - ? WHERE id = ?",
          [cantidad, producto_id]
        );
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("❌ Error en /api/ventas/carrito:", err);
    res.status(400).json({
      ok: false,
      error: err.message || "Error al procesar el carrito"
    });
  }
});

// ============================================================
// 🧂 SUELTOS
// ============================================================

app.get("/api/sueltos", async (req, res) => {
  try {
    const [rows] = await conexion.query(`
      SELECT *
      FROM productos
      WHERE LOWER(tipo) LIKE '%suelto%'
        AND stock > 0
        AND LOWER(nombre) NOT LIKE '%cigar%'
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

// Registrar venta suelta
app.post("/api/sueltos/venta", async (req, res) => {
  try {
    const { producto_id, cantidad_gramos, forma_pago, total, ganancia, precio_fijo_gramo } =
      req.body;

    const [prod] = await conexion.query("SELECT * FROM productos WHERE id=?", [
      producto_id,
    ]);

    if (!prod.length) return res.status(404).json({ error: "Producto no encontrado" });

    const p = prod[0];

    const gramos = Number(cantidad_gramos);
    const kilosARestar = gramos / 1000;

    // Validación CORRECTA
    if (kilosARestar > Number(p.stock)) {
      return res.status(400).json({ error: "Stock insuficiente" });
    }

    // CALCULAR PRECIO POR KILO CORRECTO
    const precioPorKilo = precio_fijo_gramo * 1000;

    // Registrar venta
    await conexion.query(
      `
      INSERT INTO ventas_sueltos
        (producto_id, nombre_producto, cantidad_gramos, precio_por_kilo,
         total, forma_pago, ganancia, fecha)
      VALUES (?, ?, ?, ?, ?, ?, ?, DATETIME('now','localtime'))
    `,
      [
        p.id,
        p.nombre,
        gramos,
        precioPorKilo,
        total,
        forma_pago,
        ganancia
      ]
    );

    // Descontar stock (en KILOS)
    const nuevoStock = Number(p.stock) - kilosARestar;

    await conexion.query("UPDATE productos SET stock=? WHERE id=?", [
      nuevoStock,
      p.id,
    ]);

    res.json({ mensaje: "Venta suelta registrada correctamente" });

  } catch (err) {
    console.error("❌ Error venta suelta:", err);
    res.status(500).json({ error: "Error venta suelta" });
  }
});

app.get("/api/sueltos/ventas", async (req, res) => {
  try {
    const fecha = req.query.fecha;

    const sql = fecha
      ? `SELECT *,
           strftime('%d/%m/%Y %H:%M', fecha) AS fecha
         FROM ventas_sueltos
         WHERE DATE(fecha) = DATE(?)
         ORDER BY fecha DESC`
      : `SELECT *,
           strftime('%d/%m/%Y %H:%M', fecha) AS fecha
         FROM ventas_sueltos
         ORDER BY fecha DESC`;

    const rows = await conexion.query(sql, fecha ? [fecha] : []);
    res.json(rows[0]);

  } catch (err) {
    console.error("❌ Error ventas sueltos:", err);
    res.json([]);
  }
});



// ============================================================
// 🚬 CIGARROS
// ============================================================

app.get("/api/cigarros", async (req, res) => {
  try {
    const [rows] = await conexion.query(`
      SELECT *
      FROM productos
      WHERE tipo LIKE '%cigarros%' AND stock > 0
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json([]);
  }
});

// Registrar venta cigarro
app.post("/api/cigarros/venta", async (req, res) => {
  try {
    const {
      producto_id, tipoVenta, cantidad,
      forma_pago, total, ganancia, precio_fijo_unitario
    } = req.body;

    // Obtener info del producto
    const [prod] = await conexion.query(
      "SELECT * FROM productos WHERE id=?",
      [producto_id]
    );

    if (!prod.length) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    const p = prod[0];

    // 🔥 CORREGIDO: usamos "fecha" porque tu tabla NO tiene "fecha_hora"
    await conexion.query(
      `
      INSERT INTO ventas_cigarros
        (producto_id, nombre_producto, tipo, cantidad, precio_unitario, total,
         forma_pago, ganancia, fecha)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATETIME('now','localtime'))
      `,
      [
        p.id,
        p.nombre,
        tipoVenta,
        cantidad,
        precio_fijo_unitario,
        total,
        forma_pago,
        ganancia
      ]
    );

    // Actualizar stock
    await conexion.query(
      "UPDATE productos SET stock = stock - ? WHERE id=?",
      [cantidad, p.id]
    );

    res.json({ mensaje: "Venta registrada" });

  } catch (err) {
    console.error("❌ Error venta cigarros:", err);
    res.status(500).json({ error: "Error registrando venta" });
  }
});
app.get("/api/cigarros/ventas", async (req, res) => {
  try {
    const fecha = req.query.fecha;

    const sql = fecha
      ? `SELECT *,
           strftime('%d/%m/%Y %H:%M', fecha) AS fecha
         FROM ventas_cigarros
         WHERE DATE(fecha) = DATE(?)
         ORDER BY fecha DESC`
      : `SELECT *,
           strftime('%d/%m/%Y %H:%M', fecha) AS fecha
         FROM ventas_cigarros
         ORDER BY fecha DESC`;

    const rows = await conexion.query(sql, fecha ? [fecha] : []);
    res.json(rows[0]);

  } catch (err) {
    console.error("❌ Error ventas cigarros:", err);
    res.json([]);
  }
});



// ============================================================
// 💵 VENTAS GENERALES
// ============================================================

// ---------------------------------------------------------
//  OBTENER VENTAS DEL DÍA O FECHA SELECCIONADA
// ---------------------------------------------------------
// ============================================================
// 🟦 /api/ventas — UNIFICADO (generales + sueltos + cigarros)
// ============================================================
app.get("/api/ventas", async (req, res) => {
  try {
    const { fecha } = req.query;

    const filtro = fecha
      ? `DATE(fecha) = DATE(?)`
      : `DATE(fecha) = DATE('now','localtime')`;

    const params = fecha ? [fecha] : [];

    const sql = `
      SELECT 
        strftime('%d/%m/%Y %H:%M', fecha) AS fecha,
        nombre_producto,
        tipo,
        cantidad,
        forma_pago,
        total,
        ganancia
      FROM (

        SELECT fecha, nombre_producto, tipo, cantidad, forma_pago, total, ganancia
        FROM ventas
        WHERE ${filtro}

        UNION ALL

        SELECT fecha, nombre_producto, 'suelto', cantidad_gramos, forma_pago, total, ganancia
        FROM ventas_sueltos
        WHERE ${filtro}

        UNION ALL

        SELECT fecha, nombre_producto, tipo, cantidad, forma_pago, total, ganancia
        FROM ventas_cigarros
        WHERE ${filtro}
      )
      ORDER BY fecha DESC
    `;

    const [rows] = await conexion.query(sql, params);
    res.json(rows);

  } catch (err) {
    console.error("❌ Error en /api/ventas:", err);
    res.status(500).json({ error: "Error obteniendo ventas" });
  }
});




// Registrar venta general
// ---------------------------------------------------------
// ============================================================
//  ENDPOINT ÚNICO PARA REGISTRAR CUALQUIER TIPO DE PRODUCTO
// ============================================================
app.post("/api/ventas", async (req, res) => {
  try {
    const { producto_id, cantidad, forma_pago, total, ganancia } = req.body;

    // Buscar producto
    const [prod] = await conexion.query(
      "SELECT * FROM productos WHERE id=?",
      [producto_id]
    );

    if (!prod.length) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    const p = prod[0];
    const tipo = (p.tipo || "").toLowerCase();

    // 📌 SUELTOS — guardar en ventas_sueltos
    if (tipo.includes("suelto") && !tipo.includes("cigarro")) {

      const gramos = Number(cantidad);
      const kgDesc = gramos / 1000;

      if (kgDesc > Number(p.stock)) {
        return res.status(400).json({ error: "Stock insuficiente" });
      }

      const precio100 = Number(p.precio_venta);
      const costo100  = Number(p.precio_costo);

      const precioGramo = precio100 / 100;
      const costoGramo  = costo100 / 100;

      const totalFinal = precioGramo * gramos;
      const gananciaFinal = (precioGramo - costoGramo) * gramos;

      await conexion.query(
        `
        INSERT INTO ventas_sueltos 
          (producto_id, nombre_producto, cantidad_gramos, precio_por_kilo,
           total, forma_pago, ganancia, fecha)
        VALUES (?, ?, ?, ?, ?, ?, ?, DATETIME('now','localtime'))
        `,
        [
          p.id,
          p.nombre,
          gramos,
          precioGramo * 1000,   // precio por kilo
          totalFinal,
          forma_pago,
          gananciaFinal
        ]
      );

      // actualizar stock (en KG)
      await conexion.query(
        "UPDATE productos SET stock = stock - ? WHERE id=?",
        [kgDesc, p.id]
      );

      return res.json({ ok: true, tipoGuardado: "sueltos" });
    }

    // 📌 CIGARROS — guardar en ventas_cigarros
    if (tipo.includes("cigarro")) {

      const cant = Number(cantidad);

      if (cant > Number(p.stock)) {
        return res.status(400).json({ error: "Stock insuficiente" });
      }

      const precioUnit = Number(p.precio_unitario);
      const costoUnit  = Number(p.costo_unitario);

      const totalFinal = precioUnit * cant;
      const gananciaFinal = (precioUnit - costoUnit) * cant;

      const tipoVenta = tipo.includes("suelto") ? "Suelto" : "Paquete";

      await conexion.query(
        `
        INSERT INTO ventas_cigarros
          (producto_id, nombre_producto, tipo, cantidad,
           precio_unitario, total, forma_pago, ganancia, fecha)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATETIME('now','localtime'))
        `,
        [
          p.id,
          p.nombre,
          tipoVenta,
          cant,
          precioUnit,
          totalFinal,
          forma_pago,
          gananciaFinal
        ]
      );

      await conexion.query(
        "UPDATE productos SET stock = stock - ? WHERE id=?",
        [cant, p.id]
      );

      return res.json({ ok: true, tipoGuardado: "cigarros" });
    }

    // 📌 GENERALES — guardar en ventas
    const cant = Number(cantidad);

    if (cant > Number(p.stock)) {
      return res.status(400).json({ error: "Stock insuficiente" });
    }

    const precioUnit = Number(p.precio_unitario);
    const costoUnit  = Number(p.costo_unitario);

    const totalFinal = precioUnit * cant;
    const gananciaFinal = (precioUnit - costoUnit) * cant;

    await conexion.query(
      `
      INSERT INTO ventas 
        (producto_id, nombre_producto, tipo, cantidad,
         precio_unitario, total, ganancia, forma_pago, fecha)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATETIME('now','localtime'))
      `,
      [
        p.id,
        p.nombre,
        p.tipo,
        cant,
        precioUnit,
        totalFinal,
        gananciaFinal,
        forma_pago
      ]
    );

    await conexion.query(
      "UPDATE productos SET stock = stock - ? WHERE id=?",
      [cant, p.id]
    );

    res.json({ ok: true, tipoGuardado: "generales" });

  } catch (err) {
    console.error("❌ Error registrando venta:", err);
    res.status(500).json({ error: "Error en venta" });
  }
});




// ============================================================
// 🔐 PASSWORD
// ============================================================

async function initPassword() {
  try {
    const [rows] = await conexion.query(
      "SELECT * FROM password_sistema LIMIT 1"
    );

    if (!rows.length) {
      const hash = await bcrypt.hash("juliemanuel2025", 10);
      await conexion.query(
        "INSERT INTO password_sistema (clave_hash) VALUES (?)",
        [hash]
      );
      console.log("🔐 Contraseña creada");
    }
  } catch (err) {
    console.error("Error password init:", err);
  }
}


app.post("/api/pass/validar", async (req, res) => {
  try {
    const [rows] = await conexion.query(
      "SELECT clave_hash FROM password_sistema LIMIT 1"
    );

    if (!rows.length) return res.json({ ok: false });

    const ok = await bcrypt.compare(req.body.pass, rows[0].clave_hash);

    res.json({ ok });
  } catch (err) {
    res.json({ ok: false });
  }
});

app.post("/api/pass/cambiar", async (req, res) => {
  try {
    const { actual, nueva } = req.body;

    if (!nueva || nueva.length < 4) {
      return res.status(400).json({ ok: false, msg: "Contraseña nueva inválida" });
    }

    // 1️⃣ Traer contraseña actual almacenada
    const [rows] = await conexion.query(
      "SELECT * FROM password_sistema LIMIT 1"
    );

    if (!rows.length) {
      return res.status(500).json({ ok: false, msg: "No existe registro de contraseña" });
    }

    const hashActual = rows[0].clave_hash;

    // 2️⃣ Si usó la clave de respaldo → saltar verificación
    let coincide = false;

    if (actual === "MASTER_BACKUP_PASS") {
      coincide = true;
    } else {
      coincide = await bcrypt.compare(actual, hashActual);
    }

    if (!coincide) {
      return res.json({ ok: false, msg: "Contraseña actual incorrecta" });
    }

    // 3️⃣ Guardar nueva contraseña en la base
    const nuevoHash = await bcrypt.hash(nueva, 10);

    await conexion.query(
      "UPDATE password_sistema SET clave_hash = ? WHERE id = ?",
      [nuevoHash, rows[0].id]
    );

    return res.json({ ok: true, msg: "Contraseña actualizada correctamente" });

  } catch (err) {
    console.error("❌ Error cambiando contraseña:", err);
    return res.status(500).json({ ok: false, msg: "Error en servidor" });
  }
});

// ============================================================
// SERVIR WEB
// ============================================================

app.get("/", (req, res) => {
  res.sendFile(path.join(publicPath, "index.html"));
});

// ============================================================
// SERVIDOR
// ============================================================

app.listen(3000, () =>
  console.log("🚀 Servidor corriendo en http://localhost:3000")
);
