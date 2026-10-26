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
  // La foto de cada plato es img/platos/<id>.jpg. Si no existe, se ve la copa.
  const fotoDe = (p) => p.foto || `img/platos/${p.id}.jpg`;
  window.amoSinFoto = (img, grande) => {
    const caja = document.createElement(grande ? "div" : "span");
    caja.className = grande ? "plato__foto plato__foto--vacia" : "plato-btn__mini plato-btn__mini--vacio";
    caja.innerHTML = '<img src="img/icono-copa.png" alt="">';
    img.replaceWith(caja);
  };
  const platos = {};
  D.menu.forEach((cat) => cat.platos.forEach((p) => (platos[p.id] = { ...p, categoria: cat.categoria })));

  $("[data-menu]").innerHTML = D.menu.map((cat) => `
    <section class="menu__categoria">
      <h2>${esc(cat.categoria)}</h2>
      <ul>
        ${cat.platos.map((p) => `
          <li>
            <a class="plato-btn" href="#/menu/${encodeURIComponent(p.id)}">
              <img class="plato-btn__mini" src="${esc(fotoDe(p))}" alt="" loading="lazy" onerror="amoSinFoto(this)">
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
      <img class="plato__foto" src="${esc(fotoDe(p))}" alt="${esc(p.nombre)}" onerror="amoSinFoto(this, true)">
      <p class="plato__categoria">${esc(p.categoria)}</p>
      <h1>${esc(p.nombre)}</h1>
      ${p.precio ? `<p class="plato__precio">${esc(p.precio)}</p>` : ""}
      <p class="plato__desc">${esc(p.descripcion)}</p>
      <a class="boton boton--linea" href="#/menu"><span>Ver todo el menú</span></a>`;
    document.title = `${p.nombre} · AMO`;
  }

  /* ---------- Fechas y textos ---------- */
  const DIAS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const DIAS_LARGO = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const MESES_LARGO = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

  const fechaLarga = (d) => `${DIAS_LARGO[d.getDay()]} ${d.getDate()} de ${MESES_LARGO[d.getMonth()]}`;
  const fechaISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const deISO = (f) => { const [a, m, d] = f.split("-").map(Number); return new Date(a, m - 1, d); };
  const mayus = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const textoPersonas = (n) => `${n} ${n === 1 ? "persona" : "personas"}`;
  const plata = (n) => "$" + String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  /* ---------- Conexión con Google ---------- */
  const R = Object.assign({ semanasAdelante: 4, maxPersonas: 8, api: "" }, D.config.reservas);
  if (!R.turnos) R.turnos = [{ id: "noche", nombre: "Noche", dias: R.dias || [4, 5, 6], horarios: R.horarios || ["20:00", "22:00"] }];
  const C = Object.assign({ hora: "20:30", precio: 30000, senaPorc: 50, incluye: "", horasParaPagar: 2 }, D.config.cata);
  const MODO_PRUEBA = !R.api;

  async function apiGet(params) {
    const r = await fetch(`${R.api}?${new URLSearchParams(params)}`);
    return r.json();
  }
  async function apiPost(datos) {
    // Sin "Content-Type" a propósito: así Google no bloquea el pedido.
    const r = await fetch(R.api, { method: "POST", body: JSON.stringify(datos) });
    return r.json();
  }

  /* =========================================================
     CATAS (lista de miércoles, se usa en Cata y en Eventos)
     ========================================================= */
  let catasCache = null;
  let catasPromesa = null;

  function catasDePrueba() {
    const bodegas = ["Bodega Catena Zapata", "Zuccardi Valle de Uco", "", "Bodega El Esteco", "", ""];
    const out = [];
    const d = new Date(); d.setHours(0, 0, 0, 0);
    while (out.length < 6) {
      if (d.getDay() === 3) out.push({ fecha: fechaISO(d), hora: C.hora, bodega: bodegas[out.length], libres: [42, 6, 60, 0, 60, 60][out.length], cupo: 60, cancelada: false });
      d.setDate(d.getDate() + 1);
    }
    return { ok: true, catas: out, maxPorReserva: 20 };
  }

  function traerCatas(forzar) {
    if (catasPromesa && !forzar) return catasPromesa;
    catasPromesa = (MODO_PRUEBA ? Promise.resolve(catasDePrueba()) : apiGet({ accion: "catas" }))
      .then((r) => { if (!r.ok) throw new Error(r.error); catasCache = r; return r; })
      .catch((e) => { catasPromesa = null; throw e; });
    return catasPromesa;
  }

  /* ---------- Eventos ---------- */
  function aFechaEvento(e) {
    const [a, m, d] = e.fecha.split("-").map(Number);
    const [hh, mm] = (e.hora || "23:59").split(":").map(Number);
    return new Date(a, m - 1, d, hh || 0, mm || 0);
  }

  function eventosDeCatas() {
    if (!catasCache) return [];
    return catasCache.catas
      .filter((c) => c.bodega && !c.cancelada)
      .slice(0, 4)
      .map((c) => ({
        fecha: c.fecha, hora: c.hora,
        titulo: `Cata con ${c.bodega}`,
        descripcion: `${C.incluye} ${plata(C.precio)} por persona.`.trim(),
        interno: `#/cata/${c.fecha}`,
        agotada: c.libres <= 0
      }));
  }

  function pintarEventos() {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const lista = D.eventos.concat(eventosDeCatas())
      .map((e) => ({ ...e, _f: aFechaEvento(e) }))
      .filter((e) => !isNaN(e._f) && e._f >= hoy)
      .sort((a, b) => a._f - b._f);

    const cont = $("[data-eventos]");
    if (!lista.length) {
      cont.className = "vacio";
      cont.innerHTML = `
        <li style="list-style:none;display:grid;gap:1.5rem;justify-items:center">
          <img src="img/icono-copa.png" alt="">
          <p>Pronto anunciamos los próximos encuentros.<br>Escribinos y te avisamos.</p>
          <a class="boton boton--linea" href="${wa("¡Hola AMO! Avisenme de los próximos eventos.")}" target="_blank" rel="noopener"><span>Avisame por WhatsApp</span></a>
        </li>`;
      return;
    }

    cont.className = "eventos";
    cont.innerHTML = lista.map((e, i) => {
      const f = e._f;
      const larga = fechaLarga(f);
      const href = e.interno || e.link || wa(`¡Hola AMO! Quiero reservar para "${e.titulo}" del ${larga}.`);
      const externo = !e.interno;
      const cta = e.agotada ? "Agotada" : e.interno ? "Reservar lugar" : e.link ? "Más info" : "Reservar lugar";
      return `
        <li class="evento${i === 0 ? " evento--proximo" : ""}">
          <div class="evento__fecha" aria-label="${esc(larga)}">
            <div class="evento__dia-sem">${DIAS[f.getDay()]}</div>
            <div class="evento__dia">${f.getDate()}</div>
            <div class="evento__mes">${MESES[f.getMonth()]}</div>
          </div>
          <div>
            ${i === 0 ? '<span class="evento__etiqueta">El próximo</span>' : ""}
            <h2>${esc(e.titulo)}</h2>
            ${e.hora ? `<div class="evento__hora">${esc(e.hora)} hs</div>` : ""}
            ${e.descripcion ? `<p>${esc(e.descripcion)}</p>` : ""}
            ${e.agotada
              ? `<span class="evento__cta evento__cta--agotada">${cta}</span>`
              : `<a class="evento__cta" href="${esc(href)}"${externo ? ' target="_blank" rel="noopener"' : ""}>${cta}</a>`}
          </div>
        </li>`;
    }).join("");
  }
  pintarEventos();

  /* =========================================================
     RESERVA DE MESA
     ========================================================= */
  const S = window.AMO_SALON;
  const sel = { fecha: null, hora: null, personas: null, otro: false, mesa: null, ocupadas: [], cargado: "", cerrado: false, cargando: false, error: false };
  let fechas = [];
  let consulta = 0;

  const conHora = (d, h) => {
    const [hh, mm] = h.split(":").map(Number);
    const x = new Date(d); x.setHours(hh, mm || 0, 0, 0); return x;
  };
  const turnosDe = (d) => R.turnos.filter((t) => t.dias.includes(d.getDay()));
  const turnoDe = (h) => (R.turnos.find((t) => t.horarios.includes(h)) || {}).id || (h < "17:00" ? "mediodia" : "noche");
  const horasLibres = (d) => turnosDe(d).flatMap((t) => t.horarios).filter((h) => conHora(d, h) > new Date());
  const esArmada = () => sel.otro;
  const claveTurno = () => (sel.fecha && sel.hora ? `${fechaISO(sel.fecha)}|${turnoDe(sel.hora)}` : "");

  const form = $("[data-form-reserva]");
  const cajaOtro = $("[data-personas-otro]");
  const inputOtro = $("[data-personas-input]");
  const notaOtro = $("[data-personas-nota]");
  const campos = { nombre: $("#r-nombre"), telefono: $("#r-telefono"), email: $("#r-email") };
  inputOtro.min = R.maxPersonas + 1;

  function calcularFechas() {
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const out = [];
    for (let i = 0; i < R.semanasAdelante * 7; i++) {
      const d = new Date(hoy); d.setDate(hoy.getDate() + i);
      if (horasLibres(d).length) out.push(d);
    }
    return out;
  }

  function pintarReserva() {
    Object.assign(sel, { fecha: null, hora: null, personas: null, otro: false, mesa: null, ocupadas: [], cargado: "", cerrado: false, cargando: false, error: false });
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
    $("[data-paso-hora]").classList.toggle("paso--bloqueado", !sel.fecha);
    const libres = sel.fecha ? horasLibres(sel.fecha) : [];
    const turnos = sel.fecha ? turnosDe(sel.fecha) : [R.turnos[R.turnos.length - 1]];
    const conTitulo = turnos.length > 1;
    $("[data-horas]").innerHTML = turnos.map((t) => `
      <div class="turno">
        ${conTitulo ? `<p class="turno__nombre">${esc(t.nombre)}</p>` : ""}
        <div class="turno__horas" style="--n:${t.horarios.length}">
          ${t.horarios.map((h) => `
            <button type="button" class="hora" data-hora="${esc(h)}" aria-pressed="${sel.hora === h}"
              ${sel.fecha && !libres.includes(h) ? "disabled" : ""}>${esc(h)}<small>hs</small></button>`).join("")}
        </div>
      </div>`).join("");
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
    else if (sel.cerrado) estado.textContent = "En ese turno no tomamos reservas. Elegí otra fecha u horario, por favor.";
    else if (sel.error) estado.textContent = "No pudimos consultar la disponibilidad. Probá de nuevo en un momento.";
    else if (sel.mesa) {
      const m = S.mesas.find((x) => x.num === sel.mesa);
      estado.textContent = `Elegiste una mesa para ${m.cap} personas.`;
    } else if (listo) {
      const hay = S.mesas.some((m) => mesaApta(m) && !sel.ocupadas.includes(m.num));
      estado.textContent = hay ? "" : "No quedan mesas para tu grupo en ese turno. Probá con otro horario o fecha.";
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
    const clave = claveTurno();
    if (!clave || clave === sel.cargado) { pintarMesa(); pintarDatos(); return; }
    const pedido = ++consulta;
    sel.ocupadas = []; sel.cerrado = false; sel.error = false; sel.cargado = clave;
    if (MODO_PRUEBA) { pintarMesa(); return; }
    sel.cargando = true; pintarMesa();
    try {
      const r = await apiGet({ accion: "disponibilidad", fecha: fechaISO(sel.fecha), turno: turnoDe(sel.hora) });
      if (pedido !== consulta) return;
      if (!r.ok) throw new Error(r.error);
      sel.ocupadas = r.ocupadas || [];
      sel.cerrado = !!r.cerrado;
      if (sel.mesa && sel.ocupadas.includes(sel.mesa)) sel.mesa = null;
    } catch (e) {
      if (pedido !== consulta) return;
      sel.error = true; sel.cargado = "";
    }
    sel.cargando = false;
    pintarMesa(); pintarDatos();
  }

  function validarDatos(c) {
    const v = { nombre: c.nombre.value.trim(), telefono: c.telefono.value.trim(), email: c.email.value.trim() };
    if (v.nombre.length < 2) return [null, "Escribí tu nombre.", c.nombre];
    if (v.telefono.replace(/\D/g, "").length < 8) return [null, "Revisá el teléfono.", c.telefono];
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) return [null, "Revisá el mail.", c.email];
    return [v];
  }

  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const err = $("[data-error]");
    const [datos, msg, campo] = validarDatos(campos);
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
      if (r.ocupada) { sel.mesa = null; sel.cargado = ""; await cargarOcupadas(); $("[data-paso-mesa]").scrollIntoView({ behavior: "smooth" }); }
    } catch (e) {
      err.textContent = "No hay conexión. Probá de nuevo en un momento.";
    } finally {
      boton.disabled = false;
      $("[data-confirmar-texto]").textContent = "Confirmar reserva";
    }
  });

  function mostrarExito(datos) {
    const nombre = mayus(datos.nombre.split(" ")[0].toLowerCase());
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

  /* --- Clicks --- */
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
    const turnoAntes = sel.hora && turnoDe(sel.hora);
    sel.hora = b.dataset.hora;
    if (turnoAntes && turnoAntes !== turnoDe(sel.hora)) sel.mesa = null;
    pintarTodo();
    cargarOcupadas();
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

  /* =========================================================
     RESERVA DE CATA
     ========================================================= */
  const cs = { fecha: null, personas: 2, restr: null, max: 20 };
  const formCata = $("[data-form-cata]");
  const camposCata = { nombre: $("#c-nombre"), telefono: $("#c-telefono"), email: $("#c-email") };
  const textoRestr = $("#c-restr");
  const pruebaPagos = {};

  $("[data-cata-precio]").textContent = plata(C.precio);
  $("[data-cata-incluye]").textContent = C.incluye;
  $("[data-cata-porc]").textContent = C.senaPorc;
  $("[data-cata-hora]").textContent = C.hora;

  const cataElegida = () => (catasCache && cs.fecha ? catasCache.catas.find((c) => c.fecha === cs.fecha) : null);
  const maxPersonasCata = () => { const c = cataElegida(); return Math.max(1, Math.min(cs.max, c ? c.libres : cs.max)); };

  async function pintarCataVista(preFecha) {
    Object.assign(cs, { fecha: null, personas: 2, restr: null });
    textoRestr.value = "";
    Object.values(camposCata).forEach((c) => (c.value = ""));
    $("[data-cata-error]").textContent = "";
    $("[data-catas]").innerHTML = '<p class="catas__cargando">Buscando fechas…</p>';
    $("[data-catas-estado]").textContent = "";
    pintarCataPasos();
    try {
      const r = await traerCatas(true);
      cs.max = r.maxPorReserva || 20;
      const c = preFecha && r.catas.find((x) => x.fecha === preFecha && x.bodega && !x.cancelada && x.libres > 0);
      if (c) cs.fecha = c.fecha;
      pintarCatas();
      pintarCataPasos();
    } catch (e) {
      $("[data-catas]").innerHTML = "";
      $("[data-catas-estado]").textContent = "No pudimos cargar las fechas. Probá de nuevo en un momento.";
    }
  }

  function pintarCatas() {
    const lista = (catasCache ? catasCache.catas : []).filter((c) => c.bodega);
    if (!lista.length) { $("[data-catas]").innerHTML = '<p class="catas__cargando">Pronto anunciamos la próxima cata. Escribinos y te avisamos.</p>'; return; }
    $("[data-catas]").innerHTML = lista.map((c) => {
      const d = deISO(c.fecha);
      const no = c.cancelada || c.libres <= 0;
      const estado = c.cancelada ? "Sin cata esta semana" : c.libres <= 0 ? "Completa" : c.libres <= 10 ? `¡Quedan ${c.libres} lugares!` : "Hay lugar";
      return `
        <button type="button" class="cata-fecha${no ? " is-no" : ""}${c.libres > 0 && c.libres <= 10 ? " is-pocos" : ""}" data-cata-fecha="${c.fecha}" aria-pressed="${cs.fecha === c.fecha}" ${no ? "disabled" : ""}>
          <span class="cata-fecha__dia"><small>${DIAS[d.getDay()]}</small><b>${d.getDate()}</b><small>${MESES[d.getMonth()]}</small></span>
          <span class="cata-fecha__info">
            <strong>${c.bodega ? esc(c.bodega) : "Bodega a confirmar"}</strong>
            ${c.nota ? `<em>${esc(c.nota)}</em>` : ""}
            <span>${esc(estado)}</span>
          </span>
        </button>`;
    }).join("");
  }

  function pintarCataPasos() {
    const c = cataElegida();
    cs.personas = Math.min(cs.personas, maxPersonasCata());
    $("[data-cata-paso-personas]").classList.toggle("paso--bloqueado", !c);
    $("[data-cant-num]").textContent = cs.personas;
    $("[data-cant='-1']").disabled = cs.personas <= 1;
    $("[data-cant='1']").disabled = cs.personas >= maxPersonasCata();
    const total = cs.personas * C.precio;
    $("[data-cata-total]").innerHTML = `${textoPersonas(cs.personas)} × ${plata(C.precio)} = <b>${plata(total)}</b>`;
    $("[data-cant-nota]").textContent = c && cs.personas >= maxPersonasCata()
      ? (c.libres <= cs.max ? `Quedan ${c.libres} lugares para esa fecha.` : `Para más de ${cs.max} personas escribinos por WhatsApp.`)
      : "";

    $("[data-cata-paso-restr]").classList.toggle("paso--bloqueado", !c);
    $$("[data-restr-op]").forEach((b) => b.setAttribute("aria-pressed", cs.restr === b.dataset.restrOp));
    $("[data-restr-caja]").hidden = cs.restr !== "si";

    const listo = c && cs.restr;
    $("[data-cata-paso-datos]").classList.toggle("paso--bloqueado", !listo);
    $("[data-cata-confirmar]").hidden = !listo;
    if (listo) {
      const d = deISO(c.fecha);
      $("[data-cata-resumen]").textContent = [mayus(fechaLarga(d)), `${C.hora} hs`, c.bodega || null, textoPersonas(cs.personas)].filter(Boolean).join(" · ");
      const sena = Math.round(total * C.senaPorc / 100);
      $("[data-cata-sena]").innerHTML = `Seña a transferir: <b>${plata(sena)}</b><span>El resto (${plata(total - sena)}) se abona el día de la cata.</span>`;
    }
  }

  $("[data-catas]").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-cata-fecha]"); if (!b || b.disabled) return;
    cs.fecha = b.dataset.cataFecha;
    $$("[data-cata-fecha]").forEach((x) => x.setAttribute("aria-pressed", x === b));
    pintarCataPasos();
  });
  $$("[data-cant]").forEach((b) => b.addEventListener("click", () => {
    cs.personas = Math.max(1, Math.min(maxPersonasCata(), cs.personas + Number(b.dataset.cant)));
    pintarCataPasos();
  }));
  $("[data-restr]").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-restr-op]"); if (!b) return;
    cs.restr = b.dataset.restrOp;
    pintarCataPasos();
    if (cs.restr === "si") textoRestr.focus();
  });

  formCata.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const err = $("[data-cata-error]");
    if (cs.restr === "si" && textoRestr.value.trim().length < 3) { err.textContent = "Contanos cuál es la restricción alimentaria."; textoRestr.focus(); return; }
    const [datos, msg, campo] = validarDatos(camposCata);
    if (!datos) { err.textContent = msg; campo.focus(); return; }
    err.textContent = "";

    const boton = $("[data-cata-boton]");
    boton.disabled = true;
    $("[data-cata-boton-texto]").textContent = "Reservando…";
    const pedido = {
      accion: "reservarCata",
      fecha: cs.fecha,
      personas: cs.personas,
      restriccion: cs.restr,
      restricciones: cs.restr === "si" ? textoRestr.value.trim() : "",
      ...datos
    };
    try {
      let r;
      if (MODO_PRUEBA) {
        await new Promise((ok) => setTimeout(ok, 600));
        const id = "prueba" + Date.now().toString(36);
        const total = cs.personas * C.precio;
        const vence = new Date(Date.now() + C.horasParaPagar * 3600000);
        const c = cataElegida();
        pruebaPagos[id] = {
          ok: true, id, fecha: cs.fecha, hora: C.hora, bodega: c.bodega, nombre: datos.nombre.split(" ")[0], personas: cs.personas,
          total, sena: Math.round(total * C.senaPorc / 100), estado: "pendiente",
          vence: `${fechaISO(vence)} ${vence.toTimeString().slice(0, 8)}`,
          pago: { alias: "ALIAS.DE.EJEMPLO", titular: "Nombre del titular", cbu: "", banco: "" }
        };
        r = { ok: true, id };
      } else r = await apiPost(pedido);

      if (r.ok) { location.hash = `#/pago/${r.id}`; return; }
      err.textContent = r.error || "No se pudo reservar. Probá de nuevo.";
      if (r.lleno) { await traerCatas(true); pintarCatas(); pintarCataPasos(); }
    } catch (e) {
      err.textContent = "No hay conexión. Probá de nuevo en un momento.";
    } finally {
      boton.disabled = false;
      $("[data-cata-boton-texto]").textContent = "Reservar y pagar la seña";
    }
  });

  /* =========================================================
     PAGO DE LA SEÑA (#/pago/<código>)
     ========================================================= */
  let pagoActual = null;

  async function pintarPago(id) {
    const cont = $("[data-pago]");
    $("[data-pago-wa]").href = wa(`¡Hola AMO! Tengo una consulta sobre la seña de la cata (código ${id}).`);
    cont.innerHTML = '<p class="catas__cargando" style="text-align:center;margin-top:3rem">Cargando tu reserva…</p>';
    try {
      const r = MODO_PRUEBA ? (pruebaPagos[id] || { ok: false, error: "No encontramos esa reserva (modo prueba)." }) : await apiGet({ accion: "pago", id });
      if (!r.ok) throw new Error(r.error || "No encontramos esa reserva.");
      pagoActual = r;
      dibujarPago();
    } catch (e) {
      cont.innerHTML = `
        <div class="exito">
          <img src="img/icono-copa.png" alt="" width="113" height="208">
          <h1 class="exito__titulo" style="font-size:2rem">No encontramos tu reserva</h1>
          <p class="exito__mail">${esc(e.message === "Failed to fetch" ? "No hay conexión. Probá de nuevo en un momento." : e.message)}</p>
          <a class="boton boton--linea" href="#/cata"><span>Ir a las catas</span></a>
        </div>`;
    }
  }

  // copia: el texto que se copia (false = sin botón)
  function filaCopiar(etiqueta, valor, copia = valor) {
    return `
      <div class="pago__fila">
        <dt>${esc(etiqueta)}</dt>
        <dd><span>${esc(valor)}</span>${copia ? `<button type="button" class="copiar" data-copiar="${esc(copia)}">Copiar</button>` : ""}</dd>
      </div>`;
  }

  function botonSubir(texto) {
    return `
      <label class="boton boton--oro boton--ancho subir" data-subir>
        <input type="file" accept="image/*,application/pdf" data-comprobante>
        <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 16V4M7 9l5-5 5 5M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4"/></svg>
        <span data-subir-texto>${esc(texto)}</span>
      </label>
      <p class="confirmar__error" data-pago-error aria-live="assertive"></p>`;
  }

  function dibujarPago() {
    const p = pagoActual;
    const d = deISO(p.fecha);
    const resumen = `
      <div class="pago__resumen">
        <p>${esc(mayus(fechaLarga(d)))} · ${esc(p.hora)} hs</p>
        <span>Cata${p.bodega ? ` con ${esc(p.bodega)}` : ""} · ${textoPersonas(p.personas)}</span>
      </div>`;
    const copa = '<img class="pago__copa" src="img/icono-copa.png" alt="" width="113" height="208">';
    let html = "";

    if (p.estado === "pendiente") {
      const venceHora = p.vence.slice(11, 16);
      const esHoy = p.vence.slice(0, 10) === fechaISO(new Date());
      html = `
        ${copa}
        <p class="pago__etiqueta">Último paso</p>
        <h1 class="pagina__titulo">Transferí la seña</h1>
        <p class="pagina__bajada">Hola${p.nombre ? `, ${esc(mayus(p.nombre.toLowerCase()))}` : ""}. Te guardamos el lugar hasta las <b>${esc(venceHora)} hs${esc(esHoy ? "" : " de mañana")}</b>.</p>
        ${resumen}
        <dl class="pago__datos">
          ${filaCopiar("Monto", plata(p.sena), String(p.sena))}
          ${filaCopiar("Alias", p.pago.alias)}
          ${filaCopiar("Titular", p.pago.titular, false)}
          ${p.pago.cbu ? filaCopiar("CBU", p.pago.cbu) : ""}
          ${p.pago.banco ? filaCopiar("Banco", p.pago.banco, false) : ""}
        </dl>
        <p class="pago__nota">Después de transferir, subí la captura del comprobante acá.</p>
        ${botonSubir("Subir comprobante")}
        <p class="pago__nota pago__nota--chica">El resto (${plata(p.total - p.sena)}) se abona el día de la cata. La seña no es reembolsable. También te mandamos estos datos por mail.</p>`;
    } else if (p.estado === "revisar") {
      html = `
        <div class="exito">
          ${copa}
          <h1 class="exito__titulo">¡Recibimos tu comprobante!</h1>
          <p class="exito__texto">Lo revisamos y te confirmamos por mail. Tu lugar queda guardado.</p>
          ${resumen}
          <a class="boton boton--linea" href="#/"><span>Volver al inicio</span></a>
        </div>`;
    } else if (p.estado === "pagada") {
      html = `
        <div class="exito">
          ${copa}
          <h1 class="exito__titulo">¡Lugar confirmado!</h1>
          <p class="exito__texto">Recibimos tu seña. Te esperamos.</p>
          ${resumen}
          <p class="exito__mail">El día de la cata se abonan ${plata(p.total - p.sena)}.</p>
          <a class="boton boton--linea" href="#/"><span>Volver al inicio</span></a>
        </div>`;
    } else if (p.estado === "vencida") {
      html = `
        ${copa}
        <h1 class="pagina__titulo">Se venció el tiempo</h1>
        <p class="pagina__bajada">Pasaron más de ${C.horasParaPagar} horas sin el comprobante y el lugar se liberó.</p>
        ${resumen}
        <p class="pago__nota">¿Ya transferiste? Subí el comprobante igual: si todavía hay lugar, lo revisamos.</p>
        ${botonSubir("Subir comprobante igual")}
        <a class="boton boton--linea boton--ancho" href="#/cata" style="margin-top:1rem"><span>Reservar de nuevo</span></a>`;
    } else {
      html = `
        <div class="exito">
          ${copa}
          <h1 class="exito__titulo">Reserva cancelada</h1>
          <p class="exito__texto">Si tenés dudas, escribinos por WhatsApp.</p>
          ${resumen}
          <a class="boton boton--linea" href="#/cata"><span>Ver otras fechas</span></a>
        </div>`;
    }
    $("[data-pago]").innerHTML = html;
  }

  // Achica las fotos antes de mandarlas (las capturas pesan mucho)
  function leerArchivo(file) {
    const aBase64 = (blob) => new Promise((ok, mal) => {
      const fr = new FileReader();
      fr.onload = () => ok(String(fr.result).split(",")[1]);
      fr.onerror = mal;
      fr.readAsDataURL(blob);
    });
    if (file.type === "application/pdf") {
      if (file.size > 5 * 1024 * 1024) return Promise.reject(new Error("El PDF es muy pesado. Mandá una captura de pantalla."));
      return aBase64(file).then((datos) => ({ tipo: file.type, datos }));
    }
    return new Promise((ok, mal) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const max = 1600;
        const k = Math.min(1, max / Math.max(img.width, img.height));
        const cv = document.createElement("canvas");
        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        ok({ tipo: "image/jpeg", datos: cv.toDataURL("image/jpeg", 0.82).split(",")[1] });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        if (/^image\/(jpeg|png|webp|heic)$/.test(file.type) && file.size < 5 * 1024 * 1024) aBase64(file).then((datos) => ok({ tipo: file.type, datos }), mal);
        else mal(new Error("No pudimos leer ese archivo. Probá con una captura de pantalla."));
      };
      img.src = url;
    });
  }

  document.addEventListener("change", async (ev) => {
    const input = ev.target.closest("[data-comprobante]");
    if (!input || !input.files[0] || !pagoActual) return;
    const err = $("[data-pago-error]");
    const label = $("[data-subir]");
    const texto = $("[data-subir-texto]");
    const original = texto.textContent;
    err.textContent = "";
    label.classList.add("is-subiendo");
    texto.textContent = "Subiendo…";
    try {
      const arch = await leerArchivo(input.files[0]);
      let r;
      if (MODO_PRUEBA) { await new Promise((ok) => setTimeout(ok, 900)); pagoActual.estado = "revisar"; r = { ok: true, estado: "revisar" }; }
      else r = await apiPost({ accion: "comprobante", id: pagoActual.id, tipo: arch.tipo, archivo: arch.datos });
      if (!r.ok) throw new Error(r.error || "No se pudo subir. Probá de nuevo.");
      pagoActual.estado = r.estado || "revisar";
      dibujarPago();
      window.scrollTo(0, 0);
    } catch (e) {
      err.textContent = e.message === "Failed to fetch" ? "No hay conexión. Probá de nuevo." : e.message;
      label.classList.remove("is-subiendo");
      texto.textContent = original;
      input.value = "";
    }
  });

  document.addEventListener("click", async (ev) => {
    const b = ev.target.closest("[data-copiar]");
    if (!b) return;
    const valor = b.dataset.copiar;
    try { await navigator.clipboard.writeText(valor); }
    catch (e) {
      const t = document.createElement("textarea"); t.value = valor; document.body.appendChild(t); t.select();
      try { document.execCommand("copy"); } catch (e2) {}
      t.remove();
    }
    b.textContent = "¡Copiado!"; b.classList.add("is-ok");
    setTimeout(() => { b.textContent = "Copiar"; b.classList.remove("is-ok"); }, 1600);
  });

  /* ---------- Instalar en el celular ---------- */
  const enApp = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const esCelu = esIOS || /android/i.test(navigator.userAgent);
  const btnInstalar = $("[data-instalar]");
  const hojaInstalar = $("[data-instalar-hoja]");
  let pedidoInstalar = null;

  if (!enApp && esCelu) btnInstalar.hidden = false;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); pedidoInstalar = e; if (!enApp) btnInstalar.hidden = false; });
  window.addEventListener("appinstalled", () => { pedidoInstalar = null; btnInstalar.hidden = true; });

  btnInstalar.addEventListener("click", async () => {
    if (pedidoInstalar) {
      pedidoInstalar.prompt();
      const r = await pedidoInstalar.userChoice;
      pedidoInstalar = null;
      if (r.outcome === "accepted") btnInstalar.hidden = true;
      return;
    }
    const pasos = esIOS
      ? ["Abrí esta página en <b>Safari</b>.", "Tocá el botón <b>Compartir</b> (el cuadradito con la flecha para arriba).", "Elegí <b>Agregar a inicio</b> y tocá <b>Agregar</b>."]
      : ["Tocá el menú <b>⋮</b> de Chrome.", "Elegí <b>Agregar a la pantalla principal</b> o <b>Instalar app</b>.", "Confirmá con <b>Instalar</b> o <b>Agregar</b>."];
    $("[data-instalar-pasos]").innerHTML = pasos.map((p) => `<li><span>${p}</span></li>`).join("");
    hojaInstalar.hidden = false;
  });
  hojaInstalar.addEventListener("click", (ev) => { if (ev.target.closest("[data-instalar-cerrar]")) hojaInstalar.hidden = true; });
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") hojaInstalar.hidden = true; });

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  /* ---------- Navegación ---------- */
  const vistas = {
    inicio: $("#vista-inicio"), reservar: $("#vista-reservar"), cata: $("#vista-cata"), pago: $("#vista-pago"),
    menu: $("#vista-menu"), plato: $("#vista-plato"), eventos: $("#vista-eventos")
  };

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
    else if (partes[0] === "cata") { pintarCataVista(partes[1]); mostrar("cata"); document.title = "Cata de vinos · AMO"; }
    else if (partes[0] === "pago" && partes[1]) { pintarPago(decodeURIComponent(partes[1])); mostrar("pago"); document.title = "Seña · AMO"; }
    else if (partes[0] === "menu" && partes[1]) { pintarPlato(decodeURIComponent(partes[1])); mostrar("plato"); }
    else if (partes[0] === "menu") { mostrar("menu"); document.title = "Menú · AMO"; }
    else if (partes[0] === "eventos") {
      mostrar("eventos"); document.title = "Eventos · AMO";
      pintarEventos();
      traerCatas().then(pintarEventos).catch(() => {});
    }
    else mostrar("inicio");

    window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", rutear);
  rutear();
})();