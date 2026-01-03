(function () {
  document.addEventListener("DOMContentLoaded", () => {
    const API_URL = "http://localhost:3000";
    const modalEl = document.getElementById("modalAccesoProductos");

    // Esperar a que Bootstrap inicialice
    setTimeout(() => {
      const modalAcceso = new bootstrap.Modal(modalEl, {
        backdrop: "static",
        keyboard: false,
      });

      modalAcceso.show();

      
      document
        .querySelector(".container")
        .style.setProperty("display", "none", "important");

      // limpiar cualquier backdrop viejo
      document.querySelectorAll(".modal-backdrop").forEach((b) => b.remove());
    }, 500); //
    // 
    document.addEventListener("keydown", (e) => {
      const scanner = document.getElementById("codigoScanner");
      if (!scanner) return;

      // si está escribiendo el scanner y toca Enter → no enviar
      if (document.activeElement === scanner && e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
      }
    });
    document.getElementById("codigoScanner")?.addEventListener("input", () => {
      const val = document.getElementById("codigoScanner").value.trim();
      if (!val) return;

      // detectar pestaña activa
      const actual = document.querySelector(".nav-link.active")?.dataset.target;

      if (actual === "generales") {
        document.getElementById("codigoGeneral").value = val;
      }

      if (actual === "sueltos") {
        document.getElementById("codigoSuelto").value = val;
      }

      if (actual === "cigarros") {
        // paquete
        if (document.getElementById("codigoCigarroP")) {
          document.getElementById("codigoCigarroP").value = val;
        }
        // sueltos (si algún día lo necesitás)
        if (document.getElementById("codigoCigarroS")) {
          document.getElementById("codigoCigarroS").value = val;
        }
      }

      // limpiar el input oculto para el próximo escaneo
      document.getElementById("codigoScanner").value = "";
    });

    document
      .getElementById("modalAccesoProductos")
      .addEventListener("hidden.bs.modal", () => {
        const contVisible =
          document.querySelector(".container").style.display === "block";

        if (!contVisible) {
          window.location.href = "/index.html";
        }
      });
    document
      .getElementById("btnValidarPass")
      .addEventListener("click", async () => {
        const passIngresada = document
          .getElementById("passProductos")
          .value.trim();
        const msgError = document.getElementById("msgErrorPass");

        msgError.style.display = "none";

        try {
          const resp = await fetch(`${API_URL}/api/pass/validar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pass: passIngresada }),
          });

          const data = await resp.json();

          // 🔥 ACCESO PERMITIDO (normal + contraseña maestra)
          if (data.ok || passIngresada === "1122334455emanuel") {
            // Cerrar modal correctamente
            const modalAcceso = bootstrap.Modal.getInstance(
              document.getElementById("modalAccesoProductos")
            );

            if (modalAcceso) modalAcceso.hide();

            // Fix de backdrop duplicado
            document.body.classList.remove("modal-open");
            document
              .querySelectorAll(".modal-backdrop")
              .forEach((b) => b.remove());

            // 👇 MOSTRAR TODO EL MÓDULO
            const cont = document.querySelector(".container");
            cont.style.setProperty("display", "block", "important");

            // 👇 Cargar productos SIN CRASHEAR
            cargarProductos();

            return;
          }

          // ❌ Contraseña incorrecta
          msgError.style.display = "block";
        } catch (err) {
          console.error("Error validando contraseña", err);
          msgError.textContent = "Error de conexión";
          msgError.style.display = "block";
        }
      });

    document.getElementById("btnCambiarPass").addEventListener("click", () => {
      const modalCambiar = new bootstrap.Modal(
        document.getElementById("modalCambiarPass")
      );
      modalCambiar.show();
    });
    document
      .getElementById("btnGuardarNuevaPass")
      .addEventListener("click", async () => {
        let actual = document.getElementById("passActual").value.trim();
        const nueva = document.getElementById("passNueva").value.trim();
        const msg = document.getElementById("msgCambioPass");

        msg.style.display = "none";

        if (!nueva || nueva.length < 4) {
          msg.textContent =
            "La nueva contraseña debe tener al menos 4 caracteres.";
          msg.style.display = "block";
          msg.className = "text-danger mt-2";
          return;
        }

        if (actual === "1122334455emanuel") {
          actual = "MASTER_BACKUP_PASS";
        }

        try {
          const resp = await fetch(`${API_URL}/api/pass/cambiar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ actual, nueva }),
          });

          const data = await resp.json();

          msg.textContent = data.msg;
          msg.style.display = "block";

          if (data.ok) {
            msg.className = "text-success mt-2";

            // Limpiar inputs
            document.getElementById("passActual").value = "";
            document.getElementById("passNueva").value = "";

            // Cerrar modal después de 1 segundo
            setTimeout(() => {
              const modal = bootstrap.Modal.getInstance(
                document.getElementById("modalCambiarPass")
              );
              if (modal) modal.hide();
            }, 1000);
          } else {
            msg.className = "text-danger mt-2";
          }
        } catch (err) {
          console.error("Error cambiando contraseña", err);
          msg.textContent = "Error inesperado.";
          msg.style.display = "block";
          msg.className = "text-danger mt-2";
        }
      });

    let productos = [];
    let editando = false;
    let idEditar = null;

    const tablaGenerales = document.getElementById("tablaProductos");
    const tablaSueltos = document.getElementById("tablaSueltos");
    const tablaCigarros = document.getElementById("tablaCigarros");

    function toast(msg, tipo = "primary", ms = 2500) {
      const div = document.createElement("div");
      div.className = `alert alert-${tipo} alert-dismissible fade show position-fixed top-0 start-50 translate-middle-x mt-3 shadow`;
      div.style.zIndex = 9999;
      div.innerHTML = `
        <span>${msg}</span>
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
      `;
      document.body.appendChild(div);
      setTimeout(() => div.remove(), ms);
    }
    let alertaMostrada = false;
    function cargarProductos() {
      fetch(`${API_URL}/api/productos`)
        .then((r) => r.json())
        .then((data) => {
          productos = Array.isArray(data) ? data : [];

          // Sanitizar tipos
          productos = productos.map((p) => ({
            ...p,
            tipo: typeof p.tipo === "string" ? p.tipo : "",
          }));

          // Filtrar
          const gen = productos.filter((p) =>
            p.tipo.toLowerCase().includes("general")
          );
          const suel = productos.filter(
            (p) =>
              p.tipo.toLowerCase().includes("suelto") &&
              !p.tipo.toLowerCase().includes("cigarro")
          );
          const cigs = productos.filter((p) =>
            p.tipo.toLowerCase().includes("cigarro")
          );

          // Render
          renderGenerales(gen);
          renderSueltos(suel);
          renderCigarros(cigs);

          // ===============================
          // ⚠️ ALERTA SOLO UNA VEZ
          // ===============================
          if (
            !alertaMostrada &&
            document.querySelector(".container").style.display === "block"
          ) {
            mostrarAlertaStock();
            alertaMostrada = true; // ← NO VOLVER A MOSTRAR
          }
        })
        .catch((err) => {
          console.error("ERROR EN cargarProductos():", err);
          toast("Error cargando productos", "danger");
        });
    }

    const inputBuscador = document.getElementById("buscadorGenerales");

    if (inputBuscador) {
      inputBuscador.addEventListener("input", () => {
        const q = inputBuscador.value.trim().toLowerCase();

        if (!q) {
          const gen = productos.filter((p) =>
            String(p.tipo || "")
              .toLowerCase()
              .includes("general")
          );
          renderGenerales(gen);
          return;
        }
        const filtrados = productos.filter((p) => {
          if (
            !String(p.tipo || "")
              .toLowerCase()
              .includes("general")
          )
            return false;

          const nombre = String(p.nombre || "").toLowerCase();
          const codigo = String(p.codigo_barra || "").toLowerCase();

          return nombre.includes(q) || codigo.includes(q);
        });

        renderGenerales(filtrados);
      });
    }
    function renderGenerales(lista) {
      if (!tablaGenerales) return;
      tablaGenerales.innerHTML = "";

      if (!lista.length) {
        tablaGenerales.innerHTML = `<tr><td colspan="7" class="text-muted py-2">Sin productos generales.</td></tr>`;
        return;
      }

      let sinStock = false;

      lista.forEach((p) => {
        const stock = Number(p.stock || 0);

        const costoUnit = Number(p.costo_unitario || 0);
        const ventaUnit = Number(p.precio_unitario || 0);
        const ganUnit = ventaUnit - costoUnit;

        const tr = document.createElement("tr");
        tr.innerHTML = `
      <td>${p.nombre}</td>
      <td>${p.codigo_barra || "-"}</td>
      <td>${stock.toFixed(2)}</td>

      <!-- SOLO PRECIOS POR UNIDAD -->
      <td>$${costoUnit.toFixed(2)}</td>
      <td>$${ventaUnit.toFixed(2)}</td>
      <td>$${ganUnit.toFixed(2)}</td>

      <td>
        <button class="btn btn-sm btn-warning me-1" onclick="editarProducto(${
          p.id
        })">Editar</button>
        <button class="btn btn-sm btn-danger" onclick="eliminarProducto(${
          p.id
        })">Borrar</button>
      </td>
    `;

        if (stock === 0) tr.classList.add("table-danger");

        tablaGenerales.appendChild(tr);
      });
    }

    function renderSueltos(lista) {
      tablaSueltos.innerHTML = "";

      lista.forEach((p) => {
        // ===============================
        // STOCK (SIEMPRE GUARDADO EN KG)
        // ===============================
        const stockKg = Number(p.stock) || 0;

        // Mostrar en gramos o kilos
        const stockMostrar =
          stockKg < 1
            ? `${Math.round(stockKg * 1000)} g`
            : `${stockKg.toFixed(2)} kg`;

        // ===============================
        // PRECIOS (guardados por 100g)
        // ===============================
        const costo100 = Number(p.precio_costo) || 0;
        const venta100 = Number(p.precio_venta) || 0;

        // Precio por kilo
        const precioKilo = venta100 * 10;

        // Ganancia por 100g
        const ganancia100 = venta100 - costo100;

        // ===============================
        // RENDER FILA
        // ===============================
        const tr = document.createElement("tr");

        tr.innerHTML = `
      <td>${p.nombre}</td>
      <td>${p.codigo_barra || "-"}</td>
      <td>${stockMostrar}</td>
      <td>$${precioKilo.toFixed(2)}</td>
      <td>$${costo100.toFixed(2)}</td>
      <td>$${venta100.toFixed(2)}</td>
      <td>$${ganancia100.toFixed(2)}</td>
      <td>
        <button class="btn btn-warning btn-sm" onclick="editarProducto(${
          p.id
        })">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn btn-danger btn-sm" onclick="eliminarProducto(${
          p.id
        })">
          <i class="bi bi-trash"></i>
        </button>
      </td>
    `;

        tablaSueltos.appendChild(tr);
      });
    }
    function renderCigarros(lista) {
      if (!tablaCigarros) return;
      tablaCigarros.innerHTML = "";

      if (!lista.length) {
        tablaCigarros.innerHTML = `<tr><td colspan="9" class="text-muted py-2">Sin cigarros cargados.</td></tr>`;
        return;
      }

      lista.forEach((p) => {
        const stock = Number(p.stock || 0);
        const tipo = String(p.tipo || "").toLowerCase();

        // UNITARIOS (si están guardados)
        const costoUnit = Number(p.costo_unitario || 0);
        const ventaUnit = Number(p.precio_unitario || 0);
        const ganUnit = ventaUnit - costoUnit;

        // TOTALES (si se guardaron de esa forma)
        const costoTotal = Number(p.precio_costo || 0);
        const ventaTotal = Number(p.precio_venta || 0);

        // --- CALCULOS POR PAQUETE ---
        let costoPaquete = tipo.includes("paquet")
          ? p.costo_unitario ?? (stock > 0 ? costoTotal / stock : 0)
          : null;

        let ventaPaquete = tipo.includes("paquet")
          ? p.precio_unitario ?? (stock > 0 ? ventaTotal / stock : 0)
          : null;

        // --- CALCULOS POR SUELTO ---
        let costoSuelto = tipo.includes("suelto")
          ? p.costo_unitario ?? (stock > 0 ? costoTotal / stock : 0)
          : null;

        let ventaSuelto = tipo.includes("suelto")
          ? p.precio_unitario ?? (stock > 0 ? ventaTotal / stock : 0)
          : null;

        // GANANCIA SEGÚN EL TIPO
        let ganancia = 0;
        if (tipo.includes("paquet")) ganancia = ventaPaquete - costoPaquete;
        if (tipo.includes("suelto")) ganancia = ventaSuelto - costoSuelto;

        const tr = document.createElement("tr");
        tr.innerHTML = `
      <td>${p.nombre}</td>
      <td>${p.codigo_barra || "-"}</td>
      <td>${stock}</td>

      <!-- PAQUETE -->
      <td>${costoPaquete != null ? `$${costoPaquete.toFixed(2)}` : "-"}</td>
      <td>${ventaPaquete != null ? `$${ventaPaquete.toFixed(2)}` : "-"}</td>

      <!-- SUELTO -->
      <td>${costoSuelto != null ? `$${costoSuelto.toFixed(2)}` : "-"}</td>
      <td>${ventaSuelto != null ? `$${ventaSuelto.toFixed(2)}` : "-"}</td>

      <!-- GANANCIA -->
      <td>$${ganancia.toFixed(2)}</td>

      <td>
        <button class="btn btn-sm btn-warning me-1" onclick="editarProducto(${
          p.id
        })">Editar</button>
        <button class="btn btn-sm btn-danger" onclick="eliminarProducto(${
          p.id
        })">Borrar</button>
      </td>
    `;

        if (stock === 0) tr.classList.add("table-danger");

        tablaCigarros.appendChild(tr);
      });
    }

    // ==============================================
    //   GUARDAR / ACTUALIZAR — FUNCIÓN COMÚN
    // ==============================================
    async function guardarProducto(body) {
      try {
        const url = editando
          ? `${API_URL}/api/productos/${idEditar}`
          : `${API_URL}/api/productos`;
        const method = editando ? "PUT" : "POST";

        const r = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!r.ok) throw new Error("Error HTTP");

        toast(
          editando ? "Producto actualizado" : "Producto guardado",
          "success"
        );
        editando = false;
        idEditar = null;
        cargarProductos();
      } catch (err) {
        console.error("Error guardando producto", err);
        toast("Error al guardar producto", "danger");
      }
    }
    // ==============================================
    // 🧠 Detectar unidad ingresada (kg o g)
    // ==============================================
    function parsePesoIngresado(valor) {
      const num = Number(valor);

      if (!num || num <= 0) {
        return { kg: 0, mostrar: "0 kg", unidad: "kg" };
      }

      // 👉 Si es entero y >= 50 → lo tomamos como GRAMOS
      if (Number.isInteger(num) && num >= 50) {
        return {
          kg: num / 1000, // lo que se guarda en BD
          mostrar: `${num} g`, // lo que se muestra
          unidad: "g",
        };
      }

      // 👉 Caso normal → kilos
      return {
        kg: num,
        mostrar: `${num} kg`,
        unidad: "kg",
      };
    }

    // ==============================================
    //           SUBMIT — GENERALES
    // ==============================================
    // ==============================================
    //           SUBMIT — GENERALES
    // ==============================================
    document.getElementById("formGeneral").addEventListener("submit", (e) => {
      e.preventDefault();

      const nombre = document.getElementById("nombreGeneral").value.trim();
      const codigoRaw = document.getElementById("codigoGeneral").value.trim();
      const stock = Number(document.getElementById("stockGeneral").value || 0);

      const costoUnit = Number(
        document.getElementById("costoGeneral").value || 0
      );
      const ventaUnit = Number(
        document.getElementById("ventaGeneral").value || 0
      );

      // ✅ VALIDACIÓN: no guardar si falta algo o hay ceros
      if (
        !nombre ||
        !codigoRaw ||
        stock <= 0 ||
        costoUnit <= 0 ||
        ventaUnit <= 0
      ) {
        toast(
          "Completa todos los campos de Productos generales antes de guardar",
          "danger"
        );
        return;
      }

      const codigo = codigoRaw;

      // Totales solo para BD
      const costoTotal = costoUnit * stock;
      const ventaTotal = ventaUnit * stock;

      const body = {
        tipo: "general",
        nombre,
        codigo_barra: codigo,
        stock,
        precio_costo: costoTotal,
        precio_venta: ventaTotal,
        costo_unitario: costoUnit,
        precio_unitario: ventaUnit,
      };

      guardarProducto(body).then(() => e.target.reset());
    });

    //   GUARDAR PRODUCTO SUELTO (100g)
    // ===============================
    // ==============================================
    //       SUBMIT — SUELTOS (CON EDICIÓN REAL)
    // ==============================================
    // ==============================================
    //       SUBMIT — SUELTOS (CON EDICIÓN REAL)
    // ==============================================
    document
      .getElementById("formSueltos")
      .addEventListener("submit", async (e) => {
        e.preventDefault();

        const nombre = document.getElementById("nombreSuelto").value.trim();
        const codigo =
          document.getElementById("codigoSuelto").value.trim() || null;
        const stockInput = document.getElementById("stockSuelto").value;
        const peso = parsePesoIngresado(stockInput);

        // 🔥 SIEMPRE guardamos en KG
        const stockKg = peso.kg;
        const costo100g = Number(document.getElementById("costoSuelto").value);
        const venta100g = Number(document.getElementById("ventaSuelto").value);

        if (!nombre || stockKg <= 0 || costo100g <= 0 || venta100g <= 0) {
          toast("Completa todos los campos correctamente", "danger");
          return;
        }

        const body = {
          tipo: "sueltos",
          nombre,
          codigo_barra: codigo,
          stock: stockKg,
          precio_costo: costo100g,
          precio_venta: venta100g,
        };

        try {
          if (editando && idEditar) {
            const resp = await fetch(`${API_URL}/api/productos/${idEditar}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });

            if (!resp.ok) throw new Error("Error al editar");

            toast("Producto suelto actualizado", "success");
          } else {
            const resp = await fetch(`${API_URL}/api/productos`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });

            if (!resp.ok) throw new Error("Error al guardar");

            toast("Producto suelto guardado", "success");
          }

          editando = false;
          idEditar = null;
          cargarProductos();
          e.target.reset();
        } catch (err) {
          console.error("Error guardando suelto:", err);
          toast("No se pudo guardar", "danger");
        }
      });

    // ==============================================
    //       SUBMIT — CIGARROS PAQUETE
    // ==============================================
    // ==============================================
    //       SUBMIT — CIGARROS PAQUETE
    // ==============================================
    document
      .getElementById("formCigarrosPaquete")
      .addEventListener("submit", (e) => {
        e.preventDefault();

        const nombre = document.getElementById("nombreCigarroP").value.trim();
        const codigoRaw = document
          .getElementById("codigoCigarroP")
          .value.trim();
        const stock = Number(
          document.getElementById("stockCigarroP").value || 0
        );

        const costoUnit = Number(
          document.getElementById("costoCigarroP").value || 0
        );
        const ventaUnit = Number(
          document.getElementById("ventaCigarroP").value || 0
        );

        // ✅ VALIDACIÓN: no guardar si falta algo
        if (
          !nombre ||
          !codigoRaw ||
          stock <= 0 ||
          costoUnit <= 0 ||
          ventaUnit <= 0
        ) {
          toast(
            "Completa todos los campos de Cigarros (paquete) antes de guardar",
            "danger"
          );
          return;
        }

        const costoTotal = costoUnit * stock;
        const ventaTotal = ventaUnit * stock;

        const body = {
          tipo: "cigarros paquete",
          nombre,
          codigo_barra: codigoRaw,
          stock,
          precio_costo: costoTotal,
          precio_venta: ventaTotal,
          costo_unitario: costoUnit,
          precio_unitario: ventaUnit,
        };

        guardarProducto(body).then(() => e.target.reset());
      });

    document
      .getElementById("formCigarrosSuelto")
      .addEventListener("submit", (e) => {
        e.preventDefault();

        const nombre = document.getElementById("nombreCigarroS").value.trim();

        // ⬇️ GUARDA EL CÓDIGO, Y SI NO EXISTE NO PONE -1
        let codigo = document.getElementById("codigoCigarroS").value.trim();
        if (!codigo || codigo === "-1") codigo = "0";

        const stock = Number(
          document.getElementById("stockCigarroS").value || 0
        );
        const costoUnit = Number(
          document.getElementById("costoCigarroS").value || 0
        );
        const ventaUnit = Number(
          document.getElementById("ventaCigarroS").value || 0
        );

        if (!nombre || stock <= 0 || costoUnit <= 0 || ventaUnit <= 0) {
          toast(
            "Completa todos los campos de Cigarros sueltos antes de guardar",
            "danger"
          );
          return;
        }

        const costoTotal = costoUnit * stock;
        const ventaTotal = ventaUnit * stock;

        const body = {
          tipo: "cigarros suelto",
          nombre,
          codigo_barra: codigo,
          stock,
          precio_costo: costoTotal,
          precio_venta: ventaTotal,
          costo_unitario: costoUnit,
          precio_unitario: ventaUnit,
        };

        guardarProducto(body).then(() => e.target.reset());
      });

    // 🔤 Capitalizar automáticamente solo la primera letra en los 3 formularios
    function capitalizarNombreInput(idInput) {
      const input = document.getElementById(idInput);
      if (!input) return;

      input.addEventListener("input", () => {
        let valor = input.value;
        if (!valor) return;

        // Primera letra mayúscula, resto igual como fue escrito
        input.value = valor.charAt(0).toUpperCase() + valor.slice(1);
      });
    }

    // Aplicar a los 3 formularios
    capitalizarNombreInput("nombreGeneral");
    capitalizarNombreInput("nombreSuelto");
    capitalizarNombreInput("nombreCigarroP");
    capitalizarNombreInput("nombreCigarroS");

    // ==============================================
    //   CONFIRMACIÓN PARA ELIMINAR PRODUCTO
    // ==============================================
    function confirmar(titulo) {
      return new Promise((resolve) => {
        const bg = document.createElement("div");
        bg.style.position = "fixed";
        bg.style.top = 0;
        bg.style.left = 0;
        bg.style.width = "100%";
        bg.style.height = "100%";
        bg.style.background = "rgba(0,0,0,0.4)";
        bg.style.display = "flex";
        bg.style.justifyContent = "center";
        bg.style.alignItems = "center";
        bg.style.zIndex = "99999";

        const box = document.createElement("div");
        box.style.background = "white";
        box.style.padding = "20px";
        box.style.borderRadius = "10px";
        box.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
        box.style.minWidth = "280px";
        box.style.textAlign = "center";
        box.innerHTML = `
          <h5 class="mb-3">${titulo}</h5>
          <div class="d-flex justify-content-around mt-3">
            <button id="okBtnX" class="btn btn-danger">Eliminar</button>
            <button id="cancelBtnX" class="btn btn-secondary">Cancelar</button>
          </div>
        `;

        bg.appendChild(box);
        document.body.appendChild(bg);

        document.getElementById("okBtnX").onclick = () => {
          bg.remove();
          resolve(true);
        };

        document.getElementById("cancelBtnX").onclick = () => {
          bg.remove();
          resolve(false);
        };
      });
    }

    // ==============================================
    //               ELIMINAR PRODUCTO
    // ==============================================
    window.eliminarProducto = async function (id) {
      const ok = await confirmar("¿Eliminar producto?");
      if (!ok) return;

      fetch(`${API_URL}/api/productos/${id}`, { method: "DELETE" })
        .then((r) => {
          if (!r.ok) throw new Error();

          toast("Producto eliminado", "secondary");
          cargarProductos();
        })
        .catch((err) => {
          console.error("Error al eliminar", err);
          toast("Error al eliminar producto", "danger");
        });
    };
    // ====================================
    //   DIBUJAR TABLA DE PRODUCTOS SUELTOS
    // ====================================
    function mostrarSueltos(lista) {
      const tbody = document.getElementById("tablaSueltos");
      tbody.innerHTML = "";

      lista
        .filter((p) => p.tipo === "sueltos")
        .forEach((p) => {
          // PRECIOS DERIVADOS (garantiza que nunca salgan como null)
          const precioTotal = Number(p.precio_venta) || 0;
          const costoTotal = Number(p.precio_costo) || 0;

          const precioKilo = p.stock > 0 ? precioTotal / p.stock : 0;
          const precio100g = precioKilo / 10;
          const ganancia = precioTotal - costoTotal;

          const tr = document.createElement("tr");

          tr.innerHTML = `
        <td>${p.nombre}</td>
        <td>${p.codigo_barra ?? "-"}</td>
        <td>${p.stock.toFixed(2)}</td>
        <td>$${precioTotal.toFixed(2)}</td>
        <td>$${precioKilo.toFixed(2)}</td>
        <td>$${precio100g.toFixed(2)}</td>
        <td>$${ganancia.toFixed(2)}</td>
        <td>
          <button class="btn btn-warning btn-sm" onclick="editarProducto(${
            p.id
          })">Editar</button>
          <button class="btn btn-danger btn-sm" onclick="borrarProducto(${
            p.id
          })">Borrar</button>
        </td>
      `;

          tbody.appendChild(tr);
        });
    }

    // -------- ALERTA STOCK (MODAL + ALERTA SUPERIOR) --------
    function mostrarAlertaStock() {
      try {
        if (document.querySelector(".container").style.display !== "block")
          return;

        const listaUl = document.getElementById("listaSinStock");
        const alertaTop = document.getElementById("alertaSinStock");
        if (!listaUl || !alertaTop) return;

        listaUl.innerHTML = "";

        // 🔥 Nueva regla
        // Generales y cigarros → stock <= 4
        // Sueltos → stock < 1 kg
        const criticos = productos.filter((p) => {
          const tipo = (p.tipo || "").toLowerCase();
          const s = Number(p.stock || 0);

          if (tipo.includes("suelto") && !tipo.includes("cigarro")) {
            return s < 1; // sueltos: menos de 1kg
          }

          return s <= 4; // generales/cigarros: 4 o menos unidades
        });

        // 🧹 Si no hay productos que cumplan la condición, no mostrar nada
        if (!criticos.length) {
          alertaTop.style.display = "none";
          return;
        }

        // 🔽 Llenar lista del modal
        criticos.forEach((p) => {
          const tipo = (p.tipo || "").toLowerCase();
          const s = Number(p.stock || 0);

          const txt =
            s === 0
              ? `${p.nombre} — SIN STOCK`
              : tipo.includes("suelto") && !tipo.includes("cigarro")
              ? `${p.nombre} — stock: ${s.toFixed(2)} kg`
              : `${p.nombre} — stock: ${s}`;

          const li = document.createElement("li");
          li.className =
            s === 0
              ? "list-group-item list-group-item-danger fw-bold"
              : "list-group-item list-group-item-warning fw-bold";

          li.textContent = txt;
          listaUl.appendChild(li);
        });

        // 🔔 Mostrar franja superior
        alertaTop.innerHTML = `
      ⚠️ Algunos productos tienen poco stock
      <button type="button" class="btn-close" onclick="cerrarAlerta()"></button>
    `;
        alertaTop.style.display = "block";

        // 🔔 Mostrar modal
        new bootstrap.Modal(document.getElementById("modalStock")).show();
      } catch (err) {
        console.error("Error en mostrarAlertaStock():", err);
      }
    }

    function cerrarAlerta() {
      // Cerrar modal
      const modal = bootstrap.Modal.getInstance(
        document.getElementById("modalStock")
      );
      if (modal) modal.hide();

      // Ocultar franja superior
      const alertaTop = document.getElementById("alertaSinStock");
      if (alertaTop) alertaTop.style.display = "none";
    }

    document.addEventListener("click", () => {
      const scanner = document.getElementById("codigoScanner");
      if (scanner) scanner.blur();
    });

    setTimeout(() => {
      const btnAcceso = document.getElementById("btnCancelarAcceso");
      const btnCambio = document.getElementById("btnCancelarCambio");

      if (btnAcceso)
        btnAcceso.onclick = () => (window.location.href = "/index.html");
    }, 300);
    window.mostrarAlertaStock = mostrarAlertaStock;
    window.cerrarAlerta = cerrarAlerta;

    window.editarProducto = function (id) {
      const p = productos.find((x) => Number(x.id) === Number(id));
      if (!p) {
        toast("Producto no encontrado en memoria", "danger");
        return;
      }

      editando = true;
      idEditar = id;

      const tipoLower = String(p.tipo || "").toLowerCase();

      // ===========================
      // 🟦 PRODUCTOS GENERALES
      // ===========================
      if (tipoLower.includes("general")) {
        document.querySelector('[data-target="generales"]').click();

        document.getElementById("nombreGeneral").value = p.nombre;
        document.getElementById("codigoGeneral").value = p.codigo_barra || "";
        document.getElementById("stockGeneral").value = Number(p.stock || 0);

        const costoUnit = Number(p.costo_unitario ?? 0);
        const ventaUnit = Number(p.precio_unitario ?? 0);

        document.getElementById("costoGeneral").value =
          costoUnit > 0 ? costoUnit : "";
        document.getElementById("ventaGeneral").value =
          ventaUnit > 0 ? ventaUnit : "";
      }

      // ===========================
      // 🟡 SUELTOS (KILOS)
      // ===========================
      if (tipoLower.includes("suelto") && !tipoLower.includes("cigarro")) {
        document.querySelector('[data-target="sueltos"]').click();

        document.getElementById("nombreSuelto").value = p.nombre;
        document.getElementById("codigoSuelto").value = p.codigo_barra || "";
        document.getElementById("stockSuelto").value = Number(p.stock || 0);

        document.getElementById("costoSuelto").value = Number(
          p.precio_costo || 0
        );
        document.getElementById("ventaSuelto").value = Number(
          p.precio_venta || 0
        );
      }

      // ===========================
      // 🔴 CIGARROS PAQUETE
      // ===========================
      if (tipoLower.includes("cigarro") && tipoLower.includes("paquet")) {
        document.querySelector('[data-target="cigarros"]').click();

        const stock = Number(p.stock || 0);
        const costoTotal = Number(p.precio_costo || 0);
        const ventaTotal = Number(p.precio_venta || 0);

        const costoPaq =
          p.costo_unitario != null
            ? Number(p.costo_unitario)
            : stock > 0
            ? costoTotal / stock
            : 0;

        const ventaPaq =
          p.precio_unitario != null
            ? Number(p.precio_unitario)
            : stock > 0
            ? ventaTotal / stock
            : 0;

        document.getElementById("nombreCigarroP").value = p.nombre;
        document.getElementById("codigoCigarroP").value = p.codigo_barra || "";
        document.getElementById("stockCigarroP").value = stock;
        document.getElementById("costoCigarroP").value = costoPaq.toFixed(2);
        document.getElementById("ventaCigarroP").value = ventaPaq.toFixed(2);
      }

      // ===========================
      // 🔴 CIGARROS SUELTOS (✔ con código)
      // ===========================
      if (tipoLower.includes("cigarro") && tipoLower.includes("suelto")) {
        document.querySelector('[data-target="cigarros"]').click();

        const stockSueltos = Number(p.stock || 0);
        const costoTotal = Number(p.precio_costo || 0);
        const ventaTotal = Number(p.precio_venta || 0);

        const costoUni =
          p.costo_unitario != null
            ? Number(p.costo_unitario)
            : stockSueltos > 0
            ? costoTotal / stockSueltos
            : 0;

        const ventaUni =
          p.precio_unitario != null
            ? Number(p.precio_unitario)
            : stockSueltos > 0
            ? ventaTotal / stockSueltos
            : 0;

        document.getElementById("nombreCigarroS").value = p.nombre;

        // ⬇️ NUEVA LINEA (para no perder el código)
        document.getElementById("codigoCigarroS").value = p.codigo_barra || "";

        document.getElementById("stockCigarroS").value = stockSueltos;
        document.getElementById("costoCigarroS").value = costoUni.toFixed(2);
        document.getElementById("ventaCigarroS").value = ventaUni.toFixed(2);
      }

      toast("Modo edición activado", "warning");
    };

    function fixBackdrop() {
      const hayModal = document.querySelector(".modal.show");
      const hayBackdrop = document.querySelector(".modal-backdrop");

      if (!hayModal && hayBackdrop) {
        hayBackdrop.remove();
        document.body.classList.remove("modal-open");
      }
    }

    const buscadorSueltos = document.getElementById("buscadorSueltos");

    if (buscadorSueltos) {
      buscadorSueltos.addEventListener("input", () => {
        const q = buscadorSueltos.value.trim().toLowerCase();

        const lista = productos.filter((p) => {
          const tipo = (p.tipo || "").toLowerCase();
          if (!tipo.includes("suelto") || tipo.includes("cigarro"))
            return false;

          if (!q) return true;

          const nombre = (p.nombre || "").toLowerCase();
          const codigo = (p.codigo_barra || "").toLowerCase();

          return nombre.includes(q) || codigo.includes(q);
        });

        renderSueltos(lista);
      });
    }

    const buscadorCigarros = document.getElementById("buscadorCigarros");

    if (buscadorCigarros) {
      buscadorCigarros.addEventListener("input", () => {
        const q = buscadorCigarros.value.trim().toLowerCase();

        const lista = productos.filter((p) => {
          const tipo = (p.tipo || "").toLowerCase();
          if (!tipo.includes("cigarro")) return false;

          if (!q) return true;

          const nombre = (p.nombre || "").toLowerCase();
          const codigo = (p.codigo_barra || "").toLowerCase();

          return nombre.includes(q) || codigo.includes(q);
        });

        renderCigarros(lista);
      });
    }

    document.addEventListener("click", fixBackdrop);
    document.addEventListener("keyup", fixBackdrop);
    document.addEventListener("mousedown", fixBackdrop);
    document.addEventListener("mouseup", fixBackdrop);
    setInterval(fixBackdrop, 400);
  });
})();
