/* AMO Reservas - app del dueño
   Lee y escribe las reservas en el Apps Script de Google (data.js → reservas.api).
   Si "api" está vacío, arranca en MODO DEMO con datos de ejemplo. */

(function () {
  const CFG = Object.assign({ dias: [4, 5, 6], horarios: ["20:00", "22:00"], semanasAdelante: 4, api: "" }, (window.AMO && window.AMO.config.reservas) || {});
  const S = window.AMO_SALON;
  const DEMO = !CFG.api;
  const TOTAL_MESAS = S.mesas.length;

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  /* ---------- Fechas ---------- */
  const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const mayus = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const aFecha = (f) => { const [a, m, d] = f.split("-").map(Number); return new Date(a, m - 1, d); };
  const sumar = (f, n) => { const d = aFecha(f); d.setDate(d.getDate() + n); return iso(d); };
  const larga = (f) => { const d = aFecha(f); return `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`; };
  const corta = (f) => { const d = aFecha(f); return `${mayus(DIAS[d.getDay()].slice(0, 3))} ${d.getDate()}/${d.getMonth() + 1}`; };
  const hoyLocal = () => iso(new Date());

  /* ---------- Almacenamiento local (con cuidado) ---------- */
  const guardado = {
    leer(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    escribir(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} }
  };

  /* ---------- Estado ---------- */
  const st = {
    clave: guardado.leer("amo-clave") || "",
    datos: null,
    desde: null,
    fecha: hoyLocal(),
    tab: "noche",
    visto: guardado.leer("amo-visto") || "",
    cargando: false
  };
  try { const d = JSON.parse(guardado.leer("amo-datos") || "null"); if (d && d.reservas) st.datos = d; } catch (e) {}

  /* ---------- Backend ---------- */
  async function llamar(accion, extra = {}) {
    const datos = Object.assign({ accion, clave: st.clave }, extra);
    if (DEMO) return demo(datos);
    const r = await fetch(CFG.api, { method: "POST", body: JSON.stringify(datos) });
    return r.json();
  }

  async function cargar({ silencioso = false } = {}) {
    if (!st.clave) return mostrarLogin();
    const desde = [hoyLocal(), st.fecha].sort()[0];
    const boton = $("[data-actualizar]");
    boton.classList.add("is-girando");
    try {
      const r = await llamar("panel", { desde });
      if (!r.ok) {
        if (/contraseña/i.test(r.error || "")) { salir(); return mostrarLogin(r.error); }
        throw new Error(r.error);
      }
      st.datos = r; st.desde = desde;
      if (!st.visto) { st.visto = r.ahora; guardado.escribir("amo-visto", st.visto); }
      guardado.escribir("amo-datos", JSON.stringify(r));
      bandaEstado(null);
      if (DEMO && !demo.saltado) {
        demo.saltado = true;
        const primera = r.reservas.map((x) => x.fecha).sort()[0];
        if (primera && !r.reservas.some((x) => x.fecha === st.fecha)) st.fecha = primera;
      }
      mostrarApp();
      pintar();
    } catch (e) {
      bandaEstado(st.datos ? "Sin conexión. Estás viendo lo último que se cargó." : "Sin conexión. Probá de nuevo en un momento.");
      if (st.datos) { mostrarApp(); pintar(); }
      if (!silencioso && !st.datos) mostrarLogin("No pudimos conectar. Revisá internet.");
    } finally {
      boton.classList.remove("is-girando");
    }
  }

  async function accion(nombre, extra, okMsg) {
    try {
      const r = await llamar(nombre, extra);
      if (!r.ok) { aviso(r.error || "No se pudo guardar."); return false; }
      if (okMsg) aviso(okMsg);
      await cargar({ silencioso: true });
      return true;
    } catch (e) {
      aviso("Sin conexión. No se guardó.");
      return false;
    }
  }

  /* ---------- Datos derivados ---------- */
  const reservas = () => (st.datos ? st.datos.reservas : []);
  const bloqueos = () => (st.datos ? st.datos.bloqueos : []);
  const deNoche = (f) => reservas().filter((r) => r.fecha === f);
  const activas = (f) => deNoche(f).filter((r) => r.estado === "confirmada");
  const bloqueosDe = (f) => bloqueos().filter((b) => b.fecha === f);
  const cierreDe = (f) => bloqueosDe(f).find((b) => b.mesa === "todas");
  const esNueva = (r) => r.origen === "web" && r.estado === "confirmada" && st.visto && r.creada > st.visto;
  const nuevas = () => reservas().filter(esNueva);
  const mesaDe = (num) => S.mesas.find((m) => m.num === num);

  function estadoMesas(f) {
    const mapa = {};
    activas(f).filter((r) => r.mesa !== "armada").forEach((r) => (mapa[Number(r.mesa)] = { tipo: "reserva", r }));
    bloqueosDe(f).filter((b) => b.mesa !== "todas").forEach((b) => { if (!mapa[Number(b.mesa)]) mapa[Number(b.mesa)] = { tipo: "bloqueo", b }; });
    if (cierreDe(f)) S.mesas.forEach((m) => { if (!mapa[m.num]) mapa[m.num] = { tipo: "bloqueo", b: cierreDe(f) }; });
    return mapa;
  }

  const personasDe = (lista) => lista.reduce((t, r) => t + Number(r.personas || 0), 0);
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

  /* ---------- Pantallas ---------- */
  function mostrarLogin(msg) {
    $("[data-login]").hidden = false;
    $("[data-app]").hidden = true;
    $("[data-login-error]").textContent = msg || (DEMO ? "Modo demo: entrá con cualquier contraseña." : "");
  }
  function mostrarApp() {
    $("[data-login]").hidden = true;
    $("[data-app]").hidden = false;
  }

  function irA(tab) {
    st.tab = tab;
    $$("[data-tab]").forEach((b) => (b.getAttribute("data-tab") === tab ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current")));
    $$("[data-vista]").forEach((v) => (v.hidden = v.dataset.vista !== tab));
    $("[data-nueva]").hidden = tab === "ajustes";
    window.scrollTo(0, 0);
  }

  function pintar() {
    pintarNoche();
    pintarProximos();
    pintarAjustes();
    pintarNuevas();
  }

  /* ----- Noche ----- */
  function pintarNoche() {
    const f = st.fecha;
    const hoy = hoyLocal();
    $("[data-fecha-texto]").textContent = mayus(larga(f));
    $("[data-fecha-etiqueta]").textContent =
      f === hoy ? "Hoy" : f === sumar(hoy, 1) ? "Mañana" : f === sumar(hoy, -1) ? "Ayer" : "Noche del";
    $("[data-fecha-input]").value = f;

    const cierre = cierreDe(f);
    $("[data-cerrado]").hidden = !cierre;
    if (cierre) $("[data-cerrado-motivo]").textContent = cierre.motivo ? `· ${cierre.motivo}` : "";

    const act = activas(f);
    const mapa = estadoMesas(f);
    const libres = TOTAL_MESAS - Object.keys(mapa).length;
    const llegaron = act.filter((r) => r.asistencia === "llegó").length;
    $("[data-numeros]").innerHTML = `
      <div class="numero numero--oro"><b>${act.length}</b><span>${act.length === 1 ? "Reserva" : "Reservas"}</span></div>
      <div class="numero"><b>${personasDe(act)}</b><span>Personas</span></div>
      <div class="numero"><b>${libres}<small style="font-size:.9rem;color:var(--crema-tenue)"> / ${TOTAL_MESAS}</small></b><span>Mesas libres</span></div>
      <div class="numero"><b>${llegaron}<small style="font-size:.9rem;color:var(--crema-tenue)"> / ${act.length}</small></b><span>Llegaron</span></div>`;

    pintarPlano(f, mapa);
    pintarLista(f);
  }

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
    if (r.tipo === "puerta") return `<g class="ref ref--puerta"><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="3"/><text x="${cx}" y="${r.y + r.h + 26}">${esc(r.texto)}</text></g>`;
    if (r.tipo === "pared") return `<g class="ref ref--pared"><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="3"/><text x="${r.x + r.w + 22}" y="${cy}" transform="rotate(-90 ${r.x + r.w + 22} ${cy})">${esc(r.texto)}</text></g>`;
    const rot = r.vertical ? ` transform="rotate(-90 ${cx} ${cy})"` : "";
    return `<g class="ref ref--bloque"><rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="6"/><text x="${cx}" y="${cy}"${rot}>${esc(r.texto)}</text></g>`;
  }

  function pintarPlano(f, mapa) {
    $("[data-plano]").innerHTML = `
      <svg viewBox="-30 -10 ${S.ancho + 50} ${S.alto + 20}" class="plano__svg" role="group" aria-label="Plano del salón">
        <defs>
          <pattern id="rayado" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="14" height="14" fill="#15283B"/><line x1="0" y1="0" x2="0" y2="14" stroke="rgba(247,245,239,.35)" stroke-width="4"/>
          </pattern>
        </defs>
        <rect class="plano__piso" x="-20" y="-6" width="${S.ancho + 40}" height="${S.alto + 12}" rx="10"/>
        ${S.referencias.map(referencia).join("")}
        ${S.mesas.map((m) => {
          const e = mapa[m.num];
          let clase = "", hora = "", etiqueta = `Mesa ${m.num}, para ${m.cap}, libre`;
          if (e && e.tipo === "reserva") {
            clase = e.r.asistencia === "llegó" ? "is-llego" : e.r.asistencia === "no vino" ? "is-novino" : "is-reservada";
            hora = e.r.hora;
            etiqueta = `Mesa ${m.num}, ${e.r.nombre}, ${e.r.personas} personas, ${e.r.hora}`;
          } else if (e) { clase = "is-bloq"; etiqueta = `Mesa ${m.num}, bloqueada`; }
          const cy = m.y + m.h / 2;
          return `
            <g class="mesa ${clase}" data-mesa="${m.num}" tabindex="0" role="button" aria-label="${esc(etiqueta)}">
              <rect class="mesa__zona" x="${m.x - 26}" y="${m.y - 26}" width="${m.w + 52}" height="${m.h + 52}" rx="12"/>
              ${sillas(m)}
              <rect class="mesa__tabla" x="${m.x}" y="${m.y}" width="${m.w}" height="${m.h}" rx="8"/>
              <text class="mesa__num" x="${m.x + m.w / 2}" y="${hora ? cy - 9 : cy}" ${hora ? 'style="font-size:34px"' : ""}>${m.num}</text>
              ${hora ? `<text class="mesa__hora" x="${m.x + m.w / 2}" y="${cy + 22}">${esc(hora)}</text>` : ""}
            </g>`;
        }).join("")}
      </svg>`;
  }

  function itemReserva(r) {
    const armada = r.mesa === "armada";
    const clase = r.estado !== "confirmada" ? "is-cancelada" : r.asistencia === "llegó" ? "is-llego" : r.asistencia === "no vino" ? "is-novino" : "";
    const chips = [];
    if (esNueva(r)) chips.push('<span class="chip chip--nueva">Nueva</span>');
    if (r.estado !== "confirmada") chips.push('<span class="chip chip--cancelada">Cancelada</span>');
    else if (r.asistencia === "llegó") chips.push('<span class="chip chip--llego">Llegó</span>');
    else if (r.asistencia === "no vino") chips.push('<span class="chip chip--novino">No vino</span>');
    if (r.origen === "manual") chips.push('<span class="chip chip--manual">A mano</span>');
    return `
      <button class="item ${clase}" data-reserva="${esc(r.id)}">
        <span class="item__mesa${armada ? " item__mesa--armada" : ""}">${armada ? `${esc(r.personas)}<small>armada</small>` : esc(r.mesa)}</span>
        <span>
          <span class="item__nombre">${esc(r.nombre)}</span>
          <span class="item__detalle" style="display:block">${esc(r.personas)} pers. · ${esc(r.hora)} hs${r.telefono ? ` · ${esc(r.telefono)}` : ""}</span>
        </span>
        <span class="item__chips">${chips.join("")}</span>
      </button>`;
  }

  function pintarLista(f) {
    const act = activas(f);
    const canceladas = deNoche(f).filter((r) => r.estado !== "confirmada");
    const horas = [...new Set(act.map((r) => r.hora))].sort();
    let html = "";
    if (!act.length) {
      html = `<div class="vacio"><img src="../img/icono-copa.png" alt="">${cierreDe(f) ? "Noche cerrada." : "No hay reservas para esta noche."}</div>`;
    }
    html += horas.map((h) => {
      const grupo = act.filter((r) => r.hora === h).sort((a, b) => (a.mesa === "armada") - (b.mesa === "armada") || Number(a.mesa) - Number(b.mesa));
      return `
        <section class="grupo">
          <div class="grupo__titulo"><h2>${esc(h)} hs</h2><span>${plural(grupo.length, "reserva", "reservas")} · ${personasDe(grupo)} pers.</span></div>
          ${grupo.map(itemReserva).join("")}
        </section>`;
    }).join("");
    if (canceladas.length) {
      html += `<details class="desplegable"><summary>Canceladas (${canceladas.length})</summary>${canceladas.map(itemReserva).join("")}</details>`;
    }
    $("[data-lista]").innerHTML = html;
  }

  /* ----- Próximos ----- */
  function pintarProximos() {
    const hoy = hoyLocal();
    const dias = [];
    for (let i = 0; i < CFG.semanasAdelante * 7 + 7; i++) {
      const f = sumar(hoy, i);
      const d = aFecha(f);
      if (CFG.dias.includes(d.getDay()) || deNoche(f).length || bloqueosDe(f).length) dias.push(f);
    }
    $("[data-dias]").innerHTML = dias.map((f) => {
      const d = aFecha(f);
      const act = activas(f);
      const ocupadas = Object.keys(estadoMesas(f)).length;
      const cerrada = cierreDe(f);
      const nuevasDia = act.filter(esNueva).length;
      return `
        <button class="dia-fila${f === hoy ? " is-hoy" : ""}" data-ir-fecha="${f}">
          <span class="dia-fila__fecha"><small>${DIAS[d.getDay()].slice(0, 3)}</small><b>${d.getDate()}</b><span>${MESES[d.getMonth()].slice(0, 3)}</span></span>
          <span class="dia-fila__info">
            <p>${cerrada ? "Noche cerrada" : act.length ? `${plural(act.length, "reserva", "reservas")} · ${personasDe(act)} personas` : "Sin reservas todavía"}</p>
            <span class="sub">${cerrada ? esc(cerrada.motivo || "No se toman reservas") : `${ocupadas} de ${TOTAL_MESAS} mesas ocupadas`}</span>
            <span class="ocupacion"><i style="width:${cerrada ? 100 : Math.round((ocupadas / TOTAL_MESAS) * 100)}%${cerrada ? ";background:var(--rojo)" : ""}"></i></span>
          </span>
          <span class="dia-fila__chips">
            ${f === hoy ? '<span class="chip chip--manual">Hoy</span>' : ""}
            ${nuevasDia ? `<span class="chip chip--nueva">${nuevasDia} ${nuevasDia === 1 ? "nueva" : "nuevas"}</span>` : ""}
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>
          </span>
        </button>`;
    }).join("");
  }

  /* ----- Ajustes ----- */
  function pintarAjustes() {
    const hoy = hoyLocal();
    const cerradas = bloqueos().filter((b) => b.mesa === "todas" && b.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha));
    $("[data-cerradas]").innerHTML = cerradas.length
      ? cerradas.map((b) => `<li><div><strong>${esc(mayus(larga(b.fecha)))}</strong><br><span>${esc(b.motivo || "Sin motivo")}</span></div><button class="btn btn--chico" data-desbloquear="${esc(b.id)}">Reabrir</button></li>`).join("")
      : "";
    const inp = $("[data-cerrar-fecha]");
    inp.min = hoy;
    if (!inp.value) inp.value = proximaNoche();
  }

  function proximaNoche() {
    for (let i = 0; i < 14; i++) { const f = sumar(hoyLocal(), i); if (CFG.dias.includes(aFecha(f).getDay())) return f; }
    return hoyLocal();
  }

  /* ----- Nuevas ----- */
  function pintarNuevas() {
    const n = nuevas().length;
    $("[data-nuevas-btn]").hidden = !n;
    $("[data-nuevas-num]").textContent = n;
  }

  /* ---------- Hoja (detalle / formularios) ---------- */
  function abrirHoja(html) {
    $("[data-hoja-contenido]").innerHTML = html;
    $("[data-hoja]").hidden = false;
    document.body.style.overflow = "hidden";
    const foco = $("[data-hoja] [autofocus]") || $("[data-hoja] .hoja__x");
    if (foco) foco.focus();
  }
  function cerrarHoja() {
    $("[data-hoja]").hidden = true;
    document.body.style.overflow = "";
  }

  const icono = {
    tel: '<svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
    wa: '<svg viewBox="0 0 24 24"><path d="M3.5 20.5l1.3-4.6A8.5 8.5 0 1 1 8.2 19.3L3.5 20.5Z"/><path d="M9 9.5c.3 2 2 4 4.5 5l1.2-1.2 2 1-.5 1.5c-3.5.5-8.2-3.8-8-7.5L9.7 8l1 2-1.2 1"/></svg>',
    mail: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5.5" width="17" height="13" rx="1.5"/><path d="M4 7l8 6 8-6"/></svg>'
  };

  function waLink(tel) {
    let d = String(tel || "").replace(/\D/g, "");
    if (!d) return "";
    if (d.startsWith("0")) d = d.slice(1);
    if (d.length === 10) d = "549" + d;
    return `https://wa.me/${d}`;
  }

  function detalleReserva(id) {
    const r = reservas().find((x) => x.id === id);
    if (!r) return;
    const armada = r.mesa === "armada";
    const tel = String(r.telefono || "").replace(/[^\d+]/g, "");
    const cancelada = r.estado !== "confirmada";
    const creada = r.creada ? `${corta(r.creada.slice(0, 10))} ${r.creada.slice(11, 16)}` : "";
    abrirHoja(`
      <div class="det__cabeza">
        <span class="item__mesa${armada ? " item__mesa--armada" : ""}">${armada ? `${esc(r.personas)}<small>armada</small>` : esc(r.mesa)}</span>
        <div>
          <h2 id="hoja-titulo">${esc(r.nombre)}</h2>
          <p>${armada ? "Mesa armada" : `Mesa ${esc(r.mesa)}`} · ${esc(r.personas)} personas · ${esc(r.hora)} hs</p>
        </div>
      </div>
      <div class="det__contacto">
        <a href="${tel ? `tel:${esc(tel)}` : "#"}" ${tel ? "" : 'aria-disabled="true" style="opacity:.35;pointer-events:none"'}>${icono.tel}Llamar</a>
        <a href="${esc(waLink(r.telefono)) || "#"}" target="_blank" rel="noopener" ${tel ? "" : 'aria-disabled="true" style="opacity:.35;pointer-events:none"'}>${icono.wa}WhatsApp</a>
        <a href="${r.email ? `mailto:${esc(r.email)}` : "#"}" ${r.email ? "" : 'aria-disabled="true" style="opacity:.35;pointer-events:none"'}>${icono.mail}Mail</a>
      </div>
      <dl class="det__datos">
        <div><dt>Noche</dt><dd>${esc(mayus(larga(r.fecha)))}</dd></div>
        <div><dt>Teléfono</dt><dd>${esc(r.telefono || "—")}</dd></div>
        <div><dt>Mail</dt><dd>${esc(r.email || "—")}</dd></div>
        ${r.nota ? `<div><dt>Nota</dt><dd>${esc(r.nota)}</dd></div>` : ""}
        <div><dt>Origen</dt><dd>${r.origen === "manual" ? "Cargada a mano" : `Web${creada ? ` · ${esc(creada)}` : ""}`}</dd></div>
        ${cancelada ? '<div><dt>Estado</dt><dd style="color:var(--rojo)">Cancelada</dd></div>' : ""}
      </dl>
      ${cancelada ? "" : `
      <div class="det__acciones">
        <button class="btn btn--verde ${r.asistencia === "llegó" ? "btn--activo" : ""}" data-asistencia="${r.asistencia === "llegó" ? "" : "llegó"}" data-id="${esc(r.id)}">Llegó</button>
        <button class="btn btn--rojo ${r.asistencia === "no vino" ? "btn--activo" : ""}" data-asistencia="${r.asistencia === "no vino" ? "" : "no vino"}" data-id="${esc(r.id)}">No vino</button>
        <button class="btn btn--peligro btn--ancho" data-cancelar="${esc(r.id)}">Cancelar reserva</button>
      </div>`}`);
  }

  function detalleMesa(num) {
    const m = mesaDe(num);
    const e = estadoMesas(st.fecha)[num];
    if (e && e.tipo === "reserva") return detalleReserva(e.r.id);
    const cierre = cierreDe(st.fecha);
    if (e && e.tipo === "bloqueo") {
      return abrirHoja(`
        <h2 class="det__titulo" id="hoja-titulo">Mesa ${num}</h2>
        <p class="tarjeta__texto">Para ${m.cap} personas · Bloqueada esta noche${e.b.motivo ? ` · ${esc(e.b.motivo)}` : ""}.</p>
        ${cierre ? '<p class="tarjeta__texto">Toda la noche está cerrada. Podés reabrirla desde el aviso de arriba o en Ajustes.</p>'
          : `<button class="btn btn--oro btn--ancho" data-desbloquear="${esc(e.b.id)}">Desbloquear mesa</button>`}`);
    }
    abrirHoja(`
      <h2 class="det__titulo" id="hoja-titulo">Mesa ${num}</h2>
      <p class="tarjeta__texto">Para ${m.cap} personas · Libre el ${esc(larga(st.fecha))}.</p>
      <div class="det__acciones">
        <button class="btn btn--oro btn--ancho" data-nueva-en="${num}">Cargar reserva en esta mesa</button>
        <button class="btn btn--linea btn--ancho" data-bloquear-mesa="${num}">Bloquear esta noche</button>
      </div>`);
  }

  function formNueva(mesaInicial) {
    abrirHoja(`
      <h2 class="det__titulo" id="hoja-titulo">Cargar reserva</h2>
      <form class="form-reserva" data-form-nueva>
        <div class="doble">
          <label class="campo"><span class="campo__label">Noche</span>
            <input class="campo__input" type="date" name="fecha" required value="${st.fecha}"></label>
          <label class="campo"><span class="campo__label">Personas</span>
            <input class="campo__input" type="number" name="personas" min="1" max="200" required value="2" inputmode="numeric"></label>
        </div>
        <div class="campo"><span class="campo__label">Horario</span>
          <div class="opciones" data-horas-form>
            ${CFG.horarios.map((h, i) => `<button type="button" class="opcion" data-hora-form="${h}" aria-pressed="${i === 0}">${h}</button>`).join("")}
          </div>
        </div>
        <label class="campo"><span class="campo__label">Mesa</span>
          <select class="campo__input" name="mesa" required data-mesa-select></select></label>
        <label class="campo"><span class="campo__label">Nombre</span>
          <input class="campo__input" name="nombre" required maxlength="80" autocomplete="off" autofocus></label>
        <div class="doble">
          <label class="campo"><span class="campo__label">Teléfono</span>
            <input class="campo__input" name="telefono" type="tel" inputmode="tel" maxlength="30"></label>
          <label class="campo"><span class="campo__label">Mail (opcional)</span>
            <input class="campo__input" name="email" type="email" maxlength="120"></label>
        </div>
        <label class="campo"><span class="campo__label">Nota (opcional)</span>
          <input class="campo__input" name="nota" maxlength="200" placeholder="Cumpleaños, silla de bebé…"></label>
        <button class="btn btn--oro btn--ancho" type="submit">Guardar reserva</button>
        <p class="error" data-form-error></p>
      </form>`);
    llenarMesas(mesaInicial);
  }

  function llenarMesas(preferida) {
    const form = $("[data-form-nueva]"); if (!form) return;
    const f = form.fecha.value;
    const ocupadas = estadoMesas(f);
    const personas = Number(form.personas.value) || 1;
    const actual = preferida != null ? String(preferida) : form.mesa.value;
    const opciones = S.mesas.slice().sort((a, b) => a.num - b.num).map((m) => {
      const ocupada = !!ocupadas[m.num];
      const chica = personas > m.cap;
      return `<option value="${m.num}" ${ocupada ? "disabled" : ""}>Mesa ${m.num} · para ${m.cap}${ocupada ? " · ocupada" : chica ? " · chica" : ""}</option>`;
    });
    opciones.push('<option value="armada">Mesa armada (grupo grande)</option>');
    form.mesa.innerHTML = opciones.join("");
    const libre = S.mesas.find((m) => !ocupadas[m.num] && personas <= m.cap);
    const elegible = actual && [...form.mesa.options].some((o) => o.value === actual && !o.disabled);
    form.mesa.value = elegible ? actual : personas > 8 ? "armada" : libre ? String(libre.num) : "armada";
  }

  /* ---------- Avisos ---------- */
  let avisoTimer;
  function aviso(txt) {
    const a = $("[data-aviso]");
    a.textContent = txt; a.hidden = false;
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(() => (a.hidden = true), 2600);
  }

  function salir() {
    st.clave = ""; guardado.escribir("amo-clave", null);
  }

  /* ---------- Eventos ---------- */
  $("[data-login-form]").addEventListener("submit", (ev) => {
    ev.preventDefault();
    st.clave = $("[data-login-clave]").value;
    guardado.escribir("amo-clave", st.clave);
    $("[data-login-clave]").value = "";
    cargar();
  });

  $$("[data-tab]").forEach((b) => b.addEventListener("click", () => irA(b.dataset.tab)));
  $("[data-actualizar]").addEventListener("click", () => cargar().then(() => aviso("Actualizado")));

  $$("[data-dia-mover]").forEach((b) => b.addEventListener("click", () => {
    st.fecha = sumar(st.fecha, Number(b.dataset.diaMover));
    if (st.desde && st.fecha < st.desde) cargar(); else pintarNoche();
  }));
  $("[data-fecha-elegir]").addEventListener("click", () => {
    const inp = $("[data-fecha-input]");
    if (inp.showPicker) { try { inp.showPicker(); return; } catch (e) {} }
    inp.focus(); inp.click();
  });
  $("[data-fecha-input]").addEventListener("change", (ev) => {
    if (!ev.target.value) return;
    st.fecha = ev.target.value;
    if (st.desde && st.fecha < st.desde) cargar(); else pintarNoche();
  });

  $("[data-plano]").addEventListener("click", (ev) => { const g = ev.target.closest("[data-mesa]"); if (g) detalleMesa(Number(g.dataset.mesa)); });
  $("[data-plano]").addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter" && ev.key !== " ") return;
    const g = ev.target.closest("[data-mesa]"); if (!g) return;
    ev.preventDefault(); detalleMesa(Number(g.dataset.mesa));
  });

  document.addEventListener("click", async (ev) => {
    const t = ev.target.closest("button, a");
    if (!t) return;
    if (t.matches("[data-hoja-cerrar]") || t.closest(".hoja__fondo")) return cerrarHoja();
    if (t.dataset.reserva) return detalleReserva(t.dataset.reserva);
    if (t.dataset.irFecha) { st.fecha = t.dataset.irFecha; irA("noche"); return pintarNoche(); }

    if (t.hasAttribute("data-asistencia")) {
      t.disabled = true;
      await accion("asistencia", { id: t.dataset.id, valor: t.dataset.asistencia }, t.dataset.asistencia ? `Marcado: ${t.dataset.asistencia}` : "Desmarcado");
      return detalleReserva(t.dataset.id);
    }
    if (t.dataset.cancelar) {
      const r = reservas().find((x) => x.id === t.dataset.cancelar);
      if (!confirm(`¿Cancelar la reserva de ${r ? r.nombre : "esta persona"}? La mesa queda libre.`)) return;
      t.disabled = true;
      if (await accion("cancelar", { id: t.dataset.cancelar }, "Reserva cancelada")) cerrarHoja();
      return;
    }
    if (t.dataset.desbloquear) {
      t.disabled = true;
      if (await accion("desbloquear", { id: t.dataset.desbloquear }, "Listo, quedó abierta")) cerrarHoja();
      return;
    }
    if (t.dataset.bloquearMesa) {
      t.disabled = true;
      if (await accion("bloquear", { fecha: st.fecha, mesa: t.dataset.bloquearMesa, motivo: "" }, "Mesa bloqueada")) cerrarHoja();
      return;
    }
    if (t.dataset.nuevaEn) return formNueva(Number(t.dataset.nuevaEn));
    if (t.dataset.horaForm) {
      $$("[data-hora-form]").forEach((b) => b.setAttribute("aria-pressed", b === t));
      return;
    }
  });

  $("[data-reabrir]").addEventListener("click", async () => {
    const c = cierreDe(st.fecha); if (!c) return;
    await accion("desbloquear", { id: c.id }, "Noche reabierta");
  });

  $("[data-nueva]").addEventListener("click", () => formNueva());

  document.addEventListener("input", (ev) => {
    if (ev.target.closest("[data-form-nueva]") && (ev.target.name === "fecha" || ev.target.name === "personas")) llenarMesas();
  });

  document.addEventListener("submit", async (ev) => {
    const form = ev.target.closest("[data-form-nueva]");
    if (!form) return;
    ev.preventDefault();
    const err = $("[data-form-error]");
    const hora = ($("[data-hora-form][aria-pressed='true']") || {}).dataset;
    const datos = {
      fecha: form.fecha.value,
      hora: hora ? hora.horaForm : CFG.horarios[0],
      personas: form.personas.value,
      mesa: form.mesa.value,
      nombre: form.nombre.value.trim(),
      telefono: form.telefono.value.trim(),
      email: form.email.value.trim(),
      nota: form.nota.value.trim()
    };
    if (!datos.nombre) { err.textContent = "Falta el nombre."; form.nombre.focus(); return; }
    const boton = form.querySelector("[type=submit]");
    boton.disabled = true; boton.textContent = "Guardando…";
    const ok = await accion("agregar", datos, "Reserva cargada");
    boton.disabled = false; boton.textContent = "Guardar reserva";
    if (ok) { st.fecha = datos.fecha; cerrarHoja(); irA("noche"); pintarNoche(); }
  });

  $("[data-cerrar-form]").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const fecha = $("[data-cerrar-fecha]").value;
    if (!fecha) return;
    if (activas(fecha).length && !confirm(`Esa noche ya tiene ${plural(activas(fecha).length, "reserva", "reservas")}. Se mantienen, pero nadie más va a poder reservar. ¿Cerrar igual?`)) return;
    const ok = await accion("bloquear", { fecha, mesa: "todas", motivo: $("[data-cerrar-motivo]").value.trim() }, "Noche cerrada");
    if (ok) $("[data-cerrar-motivo]").value = "";
  });

  $("[data-nuevas-btn]").addEventListener("click", () => {
    const lista = nuevas().sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
    abrirHoja(`
      <h2 class="det__titulo" id="hoja-titulo">${plural(lista.length, "reserva nueva", "reservas nuevas")}</h2>
      <ul class="nuevas-lista">
        ${lista.map((r) => `
          <li><button data-ir-reserva="${esc(r.id)}">
            <span><strong>${esc(r.nombre)}</strong><span>${esc(corta(r.fecha))} · ${esc(r.hora)} hs · ${r.mesa === "armada" ? "Mesa armada" : `Mesa ${esc(r.mesa)}`} · ${esc(r.personas)} pers.</span></span>
            <span class="chip chip--nueva">Ver</span>
          </button></li>`).join("")}
      </ul>
      <button class="btn btn--oro btn--ancho" data-marcar-vistas>Marcar como vistas</button>`);
  });
  document.addEventListener("click", (ev) => {
    const ir = ev.target.closest("[data-ir-reserva]");
    if (ir) {
      const r = reservas().find((x) => x.id === ir.dataset.irReserva);
      if (r) { st.fecha = r.fecha; irA("noche"); pintarNoche(); detalleReserva(r.id); }
      return;
    }
    if (ev.target.closest("[data-marcar-vistas]")) {
      st.visto = [st.visto, st.datos && st.datos.ahora, ...reservas().map((r) => r.creada)].filter(Boolean).sort().pop();
      guardado.escribir("amo-visto", st.visto);
      cerrarHoja(); pintar(); aviso("Listo");
    }
  });

  $("[data-salir]").addEventListener("click", () => { salir(); guardado.escribir("amo-datos", null); st.datos = null; mostrarLogin(); });
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape" && !$("[data-hoja]").hidden) cerrarHoja(); });

  // Actualiza solo cada minuto (si no está cargando una reserva)
  setInterval(() => {
    if (document.visibilityState === "visible" && st.clave && $("[data-hoja]").hidden) cargar({ silencioso: true });
  }, 60000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && st.clave) cargar({ silencioso: true });
  });

  // Instalar como app
  let promptInstalar = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); promptInstalar = e; $("[data-instalar]").hidden = false; });
  $("[data-instalar]").addEventListener("click", async () => {
    if (!promptInstalar) return;
    promptInstalar.prompt(); await promptInstalar.userChoice;
    promptInstalar = null; $("[data-instalar]").hidden = true;
  });
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  /* ---------- MODO DEMO (sin Google) ---------- */
  function demo(d) {
    const db = demo.db || (demo.db = crearDemo());
    const ok = (o) => Promise.resolve(Object.assign({ ok: true }, o));
    const ahora = () => { const n = new Date(); return `${iso(n)} ${n.toTimeString().slice(0, 8)}`; };
    if (d.accion === "panel") return ok({ hoy: hoyLocal(), ahora: ahora(), reservas: db.r.filter((r) => r.fecha >= d.desde), bloqueos: db.b.filter((b) => b.fecha >= d.desde) });
    if (d.accion === "cancelar") { db.r.find((r) => r.id === d.id).estado = "cancelada"; return ok(); }
    if (d.accion === "asistencia") { db.r.find((r) => r.id === d.id).asistencia = d.valor; return ok(); }
    if (d.accion === "agregar") {
      if (d.mesa !== "armada" && db.r.some((r) => r.fecha === d.fecha && r.mesa === String(d.mesa) && r.estado === "confirmada")) return ok({ ok: false, error: "Esa mesa ya está ocupada esa noche." });
      db.r.push(Object.assign({ id: "d" + Date.now(), creada: ahora(), estado: "confirmada", asistencia: "", origen: "manual" }, d, { mesa: String(d.mesa), personas: String(d.personas) }));
      return ok();
    }
    if (d.accion === "bloquear") { db.b.push({ id: "b" + Date.now(), creado: ahora(), fecha: d.fecha, mesa: String(d.mesa), motivo: d.motivo || "" }); return ok(); }
    if (d.accion === "desbloquear") { db.b = db.b.filter((b) => b.id !== d.id); return ok(); }
    return ok({ ok: false, error: "Acción desconocida" });
  }

  function crearDemo() {
    const hoy = hoyLocal();
    const prox = [];
    for (let i = 0; prox.length < 3 && i < 14; i++) { const f = sumar(hoy, i); if (CFG.dias.includes(aFecha(f).getDay())) prox.push(f); }
    const n1 = prox[0], n2 = prox[1], n3 = prox[2];
    const viejo = `${sumar(hoy, -3)} 12:00:00`;
    const r = (id, fecha, hora, mesa, personas, nombre, telefono, extra = {}) => Object.assign({ id, creada: viejo, fecha, hora, mesa: String(mesa), personas: String(personas), nombre, telefono, email: nombre.split(" ")[0].toLowerCase() + "@mail.com", estado: "confirmada", asistencia: "", origen: "web", nota: "" }, extra);
    return {
      r: [
        r("a1", n1, "20:00", 5, 4, "Laura Gómez", "11 5555 1234", { asistencia: "llegó" }),
        r("a2", n1, "20:00", 9, 6, "Familia Ríos", "11 4321 8765"),
        r("a3", n1, "20:00", 21, 2, "Tomás Benítez", "11 6000 1122", { creada: "2099-01-01 10:00:00" }),
        r("a4", n1, "22:00", 14, 8, "Cumple de Sofi", "11 4444 0000", { nota: "Traen torta" }),
        r("a5", n1, "22:00", 2, 3, "Martín Ruiz", "11 3333 2222", { origen: "manual", email: "" }),
        r("a6", n1, "22:00", "armada", 12, "Oficina Pereyra", "11 2222 9999", { creada: "2099-01-01 10:00:00" }),
        r("a7", n1, "20:00", 12, 2, "Clara Sosa", "11 1111 2222", { estado: "cancelada" }),
        r("a8", n2, "20:00", 7, 4, "Diego Paz", "11 7777 8888", { creada: "2099-01-01 10:00:00" }),
        r("a9", n2, "22:00", 13, 2, "Valen y Juli", "11 8888 7777")
      ],
      b: n3 ? [{ id: "b1", creado: viejo, fecha: n3, mesa: "todas", motivo: "Evento privado" }] : []
    };
  }

  function bandaEstado(error) {
    const banda = $("[data-estado-red]");
    banda.classList.toggle("estado-red--demo", !error && DEMO);
    if (error) banda.textContent = error;
    else if (DEMO) banda.textContent = "Modo demo: datos de ejemplo. Configurá el link de Google en data.js para usar las reservas reales.";
    banda.hidden = !error && !DEMO;
  }

  /* ---------- Arranque ---------- */
  bandaEstado(null);
  if (DEMO) { guardado.escribir("amo-datos", null); guardado.escribir("amo-visto", null); st.datos = null; st.visto = ""; }
  if (st.datos && st.clave) { mostrarApp(); pintar(); }
  irA("noche");
  if (st.clave) cargar(); else mostrarLogin();
})();