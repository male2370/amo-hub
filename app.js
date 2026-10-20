/* AMO - Hub: lógica de la página.
   No hace falta tocar este archivo para cargar platos o eventos:
   eso se hace en data.js */

(function () {
  const D = window.AMO;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const wa = (msg) =>
    `https://wa.me/${D.config.whatsapp}?text=${encodeURIComponent(msg || D.config.mensajeWhatsapp)}`;

  const flecha = '<svg class="plato-btn__flecha" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

  /* ---------- Datos fijos ---------- */
  $$("[data-whatsapp]").forEach((a) => (a.href = wa()));
  $$("[data-vinoteca]").forEach((a) => (a.href = D.config.vinotecaUrl));
  $$("[data-instagram]").forEach((a) => (a.href = D.config.instagram));
  $$("[data-lugar]").forEach((el) => (el.textContent = D.config.lugar));
  $("[data-horarios]").innerHTML = D.config.horarios.map((h) => `<li>${esc(h)}</li>`).join("");

  /* ---------- Menú ---------- */
  const platos = {};
  D.menu.forEach((cat) => cat.platos.forEach((p) => (platos[p.id] = { ...p, categoria: cat.categoria })));

  $("[data-menu]").innerHTML = D.menu.map((cat) => `
    <section class="menu__categoria">
      <h2>${esc(cat.categoria)}</h2>
      <ul>
        ${cat.platos.map((p) => `
          <li>
            <a class="plato-btn" href="#/menu/${encodeURIComponent(p.id)}">
              ${p.foto
                ? `<img class="plato-btn__mini" src="${esc(p.foto)}" alt="" loading="lazy">`
                : `<span class="plato-btn__mini plato-btn__mini--vacio"><img src="img/icono-copa.png" alt=""></span>`}
              <span class="plato-btn__nombre">${esc(p.nombre)}</span>
              ${p.precio ? `<span class="plato-btn__precio">${esc(p.precio)}</span>` : ""}
              ${flecha}
            </a>
          </li>`).join("")}
      </ul>
    </section>`).join("");

  function pintarPlato(id) {
    const p = platos[id];
    if (!p) { location.hash = "#/menu"; return; }
    $("[data-plato]").innerHTML = `
      ${p.foto
        ? `<img class="plato__foto" src="${esc(p.foto)}" alt="${esc(p.nombre)}">`
        : `<div class="plato__foto plato__foto--vacia"><img src="img/icono-copa.png" alt=""></div>`}
      <p class="plato__categoria">${esc(p.categoria)}</p>
      <h1>${esc(p.nombre)}</h1>
      ${p.precio ? `<p class="plato__precio">${esc(p.precio)}</p>` : ""}
      <p class="plato__desc">${esc(p.descripcion)}</p>
      <a class="boton boton--linea" href="#/menu"><span>Ver todo el menú</span></a>`;
    document.title = `${p.nombre} · AMO`;
  }

  /* ---------- Eventos ---------- */
  const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const DIAS_LARGO = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const MESES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  function aFecha(e) {
    const [a, m, d] = e.fecha.split("-").map(Number);
    const [hh, mm] = (e.hora || "23:59").split(":").map(Number);
    return new Date(a, m - 1, d, hh || 0, mm || 0);
  }

  function pintarEventos() {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const lista = D.eventos
      .map((e) => ({ ...e, _f: aFecha(e) }))
      .filter((e) => !isNaN(e._f) && e._f >= hoy)
      .sort((a, b) => a._f - b._f);

    const cont = $("[data-eventos]");
    if (!lista.length) {
      cont.outerHTML = `
        <div class="vacio" data-eventos>
          <img src="img/icono-copa.png" alt="">
          <p>Pronto anunciamos los próximos encuentros.<br>Escribinos y te avisamos.</p>
          <a class="boton boton--linea" href="${wa("¡Hola AMO! Avisenme de los próximos eventos.")}" target="_blank" rel="noopener"><span>Avisame por WhatsApp</span></a>
        </div>`;
      return;
    }

    cont.innerHTML = lista.map((e, i) => {
      const f = e._f;
      const fechaLarga = `${DIAS_LARGO[f.getDay()]} ${f.getDate()} de ${MESES_LARGO[f.getMonth()]}`;
      const href = e.link || wa(`¡Hola AMO! Quiero reservar para "${e.titulo}" del ${fechaLarga}.`);
      return `
        <li class="evento${i === 0 ? " evento--proximo" : ""}">
          <div class="evento__fecha" aria-label="${esc(fechaLarga)}">
            <div class="evento__dia-sem">${DIAS[f.getDay()]}</div>
            <div class="evento__dia">${f.getDate()}</div>
            <div class="evento__mes">${MESES[f.getMonth()]}</div>
          </div>
          <div>
            ${i === 0 ? '<span class="evento__etiqueta">El próximo</span>' : ""}
            <h2>${esc(e.titulo)}</h2>
            ${e.hora ? `<div class="evento__hora">${esc(e.hora)} hs</div>` : ""}
            ${e.descripcion ? `<p>${esc(e.descripcion)}</p>` : ""}
            <a class="evento__cta" href="${esc(href)}" target="_blank" rel="noopener">${e.link ? "Más info" : "Reservar lugar"}</a>
          </div>
        </li>`;
    }).join("");
  }
  pintarEventos();

  /* ---------- Reservas ---------- */
  const R = Object.assign({ dias: [4, 5, 6], horarios: ["20:00", "22:00"], semanasAdelante: 4, maxPersonas: 8, api: "" }, D.config.reservas);
  const S = window.AMO_SALON;
  const MODO_PRUEBA = !R.api;
  const sel = { fecha: null, hora: null, personas: null, otro: false, mesa: null, ocupadas: [], cerrado: false, cargando: false, error: false };
  let fechas = [];
  let consulta = 0;

  const conHora = (d, h) => {
    const [hh, mm] = h.split(":").map(Number);
    const x = new Date(d); x.setHours(hh, mm || 0, 0, 0); return x;
  };
  const horasLibres = (d) => R.horarios.filter((h) => conHora(d, h) > new Date());
  const fechaLarga = (d) => `${DIAS_LARGO[d.getDay()]} ${d.getDate()} de ${MESES_LARGO[d.getMonth()]}`;
  const fechaISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const mayus = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const textoPersonas = (n) => `${n} ${n === 1 ? "persona" : "personas"}`;
  const esArmada = () => sel.otro;

  const form = $("[data-form-reserva]");
  const cajaOtro = $("[data-personas-otro]");
  const inputOtro = $("[data-personas-input]");
  const notaOtro = $("[data-personas-nota]");
  const campos = { nombre: $("#r-nombre"), telefono: $("#r-telefono"), email: $("#r-email") };
  inputOtro.min = R.maxPersonas + 1;

  /* --- API (Google Apps Script) --- */
  async function apiGet(params) {
    const r = await fetch(`${R.api}?${new URLSearchParams(params)}`);
    return r.json();
  }
  async function apiPost(datos) {
    // Sin "Content-Type" a propósito: así Google no bloquea el pedido.
    const r = await fetch(R.api, { method: "POST", body: JSON.stringify(datos) });
    return r.json();
  }

  function calcularFechas() {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const out = [];
    for (let i = 0; i < R.semanasAdelante * 7; i++) {
      const d = new Date(hoy); d.setDate(hoy.getDate() + i);
      if (R.dias.includes(d.getDay()) && horasLibres(d).length) out.push(d);
    }
    return out;
  }

  function pintarReserva() {
    Object.assign(sel, { fecha: null, hora: null, personas: null, otro: false, mesa: null, ocupadas: [], cerrado: false, cargando: false, error: false });
    inputOtro.value = ""; notaOtro.textContent = "";
    Object.values(campos).forEach((c) => (c.value = ""));
    $("[data-error]").textContent = "";
    form.hidden = false;
    $("[data-exito]").hidden = true;
    fechas = calcularFechas();
    $("[data-dias]").innerHTML = fechas.map((d, i) => `
      <button type="button" class="dia" data-dia="${i}" aria-pressed="false" aria-label="${esc(fechaLarga(d))}">
        <span class="dia__sem">${DIAS[d.getDay()]}</span>
        <span class="dia__num">${d.getDate()}</span>
        <span class="dia__mes">${MESES[d.getMonth()]}</span>
      </button>`).join("");
    pintarTodo();
  }

  function pintarTodo() {
    pintarHoras();
    pintarPersonas();
    pintarMesa();
    pintarDatos();
  }

  function pintarHoras() {
    const libres = sel.fecha ? horasLibres(sel.fecha) : [];
    $("[data-paso-hora]").classList.toggle("paso--bloqueado", !sel.fecha);
    $("[data-horas]").innerHTML = R.horarios.map((h) => `
      <button type="button" class="hora" data-hora="${esc(h)}" aria-pressed="${sel.hora === h}"
        ${sel.fecha && !libres.includes(h) ? "disabled" : ""}>${esc(h)}<small>hs</small></button>`).join("");
  }

  function pintarPersonas() {
    $("[data-paso-personas]").classList.toggle("paso--bloqueado", !sel.hora);
    const opciones = Array.from({ length: R.maxPersonas }, (_, i) => i + 1);
    $("[data-personas]").innerHTML =
      opciones.map((n) => `<button type="button" class="persona" data-persona="${n}" aria-pressed="${!sel.otro && sel.personas === n}" aria-label="${textoPersonas(n)}">${n}</button>`).join("") +
      `<button type="button" class="persona persona--mas" data-persona="mas" aria-pressed="${sel.otro}">Más de ${R.maxPersonas}</button>`;
    cajaOtro.hidden = !sel.otro;
  }

  /* --- Plano --- */
  const mesaApta = (m) => sel.personas && !sel.otro && sel.personas <= m.cap && sel.personas >= m.min;

  function sillas(m) {
    const out = [];
    const porLado = Math.ceil(m.cap / 2);
    const horizontal = m.w >= m.h;
    for (let lado = 0; lado < 2; lado++) {
      const n = lado === 0 ? porLado : m.cap - porLado;
      for (let i = 0; i < n; i++) {
        const t = (i + 1) / (n + 1);
        const cx = horizontal ? m.x + m.w * t : (lado === 0 ? m.x - 16 : m.x + m.w + 16);
        const cy = horizontal ? (lado === 0 ? m.y - 16 : m.y + m.h + 16) : m.y + m.h * t;
        out.push(`<circle class="mesa__silla" cx="${cx}" cy="${cy}" r="10"/>`);
      }
    }
    return out.join("");
  }

  function referencia(r) {
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    const rot = r.vertical ? ` transform="rotate(-90 ${cx} ${cy})"` : "";
    if (r.tipo === "puerta") {
      return `<g class="ref ref--puerta"><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="3"/>
        <text x="${cx}" y="${r.y + r.h + 26}">${esc(r.texto)}</text></g>`;
    }
    if (r.tipo === "pared") {
      return `<g class="ref ref--pared"><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="3"/>
        <text x="${r.x + r.w + 22}" y="${cy}" transform="rotate(-90 ${r.x + r.w + 22} ${cy})">${esc(r.texto)}</text></g>`;
    }
    return `<g class="ref ref--bloque"><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="6"/>
      <text x="${cx}" y="${cy}"${rot}>${esc(r.texto)}</text></g>`;
  }

  function pintarPlano() {
    const svg = `
      <svg viewBox="-30 -10 ${S.ancho + 50} ${S.alto + 20}" class="plano__svg" role="group" aria-label="Plano del salón">
        <rect class="plano__piso" x="-20" y="-6" width="${S.ancho + 40}" height="${S.alto + 12}" rx="10"/>
        ${S.referencias.map(referencia).join("")}
        ${S.mesas.map((m) => {
          const ocupada = sel.ocupadas.includes(m.num);
          const apta = mesaApta(m) && !ocupada;
          const elegida = sel.mesa === m.num;
          const clase = elegida ? "is-elegida" : apta ? "is-libre" : "is-no";
          const etiqueta = `Mesa para ${m.cap} personas${ocupada ? ", reservada" : !apta ? ", no disponible para tu grupo" : ""}`;
          return `
          <g class="mesa ${clase}" data-mesa="${m.num}" ${apta || elegida ? 'tabindex="0" role="button"' : 'aria-disabled="true"'} aria-label="${etiqueta}" aria-pressed="${elegida}">
            <rect class="mesa__zona" x="${m.x - 26}" y="${m.y - 26}" width="${m.w + 52}" height="${m.h + 52}" rx="12"/>
            ${sillas(m)}
            <rect class="mesa__tabla" x="${m.x}" y="${m.y}" width="${m.w}" height="${m.h}" rx="8"/>
            <text class="mesa__cap" x="${m.x + m.w / 2}" y="${m.y + m.h / 2}">${m.cap}</text>
          </g>`;
        }).join("")}
      </svg>`;
    const plano = $("[data-plano]");
    plano.innerHTML = svg;
    plano.classList.toggle("is-cargando", sel.cargando);
  }

  function pintarMesa() {
    const listo = sel.fecha && sel.hora && sel.personas;
    $("[data-paso-mesa]").classList.toggle("paso--bloqueado", !listo && !(sel.otro && sel.hora));
    $("[data-mesa-plano]").hidden = esArmada();
    $("[data-mesa-armada]").hidden = !esArmada();
    if (esArmada()) return;
    pintarPlano();

    const estado = $("[data-plano-estado]");
    if (sel.cargando) estado.textContent = "Consultando disponibilidad…";
    else if (sel.cerrado) estado.textContent = "Esa noche no tomamos reservas. Elegí otra fecha, por favor.";
    else if (sel.error) estado.innerHTML = `No pudimos consultar la disponibilidad. Probá de nuevo en un momento.`;
    else if (sel.mesa) {
      const m = S.mesas.find((x) => x.num === sel.mesa);
      estado.textContent = `Elegiste una mesa para ${m.cap} personas.`;
    } else if (listo) {
      const hay = S.mesas.some((m) => mesaApta(m) && !sel.ocupadas.includes(m.num));
      estado.textContent = hay ? "" : "No quedan mesas para tu grupo ese día. Probá con otra fecha.";
    } else estado.textContent = "";
  }

  /* --- Datos y confirmación --- */
  const listoParaDatos = () => sel.fecha && sel.hora && sel.personas && (esArmada() || sel.mesa);

  function pintarDatos() {
    const ok = listoParaDatos();
    $("[data-paso-datos]").classList.toggle("paso--bloqueado", !ok);
    const caja = $("[data-confirmar-caja]");
    caja.hidden = !ok;
    if (!ok) return;
    const partes = [mayus(fechaLarga(sel.fecha)), `${sel.hora} hs`, textoPersonas(sel.personas)];
    if (esArmada()) partes.push("mesa armada");
    $("[data-resumen-texto]").textContent = partes.join(" · ");
  }

  async function cargarOcupadas() {
    const pedido = ++consulta;
    sel.ocupadas = []; sel.cerrado = false; sel.error = false;
    if (MODO_PRUEBA) { pintarMesa(); return; }
    sel.cargando = true; pintarMesa();
    try {
      const r = await apiGet({ accion: "disponibilidad", fecha: fechaISO(sel.fecha) });
      if (pedido !== consulta) return;
      if (!r.ok) throw new Error(r.error);
      sel.ocupadas = r.ocupadas || [];
      sel.cerrado = !!r.cerrado;
      if (sel.mesa && sel.ocupadas.includes(sel.mesa)) sel.mesa = null;
    } catch (e) {
      if (pedido !== consulta) return;
      sel.error = true;
    }
    sel.cargando = false;
    pintarMesa(); pintarDatos();
  }

  function validarDatos() {
    const v = {
      nombre: campos.nombre.value.trim(),
      telefono: campos.telefono.value.trim(),
      email: campos.email.value.trim()
    };
    if (v.nombre.length < 2) return [null, "Escribí tu nombre.", campos.nombre];
    if (v.telefono.replace(/\D/g, "").length < 8) return [null, "Revisá el teléfono.", campos.telefono];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) return [null, "Revisá el mail.", campos.email];
    return [v];
  }

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const err = $("[data-error]");
    const [datos, msg, campo] = validarDatos();
    if (!datos) { err.textContent = msg; campo.focus(); return; }
    err.textContent = "";

    const boton = $("[data-confirmar]");
    boton.disabled = true;
    $("[data-confirmar-texto]").textContent = "Reservando…";

    const pedido = {
      accion: "reservar",
      fecha: fechaISO(sel.fecha),
      hora: sel.hora,
      personas: sel.personas,
      mesa: esArmada() ? "armada" : sel.mesa,
      ...datos
    };

    try {
      let r;
      if (MODO_PRUEBA) { await new Promise((ok) => setTimeout(ok, 600)); r = { ok: true }; }
      else r = await apiPost(pedido);

      if (r.ok) return mostrarExito(datos);
      err.textContent = r.error || "No se pudo reservar. Probá de nuevo.";
      if (r.ocupada) { sel.mesa = null; await cargarOcupadas(); $("[data-paso-mesa]").scrollIntoView({ behavior: "smooth" }); }
    } catch (e) {
      err.textContent = "No hay conexión. Probá de nuevo en un momento.";
    } finally {
      boton.disabled = false;
      $("[data-confirmar-texto]").textContent = "Confirmar reserva";
    }
  });

  function mostrarExito(datos) {
    const nombre = datos.nombre.split(" ")[0];
    $("[data-exito-titulo]").textContent = `¡Listo, ${nombre}!`;
    $("[data-exito-texto]").textContent = esArmada()
      ? `Recibimos tu pedido para ${sel.personas} personas el ${fechaLarga(sel.fecha)} a las ${sel.hora} hs. Nosotros te armamos la mesa.`
      : `Tu mesa te espera el ${fechaLarga(sel.fecha)} a las ${sel.hora} hs.`;
    $("[data-exito-mail]").textContent = MODO_PRUEBA
      ? "Modo prueba: la reserva no se guardó ni se mandaron mails."
      : `Te mandamos la confirmación a ${datos.email}.`;
    form.hidden = true;
    $("[data-exito]").hidden = false;
    window.scrollTo(0, 0);
  }

  /* --- Eventos --- */
  $("[data-dias]").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-dia]"); if (!b) return;
    sel.fecha = fechas[Number(b.dataset.dia)];
    if (sel.hora && !horasLibres(sel.fecha).includes(sel.hora)) sel.hora = null;
    sel.mesa = null;
    $$("[data-dia]").forEach((x) => x.setAttribute("aria-pressed", x === b));
    pintarTodo();
    cargarOcupadas();
  });

  $("[data-horas]").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-hora]"); if (!b || b.disabled) return;
    sel.hora = b.dataset.hora;
    pintarTodo();
  });

  $("[data-personas]").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-persona]"); if (!b) return;
    if (b.dataset.persona === "mas") {
      sel.otro = true;
      sel.personas = leerOtro();
      sel.mesa = null;
    } else {
      sel.otro = false;
      sel.personas = Number(b.dataset.persona);
      const m = S.mesas.find((x) => x.num === sel.mesa);
      if (m && !mesaApta(m)) sel.mesa = null;
    }
    pintarTodo();
    if (sel.otro) inputOtro.focus();
  });

  function leerOtro() {
    const n = parseInt(inputOtro.value, 10);
    if (!inputOtro.value) { notaOtro.textContent = ""; return null; }
    if (isNaN(n) || n <= R.maxPersonas) { notaOtro.textContent = `Escribí un número mayor a ${R.maxPersonas}.`; return null; }
    notaOtro.textContent = "";
    return n;
  }

  inputOtro.addEventListener("input", () => {
    sel.personas = leerOtro();
    pintarMesa(); pintarDatos();
  });

  function elegirMesa(g) {
    if (!g || !(g.classList.contains("is-libre") || g.classList.contains("is-elegida"))) return;
    const num = Number(g.dataset.mesa);
    sel.mesa = sel.mesa === num ? null : num;
    pintarMesa(); pintarDatos();
    if (sel.mesa) {
      const foco = $(`[data-mesa="${num}"]`); if (foco) foco.focus({ preventScroll: true });
    }
  }
  $("[data-plano]").addEventListener("click", (ev) => elegirMesa(ev.target.closest("[data-mesa]")));
  $("[data-plano]").addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter" && ev.key !== " ") return;
    ev.preventDefault();
    elegirMesa(ev.target.closest("[data-mesa]"));
  });

  /* ---------- Navegación ---------- */
  const vistas = { inicio: $("#vista-inicio"), reservar: $("#vista-reservar"), menu: $("#vista-menu"), plato: $("#vista-plato"), eventos: $("#vista-eventos") };

  function mostrar(nombre) {
    Object.entries(vistas).forEach(([k, el]) => (el.hidden = k !== nombre));
  }

  function rutear() {
    const h = location.hash;
    if (h === "#mas") return; // ancla interna del inicio
    const partes = h.replace(/^#\/?/, "").split("/").filter(Boolean);
    document.title = "AMO · Restaurante y Vinoteca";

    if (partes[0] === "panel") { location.replace("panel/"); return; }
    else if (partes[0] === "reservar") { pintarReserva(); mostrar("reservar"); document.title = "Reservar · AMO"; }
    else if (partes[0] === "menu" && partes[1]) { pintarPlato(decodeURIComponent(partes[1])); mostrar("plato"); }
    else if (partes[0] === "menu") { mostrar("menu"); document.title = "Menú · AMO"; }
    else if (partes[0] === "eventos") { mostrar("eventos"); document.title = "Eventos · AMO"; }
    else mostrar("inicio");

    window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", rutear);
  rutear();
})();