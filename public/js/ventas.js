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

  document.addEventListener("hidden.bs.modal", (e) => {
    const id = e.target.id;
    if (
      id === "modalCierreCajaView" ||
      id === "modalOpcionesCaja" ||
      id === "modalPasswordCaja"
    ) {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    }
  });

  let bufferScanner = "";
  let ultimoTiempo = Date.now();

  document.addEventListener("keydown", (e) => {
    const ahora = Date.now();

    if (ahora - ultimoTiempo > 70) {
      bufferScanner = "";
    }
    ultimoTiempo = ahora;

    if (e.key === "Enter") {
      const code = bufferScanner.trim();
      bufferScanner = "";

      if (code.length >= 4) {
        ultimoEscaneo = Date.now(); // 🔥 CLAVE
        procesarScanner(code);
      }
      return;
    }

    if (/^[a-zA-Z0-9]$/.test(e.key)) {
      bufferScanner += e.key.toUpperCase();
    }
  });

  function mostrarCierre(titulo, lista) {
    const contenido = document.getElementById("contenidoCierreCaja");

    if (!lista.length) {
      contenido.innerHTML = `
      <p class="text-center text-muted py-4">Sin ventas registradas</p>
    `;
      return new bootstrap.Modal(
        document.getElementById("modalCierreCaja")
      ).show();
    }

    let total = 0,
      ganancia = 0;
    let efectivo = 0,
      transferencia = 0,
      debito = 0,
      credito = 0;

    lista.forEach((v) => {
      total += Number(v.total);
      ganancia += Number(v.ganancia);

      const fp = (v.forma_pago || "").toLowerCase();
      if (fp.includes("efectivo")) efectivo += Number(v.total);
      if (fp.includes("transfer")) transferencia += Number(v.total);
      if (fp.includes("debito") || fp.includes("débito"))
        debito += Number(v.total);
      if (fp.includes("credito") || fp.includes("crédito"))
        credito += Number(v.total);
    });

    // 👉 CORREGIR FECHA A dd/mm/aaaa
    const fechaISO = fechaFiltro.value || hoyLocalISO();
    const [year, month, day] = fechaISO.split("-");
    const fecha = `${day}/${month}/${year}`;

    contenido.innerHTML = `
    <p class="cierre-fecha">Fecha seleccionada: <b>${fecha}</b></p>

    <div class="cierre-grid">
      <div class="cierre-card">
        <div class="cierre-titulo">Efectivo</div>
        <div class="cierre-valor">$${efectivo.toFixed(2)}</div>
      </div>

      <div class="cierre-card">
        <div class="cierre-titulo">Transferencia</div>
        <div class="cierre-valor">$${transferencia.toFixed(2)}</div>
      </div>

      <div class="cierre-card">
        <div class="cierre-titulo">Tarjeta Débito</div>
        <div class="cierre-valor">$${debito.toFixed(2)}</div>
      </div>

      <div class="cierre-card">
        <div class="cierre-titulo">Tarjeta Crédito</div>
        <div class="cierre-valor">$${credito.toFixed(2)}</div>
      </div>
    </div>

    <div class="cierre-resumen mt-3">
      <h5>Resumen general</h5>
      <p class="total">Total vendido: <b>$${total.toFixed(2)}</b></p>
      <p class="ganancia">Ganancia total: <b>$${ganancia.toFixed(2)}</b></p>
    </div>
  `;

    new bootstrap.Modal(document.getElementById("modalCierreCaja")).show();
  }
  function mostrarModalSeleccionProducto(lista) {
    const cont = document.getElementById("listaOpcionesProducto");
    cont.innerHTML = ""; // Limpiar la lista de opciones antes de agregar nuevas

    lista.forEach((p) => {
      const tipo = (p.tipo || "").toLowerCase();
      let precioTxt = "";

      if (tipo.includes("suelto") && !tipo.includes("cigarro")) {
        precioTxt = `$${Math.round(p.precio_venta)} / 100g`;
      } else {
        precioTxt = `$${Math.round(p.precio_unitario)} / unidad`;
      }

      // Botón para elegir el producto
      const btn = document.createElement("button");
      btn.className = "btn btn-outline-primary text-start p-3";
      btn.innerHTML = `
      <div class="fw-bold">${p.nombre}</div>
      <div class="small text-muted">
      
      </div>
      <div class="text-center">Elegir</div>
    `;

      // Acción del botón
      btn.addEventListener("click", () => {
        const modal = bootstrap.Modal.getInstance(
          document.getElementById("modalElegirProducto")
        );
        modal.hide();

        mostrarPrecioYAgregar(p); // Agregar el producto seleccionado
      });

      cont.appendChild(btn); // Agregar el botón al modal
    });

    const modal = new bootstrap.Modal(
      document.getElementById("modalElegirProducto"),
      { backdrop: "static", keyboard: false }
    );
    modal.show();
  }

  // ===============================
  // 📊 OBTENER CIERRE DE CAJA SEGÚN TIPO
  // ===============================
  async function cargarCierre(tipo) {
    const fecha = fechaFiltro.value || hoyLocalISO();
    let url = "";

    if (tipo === "general") {
      url = `/api/ventas?fecha=${fecha}`;
    }
    if (tipo === "sueltos") {
      url = `/api/sueltos/ventas?fecha=${fecha}`;
    }
    if (tipo === "cigarros") {
      url = `/api/cigarros/ventas?fecha=${fecha}`;
    }

    const lista = await fetch(url).then((r) => r.json());

    let titulo = "";
    if (tipo === "general") titulo = "Cierre de Caja – Productos Generales";
    if (tipo === "sueltos") titulo = "Cierre de Caja – Sueltos";
    if (tipo === "cigarros") titulo = "Cierre de Caja – Cigarros";

    mostrarCierre(titulo, lista);
  }

  document
    .getElementById("btnCajaGeneral")
    .addEventListener("click", () => cargarCierre("general"));
  document
    .getElementById("btnCajaSueltos")
    .addEventListener("click", () => cargarCierre("sueltos"));
  document
    .getElementById("btnCajaCigarros")
    .addEventListener("click", () => cargarCierre("cigarros"));

  // ===============================
  // 🔵 SCANNER SOLO PARA CONSULTAR PRECIOS
  // ===============================

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
    try {
      const res = await fetch("/api/productos");
      const data = await res.json();

      // 🧠 FILTRAR productos con stock real
      productos = data
        .filter((p) => {
          const tipo = (p.tipo || "").toLowerCase();
          let stockNum = parseFloat(p.stock);

          // ⚠️ si el stock viene raro, vacío o negativo
          if (!stockNum || stockNum < 0) stockNum = 0;

          // 🧮 redondear basura flotante como 0.004321
          stockNum = parseFloat(stockNum.toFixed(4));

          // 🟡 SUELTOS (alimentos)
          if (tipo.includes("suelto") && !tipo.includes("cigarro")) {
            const stockGramos = stockNum * 1000;
            return stockGramos >= 1; // 👉 tiene que quedar al menos 1 gramo
          }

          // 🔵 UNIDADES (generales y cigarros)
          return stockNum >= 1; // 👉 tiene que quedar al menos 1 unidad
        })
        .map((p) => ({
          ...p,
          codigo_barra: String(p.codigo_barra || ""),
        }));

      // 🧹 Limpiar y reconstruir el select
      selectProducto.innerHTML = `<option value="">Seleccionar producto...</option>`;

      productos.forEach((p) => {
        let etiqueta = p.nombre;
        const t = p.tipo.toLowerCase();

        if (t.includes("suelto") && !t.includes("cigarro"))
          etiqueta += " (Suelto)";
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

      // 🧩 Reiniciar Select2 si existe
      if ($(selectProducto).data("select2"))
        $(selectProducto).select2("destroy");

      $(selectProducto).select2({
        width: "100%",
        placeholder: "Buscar producto o escanear...",
      });

      // 🔄 Actualizar al seleccionar
      $("#productoSelect").on("select2:select", function () {
        actualizarStockVisible();
        calcularTotal();
      });
    } catch (err) {
      console.error(err);
      toast("Error al cargar productos", "danger");
    }
  }

  function resetFormVenta() {
    $(selectProducto).val("").trigger("change");
    stockDisponible.value = "";
    cantidad.value = "";
    total.value = "";
    formaPago.value = "Efectivo";
  }

  function getProdSel() {
    const idSel = selectProducto.value;
    if (!idSel) return null;

    return productos.find(
      (p) =>
        String(p.id) === String(idSel) ||
        String(p.producto_id) === String(idSel)
    );
  }

  function actualizarStockVisible() {
    const option = selectProducto.selectedOptions[0];
    if (!option) {
      stockDisponible.value = "";
      return;
    }

    // Buscar producto real
    const p = productos.find(
      (prod) => String(prod.id) === String(option.value)
    );

    // 🛑 Si no existe o tiene stock 0 → limpiamos todo
    if (!p || Number(p.stock) <= 0) {
      stockDisponible.value = "";
      total.value = "";
      cantidad.value = "";
      return;
    }

    const tipo = (p.tipo || "").toLowerCase();
    let stock = Number(p.stock);

    // 🟡 SUELTOS (kg/gr)
    if (tipo.includes("suelto") && !tipo.includes("cigarro")) {
      const gr = stock * 1000;

      // 🛑 Si hay menos de 1g → no mostrar
      if (gr < 1) {
        stockDisponible.value = "";
        total.value = "";
        cantidad.value = "";
        return;
      }

      // Mostrar según cantidad
      if (stock < 1) {
        stockDisponible.value = `${Math.round(gr)} g`;
      } else {
        stockDisponible.value = `${stock.toFixed(2)} kg`;
      }
      return;
    }

    // 🔵 UNIDADES
    if (stock < 1) {
      stockDisponible.value = "";
      total.value = "";
      cantidad.value = "";
      return;
    }

    stockDisponible.value = `${Math.floor(stock)} un.`;
  }

  function calcularTotal() {
    const p = getProdSel();
    let val = cantidad.value.trim();

    if (!p || !val || Number(val) <= 0) {
      total.value = "";
      return;
    }

    const tipo = (p.tipo || "").toLowerCase();
    let totalFinal = 0;

    // 🟡 SUELTOS (GRAMOS)
    if (tipo.includes("suelto") && !tipo.includes("cigarro")) {
      let gramos = Number(val); // SIEMPRE gramos
      const stockGramos = Number(p.stock) * 1000; // Convertir stock (kg) → gramos

      if (gramos > stockGramos) {
        total.value = "";
        return toast(`Stock insuficiente`, "danger");
      }

      const precioGramo = Number(p.precio_venta) / 100;
      totalFinal = precioGramo * gramos;
    }

    // 🔵 UNIDADES (generales / cigarros)
    else {
      totalFinal = Number(p.precio_unitario) * Number(val);
      if (Number(val) > Number(p.stock))
        return toast("Stock insuficiente", "danger");
    }

    // 💳 CREDITO +15% SOLO VISUAL
    if (formaPago.value === "Tarjeta Crédito") {
      totalFinal *= 1.15;
    }

    total.value = totalFinal.toFixed(2);
  }

  function calcularTotalCarrito() {
    const subtotal = carrito.reduce(
      (acc, item) => acc + Number(item.total || 0),
      0
    );
    const pagar =
      formaPago.value === "Tarjeta Crédito" ? subtotal * 1.15 : subtotal;
    subtotalCarrito.textContent = pagar.toFixed(2);
    return pagar;
  }

  btnAgregarCarrito.addEventListener("click", () => {
    const p = getProdSel();
    const cantInput = cantidad.value.trim();
    if (!p) return toast("Seleccioná un producto", "warning");
    if (!cantInput || Number(cantInput) <= 0)
      return toast("Ingresá una cantidad válida", "warning");
    if (!formaPago.value) return toast("Seleccioná forma de pago", "warning");

    const tipo = (p.tipo || "").toLowerCase();
    const stock = Number(p.stock || 0);

    // 🟡 SOLO SUELTOS EN GRAMOS
    if (tipo.includes("suelto") && !tipo.includes("cigarro")) {
      let val = cantInput;

      // kilos → gramos
      if (/^[0-9]+$/.test(val) && Number(val) <= 50) val = Number(val) * 1000;
      else val = Number(val);

      const stockGramos = Number(p.stock) * 1000;
      if (val > stockGramos)
        return toast(`Solo hay ${stockGramos} g en stock.`, "danger");

      const precioGramo = Number(p.precio_venta) / 100;
      const costoGramo = Number(p.precio_costo) / 100;
      const totalProd = precioGramo * val;

      carrito.push({
        id: p.id,
        nombre: p.nombre,
        tipo: p.tipo,
        cantidad: val, // 🔥 YA NO SE ROMPE
        precio_unitario: precioGramo,
        costo_unitario: costoGramo,
        total: totalProd,
      });

      renderCarrito();
      cantidad.value = "";
      total.value = "";
      $(selectProducto).val("").trigger("change");
      actualizarStockVisible();
      return;
    }

    // 🔵 🚬 UNIDADES
    const cant = Number(cantInput);
    if (cant > stock)
      return toast(`Solo hay ${stock} unidades en stock.`, "danger");

    const precioUnit = Number(p.precio_unitario);
    const costoUnit = Number(p.costo_unitario);

    carrito.push({
      id: p.id,
      nombre: p.nombre,
      tipo: p.tipo,
      cantidad: cant,
      precio_unitario: precioUnit,
      total: precioUnit * cant,
      costo_unitario: costoUnit,
    });

    renderCarrito();
    cantidad.value = "";
    total.value = "";
    $(selectProducto).val("").trigger("change");
    actualizarStockVisible();
  });

  function renderCarrito() {
    tablaCarrito.innerHTML = "";

    if (carrito.length === 0) {
      tablaCarrito.innerHTML = `
      <tr>
        <td colspan="6" class="text-muted text-center">Carrito vacío.</td>
      </tr>
    `;
      subtotalCarrito.textContent = "0.00";
      actualizarStockVisible();
      return;
    }

    carrito.forEach((item, i) => {
      const tipo = (item.tipo || "").toLowerCase();
      const mostrarCantidad =
        tipo.includes("suelto") && !tipo.includes("cigarro")
          ? `${item.cantidad} g`
          : `${item.cantidad}`;

      const tr = document.createElement("tr");
      tr.innerHTML = `
      <td>${item.nombre}</td>
      <td>${mostrarCantidad}</td>
      <td>$${Number(item.precio_unitario).toFixed(2)}</td>
      <td>$${Number(item.total).toFixed(2)}</td>
      <td>
        <button class="btn btn-warning btn-sm btn-editar" data-idx="${i}">
          <i class="bi bi-pencil"></i>
        </button>
      </td>
      <td>
        <button class="btn btn-danger btn-sm btn-eliminar" data-idx="${i}">
          <i class="bi bi-x-circle"></i>
        </button>
      </td>
    `;
      tablaCarrito.appendChild(tr);
    });

    tablaCarrito
      .querySelectorAll(".btn-editar")
      .forEach((btn) =>
        btn.addEventListener("click", () => editarItemCarrito(btn.dataset.idx))
      );

    tablaCarrito.querySelectorAll(".btn-eliminar").forEach((btn) =>
      btn.addEventListener("click", () => {
        carrito.splice(btn.dataset.idx, 1);
        renderCarrito();
        actualizarStockVisible();
      })
    );

    const subtotal = carrito.reduce((acc, i) => acc + Number(i.total), 0);
    subtotalCarrito.textContent = subtotal.toFixed(2);
    actualizarStockVisible();
  }

function editarItemCarrito(idx) {
  const item = carrito[idx];
  if (!item) return;

  const p = productos.find((prod) => String(prod.id) === String(item.id));
  if (!p) {
    toast("Producto no encontrado", "danger");
    return;
  }

  let nueva = prompt(
    `Ingresar nueva cantidad para ${item.nombre}:`,
    item.cantidad
  );
  if (nueva === null) return;

  nueva = Number(String(nueva).trim());
  if (!Number.isFinite(nueva) || nueva <= 0) {
    toast("Cantidad inválida", "danger");
    return;
  }

  const tipo = (p.tipo || "").toLowerCase();
  const stock = Number(p.stock || 0);

  // ==============================
  // 🟡 SUELTOS (gramos)
  // ==============================
  if (tipo.includes("suelto") && !tipo.includes("cigarro")) {
    let gramos = nueva >= 5 ? nueva : nueva * 1000;

    if (gramos > stock * 1000) {
      toast(`Solo hay ${stock} kg en stock.`, "danger");
      return;
    }

    const precio100 = Number(p.precio_venta);
    const costo100 = Number(p.precio_costo);

    item.cantidad = gramos;
    item.precio_unitario = precio100 / 100;
    item.costo_unitario = costo100 / 100;
    item.total = item.precio_unitario * gramos;

    carrito[idx] = item;
    renderCarrito();

    // 🔥 FIX CLAVE: liberar Enter para vender
    ultimoEscaneo = 0;
    inputScanner.blur();
    formaPago.focus();

    return;
  }

  // ==============================
  // 🔵 UNIDADES (generales y cigarros)
  // ==============================
  if (nueva > stock) {
    toast(`Solo hay ${stock} unidades en stock.`, "danger");
    return;
  }

  const precioUnit = Number(p.precio_unitario || item.precio_unitario || 0);
  const costoUnit = Number(p.costo_unitario || item.costo_unitario || 0);

  item.cantidad = nueva;
  item.precio_unitario = precioUnit;
  item.costo_unitario = costoUnit;
  item.total = precioUnit * nueva;

  carrito[idx] = item;
  renderCarrito();

  // 🔥 FIX CLAVE: liberar Enter para vender
  ultimoEscaneo = 0;
  inputScanner.blur();
  formaPago.focus();
}


  btnVaciarCarrito.addEventListener("click", () => {
    if (carrito.length === 0) return;

    const ok = confirm("¿Seguro que querés borrar todo el carrito?");
    if (!ok) return;

    carrito = [];
    renderCarrito();
  });

  async function ventaDirecta() {
    const p = getProdSel();
    const pago = formaPago.value;
    let cant = Number(cantidad.value);

    if (!p) return toast("Seleccioná un producto", "warning");
    if (!pago) return toast("Seleccioná forma de pago", "warning");
    if (!cant || cant <= 0)
      return toast("Ingresá una cantidad válida", "warning");

    const tipo = (p.tipo || "").toLowerCase();
    const stockKg = Number(p.stock);

    // 🟡 SUELTOS (gramos reales)
    if (tipo.includes("suelto") && !tipo.includes("cigarro")) {
      const stockGramos = stockKg * 1000; // BD → gramos
      const gramos = cant; // input SIEMPRE gramos

      if (gramos > stockGramos) return toast("Stock insuficiente", "danger");

      const precioGramo = Number(p.precio_venta) / 100;
      const costoGramo = Number(p.precio_costo) / 100;

      const totalSinRecargo = precioGramo * gramos;
      const gananciaFinal = (precioGramo - costoGramo) * gramos;

      await fetch("/api/sueltos/venta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          producto_id: p.id,
          cantidad_gramos: gramos,
          forma_pago: pago,
          total: totalSinRecargo, // SIN 15%
          ganancia: gananciaFinal,
          precio_fijo_gramo: precioGramo,
        }),
      });
    }

    // 🔵 GENERALES / CIGARROS (unidad)
    else {
      if (cant > stockKg) return toast("Stock insuficiente", "danger");

      const precioUnit = Number(p.precio_unitario);
      const costoUnit = Number(p.costo_unitario);

      const totalSinRecargo = precioUnit * cant;
      const gananciaFinal = (precioUnit - costoUnit) * cant;

      await fetch(
        tipo.includes("cigarro") ? "/api/cigarros/venta" : "/api/ventas",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            producto_id: p.id,
            cantidad: cant,
            forma_pago: pago,
            total: totalSinRecargo, // SIN 15%
            ganancia: gananciaFinal,
            tipoVenta: tipo.includes("suelto") ? "Suelto" : "Paquete",
            precio_fijo_unitario: precioUnit,
          }),
        }
      );
    }

    resetFormVenta();
    await cargarProductos();
    actualizarStockVisible();
    obtenerVentas(hoyLocalISO());
  }

  formVenta.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (carrito.length > 0) {
      await finalizarVentaCarrito();
      return;
    }

    await ventaDirecta();
  });
  async function finalizarVentaCarrito() {
    const pago = formaPago.value;
    if (!pago) return toast("Seleccioná forma de pago", "warning");
    if (carrito.length === 0) return toast("Carrito vacío", "warning");

    try {
      for (const item of carrito) {
        const p = productos.find((x) => x.id === item.id);
        const tipo = (p.tipo || "").toLowerCase();

        if (tipo.includes("suelto") && !tipo.includes("cigarro")) {
          await fetch("/api/sueltos/venta", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              producto_id: item.id,
              cantidad_gramos: item.cantidad,
              forma_pago: pago,
              total: item.total,
              ganancia:
                item.total - item.costo_unitario * (item.cantidad / 1000),
              precio_fijo_gramo: p.precio_venta / 100,
            }),
          });
          continue;
        }

        if (tipo.includes("cigarro")) {
          await fetch("/api/cigarros/venta", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              producto_id: item.id,
              cantidad: item.cantidad,
              forma_pago: pago,
              total: item.total,
              ganancia: item.total - item.costo_unitario * item.cantidad,
              tipoVenta: tipo.includes("suelto") ? "Suelto" : "Paquete",
              precio_fijo_unitario: p.precio_unitario,
            }),
          });
          continue;
        }

        await fetch("/api/ventas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            producto_id: item.id,
            cantidad: item.cantidad,
            forma_pago: pago,
            total: item.total,
            ganancia: item.total - item.costo_unitario * item.cantidad,
          }),
        });
      }

      carrito = [];
      renderCarrito();
      resetFormVenta();
      toast("Venta completada", "success");
      cargarProductos();
      obtenerVentas(hoyLocalISO());
    } catch (err) {
      console.error(err);
      toast("Error al finalizar venta", "danger");
    }
  }

  function postVenta(item, pago) {
    return {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        producto_id: item.id,
        cantidad: item.cantidad,
        forma_pago: pago,
        total: item.total,
        ganancia: item.total - item.costo_unitario * item.cantidad,
      }),
    };
  }

  async function obtenerVentas(fecha) {
    const f = fecha || hoyLocalISO();

    const urls = [
      `/api/ventas?fecha=${f}`,
      `/api/sueltos/ventas?fecha=${f}`,
      `/api/cigarros/ventas?fecha=${f}`,
    ];

    try {
      const [gen, suel, cig] = await Promise.all(
        urls.map((u) => fetch(u).then((r) => r.json()))
      );

      const generales = gen.map((v) => ({ ...v, tipo: "general" }));
      const sueltos = suel.map((v) => ({ ...v, tipo: "suelto" }));
      const cigarros = cig.map((v) => ({ ...v, tipo: "cigarro" }));

      ventasLista = [...generales, ...sueltos, ...cigarros];

      // 🔥 ORDENAR POR FECHA/HORA
      ventasLista.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

      mostrarVentas(ventasLista);
    } catch (err) {
      console.error("Error al cargar ventas:", err);
    }
  }
  function mostrarVentas(lista) {
    tablaVentas.innerHTML = "";
    let totalDia = 0;
    let gananciaDia = 0;

    if (!lista || lista.length === 0) {
      tablaVentas.innerHTML = `<tr><td colspan="8" class="text-muted text-center">Sin ventas.</td></tr>`;
      totalVendido.textContent = "0.00";
      totalGanancia.textContent = "0.00";
      return;
    }

    lista.forEach((v) => {
      let totalMostrar = Number(v.total);
      const fp = (v.forma_pago || "").toLowerCase();

      // 🔥 Aplicar +15% solo visual si es tarjeta
      if (fp.includes("crédito") || fp.includes("credito")) {
        totalMostrar = totalMostrar * 1.15;
      }

      totalDia += totalMostrar;
      gananciaDia += Number(v.ganancia);

      let cantidadMostrar = v.cantidad;

      if (v.tipo === "suelto") {
        const g = Number(v.cantidad_gramos);
        cantidadMostrar = g >= 1000 ? `${g / 1000} kg` : `${g} g`;
      }

      tablaVentas.innerHTML += `
      <tr>
        <td>${v.fecha.slice(0, 16)}</td>
        <td>${v.nombre_producto}</td>
        <td>${v.tipo}</td>
        <td>${cantidadMostrar}</td>
        <td>${v.forma_pago}</td>
        <td>$${totalMostrar.toFixed(2)}</td>
        <td>$${Number(v.ganancia).toFixed(2)}</td>
      </tr>
    `;
    });

    totalVendido.textContent = totalDia.toFixed(2);
    totalGanancia.textContent = gananciaDia.toFixed(2);
  }

  function agregarAlCarritoPorScanner(p) {
    const tipo = (p.tipo || "").toLowerCase();

    const cantSumar =
      tipo.includes("suelto") && !tipo.includes("cigarro") ? 100 : 1;

    const stockReal =
      tipo.includes("suelto") && !tipo.includes("cigarro")
        ? Number(p.stock) * 1000
        : Number(p.stock);

    const usado = carrito
      .filter((i) => String(i.id) === String(p.id))
      .reduce((acc, i) => acc + i.cantidad, 0);

    if (usado + cantSumar > stockReal) {
      return toast("Stock insuficiente", "danger");
    }

    const precioUnit =
      tipo.includes("suelto") && !tipo.includes("cigarro")
        ? Number(p.precio_venta) / 100
        : Number(p.precio_unitario);

    const costoUnit =
      tipo.includes("suelto") && !tipo.includes("cigarro")
        ? Number(p.precio_costo) / 100
        : Number(p.costo_unitario);

    const existente = carrito.find((i) => String(i.id) === String(p.id));

    if (existente) {
      existente.cantidad += cantSumar;
      existente.total = existente.cantidad * existente.precio_unitario;
    } else {
      carrito.push({
        id: p.id,
        nombre: p.nombre,
        tipo: p.tipo,
        cantidad: cantSumar,
        precio_unitario: precioUnit,
        costo_unitario: costoUnit,
        total: precioUnit * cantSumar,
      });
    }

    renderCarrito();
  }

  function calcularCierreCaja() {
    let efectivo = 0,
      transferencia = 0,
      debito = 0,
      credito = 0,
      totalV = 0,
      ganancia = 0;

    ventasLista.forEach((v) => {
      const totalVenta = Number(v.total);
      const gananciaVenta = Number(v.ganancia);
      const fp = (v.forma_pago || "").toLowerCase();

      if (fp.includes("efectivo")) efectivo += totalVenta;
      else if (fp.includes("transfer")) transferencia += totalVenta;
      else if (fp.includes("débito") || fp.includes("debito"))
        debito += totalVenta;
      else if (fp.includes("crédito") || fp.includes("credito"))
        credito += totalVenta;

      totalV += totalVenta;
      ganancia += gananciaVenta;
    });

    const fecha = fechaFiltro.value || hoyLocalISO();

    contenidoCierreCaja.innerHTML = `
      <p class="mb-3 text-muted">Fecha seleccionada: <strong>${fecha}</strong></p>
      <div class="row g-3 mb-3">
        <div class="col-md-3"><div class="border rounded p-3 bg-light"><h6 class="mb-1">Efectivo</h6><p class="fs-5 mb-0">$${efectivo.toFixed(
          2
        )}</p></div></div>
        <div class="col-md-3"><div class="border rounded p-3 bg-light"><h6 class="mb-1">Transf</h6><p class="fs-5 mb-0">$${transferencia.toFixed(
          2
        )}</p></div></div>
        <div class="col-md-3"><div class="border rounded p-3 bg-light"><h6 class="mb-1">Tarjeta Débito</h6><p class="fs-5 mb-0">$${debito.toFixed(
          2
        )}</p></div></div>
        <div class="col-md-3"><div class="border rounded p-3 bg-light"><h6 class="mb-1">Tarjeta Crédito</h6><p class="fs-5 mb-0">$${credito.toFixed(
          2
        )}</p></div></div>
      </div>
      <div class="border rounded p-3">
        <h5 class="fw-bold text-primary mb-2">Resumen general</h5>
        <p class="mb-1">Total vendido: <strong>$${totalV.toFixed(
          2
        )}</strong></p>
        <p class="mb-0 text-success">Ganancia total: <strong>$${ganancia.toFixed(
          2
        )}</strong></p>
      </div>
    `;
  }

  btnValidarCaja.addEventListener("click", () => {
    if (passCaja.value !== "Emanuel2025") {
      toast("Contraseña incorrecta", "danger");
      return;
    }

    passCaja.value = "";

    bootstrap.Modal.getInstance(
      document.getElementById("modalPasswordCaja")
    ).hide();
    new bootstrap.Modal(document.getElementById("modalOpcionesCaja")).show();
  });

  function crearTarjetaPago(nombre, monto) {
    return `
    <div class="col-6 col-md-3">
      <div class="tarjeta-caja p-3 text-center">
        <h6 class="mb-1 text-secondary text-wrap">${nombre}</h6>
        <p class="valor-caja">$${monto.toFixed(2)}</p>
      </div>
    </div>
  `;
  }

  function procesarScanner(code) {
    // 🔎 Buscar TODOS los productos con ese código
    const encontrados = productos.filter(
      (p) => String(p.codigo_barra) === String(code)
    );

    if (encontrados.length === 0) {
      return toast("Producto no encontrado", "danger");
    }

    // ==============================
    // 🟢 CASO NORMAL: UNO SOLO
    // ==============================
    if (encontrados.length === 1) {
      const prod = encontrados[0];
      mostrarPrecioYAgregar(prod);
      return;
    }

    // ==============================
    // 🔥 CASO ESPECIAL: VARIOS
    // ==============================
    mostrarModalSeleccionProducto(encontrados);
  }
  function mostrarPrecioYAgregar(prod) {
    const tipo = (prod.tipo || "").toLowerCase();
    let mostrarPrecio = "";

    if (tipo.includes("suelto") && !tipo.includes("cigarro")) {
      mostrarPrecio = `$${Math.round(prod.precio_venta)} (100g)`;
    } else {
      mostrarPrecio = `$${Math.round(prod.precio_unitario)} (unidad)`;
    }

    document.getElementById("precioScannerNombre").innerText = prod.nombre;
    document.getElementById("precioScannerValor").innerText = mostrarPrecio;

    const modal = new bootstrap.Modal(
      document.getElementById("modalPrecioScanner"),
      { backdrop: "static", keyboard: false }
    );

    modal.show();
    setTimeout(() => modal.hide(), 900);

    // ⚠️ IMPORTANTE: NO SELECCIONAMOS EL SELECT
    // ⚠️ SOLO AGREGAMOS AL CARRITO
    agregarAlCarritoPorScanner(prod);
  }

  btnBuscarFecha.addEventListener("click", () => {
    if (!fechaFiltro.value) return;
    obtenerVentas(fechaFiltro.value);
  });

  btnHoy.addEventListener("click", () => {
    const hoy = hoyLocalISO();
    fechaFiltro.value = hoy;
    obtenerVentas(hoy);
  });

  selectProducto.addEventListener("change", () => {
    actualizarStockVisible();
    calcularTotal();
  });

  cantidad.addEventListener("input", calcularTotal);

  formaPago.addEventListener("change", () => {
    calcularTotal();
    calcularTotalCarrito();
  });

  (async () => {
    await cargarProductos();
    const hoy = hoyLocalISO();
    fechaFiltro.value = hoy;
    await obtenerVentas(hoy);

    renderCarrito();

    // ⚡ Fix real: congelar la posición del scroll cuando hay un modal abierto
    let scrollTopFix = 0;

    document.addEventListener("show.bs.modal", () => {
      scrollTopFix = window.scrollY; // Guardar posición actual
      document.body.style.position = "fixed"; // Congelar body
      document.body.style.top = `-${scrollTopFix}px`;
      document.body.style.width = "100%";
      document.documentElement.style.overflow = "hidden"; // Bloquear html
    });

    // 🔓 Restaurar al cerrar
    document.addEventListener("hidden.bs.modal", () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      document.documentElement.style.overflow = "";
      window.scrollTo(0, scrollTopFix); // Volver a donde estaba
    });

document.addEventListener("keydown", async (e) => {
  if (e.key !== "Enter") return;

  // ⛔ Evitar venta si el Enter viene del scanner
  if (Date.now() - ultimoEscaneo < 300) return;

  // ⛔ Si hay un modal abierto, NO vender
  if (document.querySelector(".modal.show")) return;

  // ⛔ Evitar Enter automático del navegador
  e.preventDefault();

  // =========================
  // 🛒 PRIORIDAD: CARRITO
  // =========================
  if (carrito.length > 0) {
    await finalizarVentaCarrito();
    return;
  }

  // =========================
  // 🧾 VENTA DIRECTA
  // =========================
  await ventaDirecta();
});
function focoEnBuscadorSelect() {
  const activo = document.activeElement;
  return (
    activo &&
    activo.classList.contains("select2-search__field")
  );
}

  })();
});
