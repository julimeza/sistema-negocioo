document.addEventListener("DOMContentLoaded", () => {
  const formVenta = document.getElementById("formVentaNormal");
  const selectProducto = document.getElementById("productoSelect");
  const stockDisponible = document.getElementById("stockDisponible");
  const cantidad = document.getElementById("cantidad");
  const formaPago = document.getElementById("formaPago");
  const total = document.getElementById("total");
  const tablaVentas = document.getElementById("tablaVentas");
  const totalVendido = document.getElementById("totalVendido");
  const totalGanancia = document.getElementById("totalGanancia");
  const tablaCarrito = document.getElementById("tablaCarrito");
  const subtotalCarrito = document.getElementById("subtotalCarrito");
  const btnAgregarCarrito = document.getElementById("btnAgregarCarrito");
  const btnVaciarCarrito = document.getElementById("btnVaciarCarrito");
  const fechaFiltro = document.getElementById("fechaFiltro");
  const btnBuscarFecha = document.getElementById("btnBuscarFecha");
  const btnHoy = document.getElementById("btnHoy");
  const btnValidarCaja = document.getElementById("btnValidarCaja");
  const passCaja = document.getElementById("passCaja");
  const contenidoCierreCaja = document.getElementById("contenidoCierreCaja");
  const inputScanner = document.getElementById("codigoScanner");

  formVenta.noValidate = true;

  let productos = [];
  let ventasLista = [];
  let carrito = [];
  let ultimoEscaneo = 0;

  document.addEventListener("click", () => {
    setTimeout(() => {
      if (!document.activeElement.closest("input, select, textarea")) {
        inputScanner.focus();
      }
    }, 150);
  });

  let bufferScanner = "";
  let ultimoTiempo = Date.now();

  document.addEventListener("keydown", (e) => {
    const ahora = Date.now();
    if (ahora - ultimoTiempo > 70) bufferScanner = "";
    ultimoTiempo = ahora;

    if (e.key === "Enter") {
      const code = bufferScanner.trim();
      bufferScanner = "";
      if (code.length >= 4) {
        ultimoEscaneo = Date.now();
        procesarScanner(code);
      }
      return;
    }

    if (/^[a-zA-Z0-9]$/.test(e.key)) {
      bufferScanner += e.key.toUpperCase();
    }
  });

  function toast(msg, tipo = "info") {
    const anterior = document.getElementById("toast-msg");
    if (anterior) anterior.remove();
    const div = document.createElement("div");
    div.id = "toast-msg";
    div.className = `toast text-white position-fixed top-50 start-50 translate-middle px-4 py-3 bg-${tipo} show`;
    div.style.zIndex = 9999;
    div.innerHTML = msg;
    document.body.appendChild(div);
    setTimeout(() => div.remove(), 1000);
  }

  function hoyLocalISO() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const da = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${da}`;
  }

  async function cargarProductos() {
    const res = await fetch("/api/productos");
    const data = await res.json();

    productos = data
      .filter((p) => {
        const tipo = (p.tipo || "").toLowerCase();
        let stockNum = parseFloat(p.stock);
        if (!stockNum || stockNum < 0) stockNum = 0;
        stockNum = parseFloat(stockNum.toFixed(4));
        if (tipo.includes("suelto") && !tipo.includes("cigarro")) {
          return stockNum * 1000 >= 1;
        }
        return stockNum >= 1;
      })
      .map((p) => ({
        ...p,
        codigo_barra: String(p.codigo_barra || ""),
      }));

    selectProducto.innerHTML = `<option value="">Seleccionar producto...</option>`;

    productos.forEach((p) => {
      let etiqueta = p.nombre;
      const t = p.tipo.toLowerCase();
      if (t.includes("suelto") && !t.includes("cigarro")) etiqueta += " (Suelto)";
      if (t.includes("cigarro")) {
        etiqueta += t.includes("suelto")
          ? " (Cigarro Suelto)"
          : " (Cigarro Paquete)";
      }
      const o = document.createElement("option");
      o.value = p.id;
      o.textContent = etiqueta;
      o.dataset.stock = p.stock;
      selectProducto.appendChild(o);
    });

    if ($(selectProducto).data("select2"))
      $(selectProducto).select2("destroy");

    $(selectProducto).select2({
      width: "100%",
      placeholder: "Buscar producto o escanear...",
    });

    $("#productoSelect").on("select2:select", function () {
      actualizarStockVisible();
      calcularTotal();
    });
  }

  function actualizarStockVisible() {
    const option = selectProducto.selectedOptions[0];
    if (!option) return (stockDisponible.value = "");

    const p = productos.find((prod) => String(prod.id) === String(option.value));
    if (!p || Number(p.stock) <= 0) {
      stockDisponible.value = "";
      total.value = "";
      cantidad.value = "";
      return;
    }

    const tipo = (p.tipo || "").toLowerCase();
    let stock = Number(p.stock);

    if (tipo.includes("suelto") && !tipo.includes("cigarro")) {
      const gr = stock * 1000;
      if (gr < 1) {
        stockDisponible.value = "";
        total.value = "";
        cantidad.value = "";
        return;
      }
      stockDisponible.value =
        stock < 1 ? `${Math.round(gr)} g` : `${stock.toFixed(2)} kg`;
      return;
    }

    if (stock < 1) {
      stockDisponible.value = "";
      total.value = "";
      cantidad.value = "";
      return;
    }

    stockDisponible.value = `${Math.floor(stock)} un.`;
  }

  function calcularTotal() {
    const p = productos.find((x) => String(x.id) === String(selectProducto.value));
    let val = cantidad.value.trim();
    if (!p || !val || Number(val) <= 0) return (total.value = "");

    const tipo = (p.tipo || "").toLowerCase();
    let totalFinal = 0;

    if (tipo.includes("suelto") && !tipo.includes("cigarro")) {
      const gramos = Number(val);
      if (gramos > p.stock * 1000) return toast("Stock insuficiente", "danger");
      totalFinal = (Number(p.precio_venta) / 100) * gramos;
    } else {
      if (Number(val) > Number(p.stock))
        return toast("Stock insuficiente", "danger");
      totalFinal = Number(p.precio_unitario) * Number(val);
    }

    if (formaPago.value === "Tarjeta Crédito") totalFinal *= 1.15;
    total.value = totalFinal.toFixed(2);
  }

  btnAgregarCarrito.addEventListener("click", () => {
    const p = productos.find((x) => String(x.id) === String(selectProducto.value));
    const cant = Number(cantidad.value);
    if (!p || !cant || cant <= 0) return toast("Cantidad inválida", "warning");

    const tipo = (p.tipo || "").toLowerCase();
    let cantidadReal = cant;
    let precioUnit = p.precio_unitario;
    let costoUnit = p.costo_unitario;

    if (tipo.includes("suelto") && !tipo.includes("cigarro")) {
      cantidadReal = cant >= 5 ? cant : cant * 1000;
      if (cantidadReal > p.stock * 1000)
        return toast("Stock insuficiente", "danger");
      precioUnit = p.precio_venta / 100;
      costoUnit = p.precio_costo / 100;
    }

    carrito.push({
      id: p.id,
      nombre: p.nombre,
      tipo: p.tipo,
      cantidad: cantidadReal,
      precio_unitario: precioUnit,
      costo_unitario: costoUnit,
      total: precioUnit * cantidadReal,
    });

    renderCarrito();
    cantidad.value = "";
    total.value = "";
    $(selectProducto).val("").trigger("change");
  });

  function renderCarrito() {
    tablaCarrito.innerHTML = "";
    if (carrito.length === 0) {
      tablaCarrito.innerHTML = `<tr><td colspan="6" class="text-center text-muted">Carrito vacío</td></tr>`;
      subtotalCarrito.textContent = "0.00";
      return;
    }

    carrito.forEach((i, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${i.nombre}</td>
        <td>${i.cantidad}</td>
        <td>$${i.precio_unitario.toFixed(2)}</td>
        <td>$${i.total.toFixed(2)}</td>
        <td><button class="btn btn-danger btn-sm" data-idx="${idx}">X</button></td>
      `;
      tablaCarrito.appendChild(tr);
    });

    tablaCarrito.querySelectorAll("button").forEach((b) =>
      b.addEventListener("click", () => {
        carrito.splice(b.dataset.idx, 1);
        renderCarrito();
      })
    );

    subtotalCarrito.textContent = carrito
      .reduce((a, b) => a + b.total, 0)
      .toFixed(2);
  }

  function procesarScanner(code) {
    const encontrados = productos.filter(
      (p) => String(p.codigo_barra) === String(code)
    );
    if (encontrados.length === 0)
      return toast("Producto no encontrado", "danger");
    agregarAlCarritoPorScanner(encontrados[0]);
  }

  function agregarAlCarritoPorScanner(p) {
    const tipo = (p.tipo || "").toLowerCase();
    const cant = tipo.includes("suelto") ? 100 : 1;
    const precio =
      tipo.includes("suelto") && !tipo.includes("cigarro")
        ? p.precio_venta / 100
        : p.precio_unitario;
    carrito.push({
      id: p.id,
      nombre: p.nombre,
      tipo: p.tipo,
      cantidad: cant,
      precio_unitario: precio,
      total: precio * cant,
    });
    renderCarrito();
  }

  (async () => {
    await cargarProductos();
    fechaFiltro.value = hoyLocalISO();
  })();
});
