/* AMO Reservas - app del dueño
   Lee y escribe las reservas en el Apps Script de Google (data.js → reservas.api).
   Si "api" está vacío, arranca en MODO DEMO con datos de ejemplo. */

(function () {
  const CFG = Object.assign({ semanasAdelante: 4, api: "" }, (window.AMO && window.AMO.config.reservas) || {});
  const CATA = Object.assign({ hora: "20:30", precio: 30000, senaPorc: 50 }, (window.AMO && window.AMO.config.cata) || {});
  const TURNOS = CFG.turnos || [{ id: "noche", nombre: "Noche", dias: CFG.dias || [4, 5, 6], horarios: CFG.horarios || ["20:00", "22:00"] }];
  const S = window.AMO_SALON;
  const DEMO = !CFG.api;
  const TOTAL_MESAS = S.mesas.length;

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const plata = (n) => "$" + String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");

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
  const horaLocal = () => new Date().toTimeString().slice(0, 5);

  /* ---------- Turnos ---------- */
  const turnoDe = (h) => (TURNOS.find((t) => t.horarios.includes(h)) || {}).id || (String(h) < "17:00" ? "mediodia" : "noche");
  const nombreTurno = (id) => (TURNOS.find((t) => t.id === id) || { nombre: id }).nombre;

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
    turno: "noche",
    tab: "noche",
    cataFecha: null,
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
      r.catas = r.catas || []; r.entradas = r.entradas || [];
      st.datos = r; st.desde = desde;
      if (!st.visto) { st.visto = r.ahora; guardado.escribir("amo-visto", st.visto); }
      guardado.escribir("amo-datos", JSON.stringify(r));
      bandaEstado(null);
      if (DEMO && !demo.saltado) {
        demo.saltado = true;
        const primera = r.reservas.map((x) => x.fecha).sort()[0];
        if (primera && !r.reservas.some((x) => x.fecha === st.fecha)) irAFecha(primera);
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

  /* ---------- Datos derivados: mesas ---------- */
  const reservas = () => (st.datos ? st.datos.reservas : []);
  const bloqueos = () => (st.datos ? st.datos.bloqueos : []);
  const delDia = (f) => reservas().filter((r) => r.fecha === f);
  const deTurno = (f, t) => delDia(f).filter((r) => turnoDe(r.hora) === t);
  const activas = (f, t) => (t ? deTurno(f, t) : delDia(f)).filter((r) => r.estado === "confirmada");
  const bloqueosDe = (f, t) => bloqueos().filter((b) => b.fecha === f && (!t || !b.turno || b.turno === t));
  const cierreDe = (f, t) => bloqueosDe(f, t).find((b) => b.mesa === "todas");
  const esNueva = (r) => r.origen === "web" && r.estado === "confirmada" && st.visto && r.creada > st.visto;
  const mesaDe = (num) => S.mesas.find((m) => m.num === num);

  // Turnos que tiene un día (por configuración o porque hay reservas cargadas)
  function turnosDia(f) {
    const dia = aFecha(f).getDay();
    const ids = new Set(TURNOS.filter((t) => t.dias.includes(dia)).map((t) => t.id));
    delDia(f).forEach((r) => ids.add(turnoDe(r.hora)));
    bloqueos().filter((b) => b.fecha === f && b.turno).forEach((b) => ids.add(b.turno));
    return TURNOS.filter((t) => ids.has(t.id));
  }

  function turnoPorDefecto(f) {
    const lista = turnosDia(f).map((t) => t.id);
    if (!lista.length) return st.turno || "noche";
    if (f === hoyLocal()) {
      const ahoraT = horaLocal() < "17:00" ? "mediodia" : "noche";
      if (lista.includes(ahoraT)) return ahoraT;
    }
    return lista.includes(st.turno) ? st.turno : lista[0];
  }

  function irAFecha(f, turno) {
    st.fecha = f;
    st.turno = turno || turnoPorDefecto(f);
  }

  function estadoMesas(f, t) {
    const mapa = {};
    activas(f, t).filter((r) => r.mesa !== "armada").forEach((r) => (mapa[Number(r.mesa)] = { tipo: "reserva", r }));
    bloqueosDe(f, t).filter((b) => b.mesa !== "todas").forEach((b) => { if (!mapa[Number(b.mesa)]) mapa[Number(b.mesa)] = { tipo: "bloqueo", b }; });
    const cierre = cierreDe(f, t);
    if (cierre) S.mesas.forEach((m) => { if (!mapa[m.num]) mapa[m.num] = { tipo: "bloqueo", b: cierre }; });
    return mapa;
  }

  const personasDe = (lista) => lista.reduce((t, r) => t + Number(r.personas || 0), 0);
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

  /* ---------- Datos derivados: catas ---------- */
  const catas = () => (st.datos ? st.datos.catas : []);
  const entradas = () => (st.datos ? st.datos.entradas : []);
  const cataCfg = () => Object.assign({}, CATA, (st.datos && st.datos.cata) || {});
  const entradasDe = (f) => entradas().filter((e) => e.fecha === f);
  const ocupaLugar = (e) => ["pendiente", "revisar", "pagada"].includes(e.estado);
  const conRestriccion = (e) => e.restricciones && e.restricciones.trim().toLowerCase() !== "no";
  const porRevisar = () => entradas().filter((e) => e.estado === "revisar");
  const esNuevaEntrada = (e) => e.origen === "web" && ocupaLugar(e) && st.visto && e.creada > st.visto;
  const nuevas = () => reservas().filter(esNueva).map((r) => ({ tipo: "mesa", x: r })).concat(entradas().filter(esNuevaEntrada).map((e) => ({ tipo: "cata", x: e })));
  const ESTADOS = { pendiente: "Esperando pago", revisar: "Comprobante para revisar", pagada: "Seña pagada", vencida: "Vencida (no pagó a tiempo)", cancelada: "Cancelada" };

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
    $("[data-fab-texto]").textContent = tab === "catas" ? "Entrada" : "Reserva";
    window.scrollTo(0, 0);
  }

  function pintar() {
    pintarNoche();
    pintarProximos();
    pintarCatas();
    pintarAjustes();
    pintarNuevas();
  }

  /* ----- Salón (día + turno) ----- */
  function pintarNoche() {
    const f = st.fecha, t = st.turno;
    const hoy = hoyLocal();
    $("[data-fecha-texto]").textContent = mayus(larga(f));
    $("[data-fecha-etiqueta]").textContent =
      f === hoy ? "Hoy" : f === sumar(hoy, 1) ? "Mañana" : f === sumar(hoy, -1) ? "Ayer" : "Día";
    $("[data-fecha-input]").value = f;

    const tDia = turnosDia(f);
    $("[data-turnos]").hidden = tDia.length < 2;
    $("[data-turnos]").innerHTML = tDia.map((x) => {
      const n = activas(f, x.id).length;
      return `<button class="turno-sel__btn" data-turno="${x.id}" aria-pressed="${x.id === t}">${esc(x.nombre)}${n ? `<b>${n}</b>` : ""}</button>`;
    }).join("");

    const cierre = cierreDe(f, t);
    $("[data-cerrado]").hidden = !cierre;
    if (cierre) {
      $("[data-cerrado-titulo]").textContent = cierre.turno ? `${nombreTurno(cierre.turno)} cerrado` : "Día cerrado";
      $("[data-cerrado-motivo]").textContent = cierre.motivo ? `· ${cierre.motivo}` : "";
    }

    const act = activas(f, t);
    const mapa = estadoMesas(f, t);
    const libres = TOTAL_MESAS - Object.keys(mapa).length;
    const llegaron = act.filter((r) => r.asistencia === "llegó").length;
    const chico = (txt) => `<small style="font-size:.9rem;color:var(--crema-tenue)"> / ${txt}</small>`;
    $("[data-numeros]").innerHTML = `
      <div class="numero numero--oro"><b>${act.length}</b><span>${act.length === 1 ? "Reserva" : "Reservas"}</span></div>
      <div class="numero"><b>${personasDe(act)}</b><span>Personas</span></div>
      <div class="numero"><b>${libres}${chico(TOTAL_MESAS)}</b><span>Mesas libres</span></div>
      <div class="numero"><b>${llegaron}${chico(act.length)}</b><span>Llegaron</span></div>`;

    pintarPlano(mapa);
    pintarLista(f, t);
  }

  function sillas(m) {
    const out = [];
    const porLado = Math.ceil(m.cap / 2);
    const horizontal = m.w >= m.h;
    for (let lado = 0; lado < 2; lado++) {
      const n = lado === 0 ? porLado : m.cap - porLado;
      for (let i = 0; i < n; i++) {
        const k = (i + 1) / (n + 1);
        const cx = horizontal ? m.x + m.w * k : (lado === 0 ? m.x - 16 : m.x + m.w + 16);
        const cy = horizontal ? (lado === 0 ? m.y - 16 : m.y + m.h + 16) : m.y + m.h * k;
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

  function pintarPlano(mapa) {
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

  function pintarLista(f, t) {
    const act = activas(f, t);
    const canceladas = deTurno(f, t).filter((r) => r.estado !== "confirmada");
    const horas = [...new Set(act.map((r) => r.hora))].sort();
    let html = "";
    if (!act.length) {
      const sinTurno = !turnosDia(f).some((x) => x.id === t);
      html = `<div class="vacio"><img src="../img/icono-copa.png" alt="">${
        cierreDe(f, t) ? "Cerrado." : sinTurno ? "Este día no abre el salón." : `No hay reservas para ${t === "mediodia" ? "el mediodía" : "la noche"}.`}</div>`;
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
      if (turnosDia(f).length || bloqueosDe(f).length) dias.push(f);
    }
    $("[data-dias]").innerHTML = dias.map((f) => {
      const d = aFecha(f);
      const tDia = turnosDia(f);
      const act = activas(f);
      const cerrados = tDia.filter((t) => cierreDe(f, t.id));
      const todoCerrado = tDia.length && cerrados.length === tDia.length;
      const ocupadas = tDia.reduce((s, t) => s + Object.keys(estadoMesas(f, t.id)).length, 0);
      const capacidad = TOTAL_MESAS * Math.max(1, tDia.length);
      const nuevasDia = act.filter(esNueva).length;
      const porTurno = tDia.map((t) => `${t.nombre}: ${cierreDe(f, t.id) ? "cerrado" : activas(f, t.id).length}`).join(" · ");
      return `
        <button class="dia-fila${f === hoy ? " is-hoy" : ""}" data-ir-fecha="${f}">
          <span class="dia-fila__fecha"><small>${DIAS[d.getDay()].slice(0, 3)}</small><b>${d.getDate()}</b><span>${MESES[d.getMonth()].slice(0, 3)}</span></span>
          <span class="dia-fila__info">
            <p>${todoCerrado ? "Día cerrado" : act.length ? `${plural(act.length, "reserva", "reservas")} · ${personasDe(act)} personas` : "Sin reservas todavía"}</p>
            <span class="sub">${todoCerrado ? esc(cerrados[0].motivo || "No se toman reservas") : esc(porTurno)}</span>
            <span class="ocupacion"><i style="width:${todoCerrado ? 100 : Math.round((ocupadas / capacidad) * 100)}%${todoCerrado ? ";background:var(--rojo)" : ""}"></i></span>
          </span>
          <span class="dia-fila__chips">
            ${f === hoy ? '<span class="chip chip--manual">Hoy</span>' : ""}
            ${nuevasDia ? `<span class="chip chip--nueva">${nuevasDia} ${nuevasDia === 1 ? "nueva" : "nuevas"}</span>` : ""}
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>
          </span>
        </button>`;
    }).join("");
  }

  /* ----- Catas ----- */
  function pintarCatas() {
    const rev = porRevisar().length;
    $("[data-catas-badge]").hidden = !rev;
    $("[data-catas-badge]").textContent = rev;
    if (st.cataFecha) return pintarCataDetalle(st.cataFecha);

    const cfg = cataCfg();
    const lista = catas().filter((c) => c.fecha >= hoyLocal());
    $("[data-catas-vista]").innerHTML = `
      <h1 class="titulo">Catas</h1>
      <p class="tarjeta__texto">Miércoles ${esc(cfg.hora)} hs · ${plata(cfg.precio)} por persona · seña del ${cfg.senaPorc}%</p>
      ${rev ? `<button class="alerta" data-ver-revisar>
          <b>${rev}</b><span>${rev === 1 ? "comprobante de seña para revisar" : "comprobantes de seña para revisar"}</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>
        </button>` : ""}
      <div class="dias-lista">
        ${lista.map((c) => {
          const d = aFecha(c.fecha);
          const ent = entradasDe(c.fecha);
          const pagadas = personasDe(ent.filter((e) => e.estado === "pagada"));
          const revN = ent.filter((e) => e.estado === "revisar").length;
          const restr = ent.filter((e) => ocupaLugar(e) && conRestriccion(e)).length;
          return `
            <button class="dia-fila cata-fila${c.cancelada ? " is-suspendida" : ""}" data-cata-abrir="${c.fecha}">
              <span class="dia-fila__fecha"><small>mié</small><b>${d.getDate()}</b><span>${MESES[d.getMonth()].slice(0, 3)}</span></span>
              <span class="dia-fila__info">
                <p class="${c.bodega ? "" : "falta"}">${c.bodega ? esc(c.bodega) : "Falta cargar la bodega"}</p>
                <span class="sub">${c.cancelada ? "Suspendida" : `${c.ocupados} de ${c.cupo} lugares · ${pagadas} con seña pagada`}</span>
                <span class="ocupacion ocupacion--doble">
                  <i style="width:${Math.min(100, Math.round((pagadas / c.cupo) * 100))}%"></i><i class="tenue" style="width:${Math.min(100, Math.round(((c.ocupados - pagadas) / c.cupo) * 100))}%"></i>
                </span>
              </span>
              <span class="dia-fila__chips">
                ${c.cancelada ? '<span class="chip chip--cerrado">Suspendida</span>' : ""}
                ${revN ? `<span class="chip chip--nueva">${revN} a revisar</span>` : ""}
                ${restr ? `<span class="chip chip--restr">${restr} restr.</span>` : ""}
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>
              </span>
            </button>`;
        }).join("") || '<div class="vacio">No hay catas próximas.</div>'}
      </div>`;
  }

  function itemEntrada(e) {
    const chips = [];
    if (esNuevaEntrada(e)) chips.push('<span class="chip chip--nueva">Nueva</span>');
    if (e.estado === "revisar") chips.push('<span class="chip chip--nueva">Revisar</span>');
    if (e.estado === "pagada") chips.push('<span class="chip chip--llego">Pagó</span>');
    if (e.estado === "vencida") chips.push('<span class="chip chip--cancelada">Vencida</span>');
    if (e.estado === "cancelada") chips.push('<span class="chip chip--cancelada">Cancelada</span>');
    if (conRestriccion(e)) chips.push('<span class="chip chip--restr">Restricción</span>');
    if (e.origen === "manual") chips.push('<span class="chip chip--manual">A mano</span>');
    const detalle = e.estado === "pendiente"
      ? `Seña ${plata(e.sena)}${e.vence ? ` · vence ${esc(e.vence.slice(11, 16))} hs` : ""}`
      : e.estado === "revisar" ? `Subió comprobante · seña ${plata(e.sena)}`
      : e.estado === "pagada" ? `Seña ${plata(e.sena)} · resta ${plata(e.total - e.sena)}`
      : esc(e.telefono || "");
    const clase = e.estado === "pagada" ? "is-llego" : ["vencida", "cancelada"].includes(e.estado) ? "is-cancelada" : e.estado === "pendiente" ? "is-pendiente" : "";
    return `
      <button class="item ${clase}" data-entrada="${esc(e.id)}">
        <span class="item__mesa item__mesa--pers">${esc(e.personas)}<small>pers.</small></span>
        <span>
          <span class="item__nombre">${esc(e.nombre)}</span>
          <span class="item__detalle" style="display:block">${detalle}</span>
        </span>
        <span class="item__chips">${chips.join("")}</span>
      </button>`;
  }

  function pintarCataDetalle(f) {
    const c = catas().find((x) => x.fecha === f) || { fecha: f, bodega: "", cupo: cataCfg().cupo || 60, ocupados: 0, libres: 0 };
    const ent = entradasDe(f);
    const vivas = ent.filter(ocupaLugar);
    const pagadas = ent.filter((e) => e.estado === "pagada");
    const revisar = ent.filter((e) => e.estado === "revisar");
    const pendientes = ent.filter((e) => e.estado === "pendiente");
    const muertas = ent.filter((e) => !ocupaLugar(e));
    const restr = vivas.filter(conRestriccion);
    const cobrado = pagadas.reduce((s, e) => s + Number(e.sena || 0), 0);
    const grupo = (titulo, lista, sub) => lista.length ? `
      <section class="grupo">
        <div class="grupo__titulo"><h2>${titulo}</h2><span>${sub || `${plural(lista.length, "reserva", "reservas")} · ${personasDe(lista)} pers.`}</span></div>
        ${lista.map(itemEntrada).join("")}
      </section>` : "";

    $("[data-catas-vista]").innerHTML = `
      <button class="volver-btn" data-cata-volver>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>Todas las catas
      </button>
      <div class="cata-cab">
        <div>
          <small>${esc(mayus(larga(f)))} · <span style="white-space:nowrap">${esc(cataCfg().hora)} hs</span></small>
          <h1>${c.bodega ? esc(c.bodega) : '<span class="falta">Bodega a confirmar</span>'}</h1>
          ${c.nota ? `<p>${esc(c.nota)}</p>` : ""}
        </div>
        <button class="btn btn--chico" data-cata-editar="${f}">Editar</button>
      </div>
      ${c.cancelada ? '<div class="cerrado"><p><strong>Cata suspendida</strong> · no se puede reservar desde la web</p></div>' : ""}
      <div class="numeros">
        <div class="numero numero--oro"><b>${c.ocupados}<small style="font-size:.9rem;color:var(--crema-tenue)"> / ${c.cupo}</small></b><span>Lugares tomados</span></div>
        <div class="numero"><b>${personasDe(pagadas)}</b><span>Con seña pagada</span></div>
        <div class="numero"><b>${plata(cobrado)}</b><span>Señas cobradas</span></div>
        <div class="numero"><b>${restr.length}</b><span>Restricciones</span></div>
      </div>
      ${restr.length ? `
        <div class="restricciones">
          <h2>Para la cocina</h2>
          <ul>${restr.map((e) => `<li><strong>${esc(e.nombre)}</strong> (${esc(e.personas)} pers.)<span>${esc(e.restricciones)}</span></li>`).join("")}</ul>
        </div>` : ""}
      <div class="cata-lista">
        ${!ent.length ? '<div class="vacio"><img src="../img/icono-copa.png" alt="">Todavía no hay reservas para esta cata.</div>' : ""}
        ${grupo("Para revisar", revisar)}
        ${grupo("Esperando pago", pendientes)}
        ${grupo("Confirmadas", pagadas)}
        ${muertas.length ? `<details class="desplegable"><summary>Vencidas y canceladas (${muertas.length})</summary>${muertas.map(itemEntrada).join("")}</details>` : ""}
      </div>`;
  }

  function detalleEntrada(id) {
    const e = entradas().find((x) => x.id === id);
    if (!e) return;
    const tel = String(e.telefono || "").replace(/[^\d+]/g, "");
    const viva = ocupaLugar(e) || e.estado === "vencida";
    const creada = e.creada ? `${corta(e.creada.slice(0, 10))} ${e.creada.slice(11, 16)}` : "";
    const sinTel = 'aria-disabled="true" style="opacity:.35;pointer-events:none"';
    abrirHoja(`
      <div class="det__cabeza">
        <span class="item__mesa item__mesa--pers">${esc(e.personas)}<small>pers.</small></span>
        <div>
          <h2 id="hoja-titulo">${esc(e.nombre)}</h2>
          <p>Cata del ${esc(corta(e.fecha))} · ${esc(e.personas)} personas</p>
        </div>
      </div>
      <p class="estado-pago estado-pago--${esc(e.estado)}">${esc(ESTADOS[e.estado] || e.estado)}</p>
      ${conRestriccion(e) ? `<div class="restricciones restricciones--chica"><h2>Restricciones</h2><p>${esc(e.restricciones)}</p></div>` : ""}
      <div class="det__contacto">
        <a href="${tel ? `tel:${esc(tel)}` : "#"}" ${tel ? "" : sinTel}>${icono.tel}Llamar</a>
        <a href="${esc(waLink(e.telefono)) || "#"}" target="_blank" rel="noopener" ${tel ? "" : sinTel}>${icono.wa}WhatsApp</a>
        <a href="${e.email ? `mailto:${esc(e.email)}` : "#"}" ${e.email ? "" : sinTel}>${icono.mail}Mail</a>
      </div>
      <dl class="det__datos">
        <div><dt>Seña</dt><dd>${plata(e.sena)}</dd></div>
        <div><dt>Total</dt><dd>${plata(e.total)} (resta ${plata(e.total - e.sena)})</dd></div>
        ${e.estado === "pendiente" && e.vence ? `<div><dt>Vence</dt><dd>${esc(corta(e.vence.slice(0, 10)))} ${esc(e.vence.slice(11, 16))} hs</dd></div>` : ""}
        <div><dt>Teléfono</dt><dd>${esc(e.telefono || "—")}</dd></div>
        <div><dt>Mail</dt><dd>${esc(e.email || "—")}</dd></div>
        ${e.nota ? `<div><dt>Nota</dt><dd>${esc(e.nota)}</dd></div>` : ""}
        <div><dt>Origen</dt><dd>${e.origen === "manual" ? "Cargada a mano" : `Web${creada ? ` · ${esc(creada)}` : ""}`}</dd></div>
        <div><dt>Código</dt><dd>${esc(e.id)}</dd></div>
      </dl>
      <div class="det__acciones">
        ${e.tieneComprobante ? `<button class="btn btn--linea btn--ancho" data-ver-comprobante="${esc(e.id)}">Ver comprobante</button>` : ""}
        ${viva && e.estado !== "pagada" ? `<button class="btn btn--oro btn--ancho" data-pago="pagada" data-id="${esc(e.id)}">Marcar seña pagada</button>` : ""}
        ${e.estado === "pagada" ? `<button class="btn btn--linea btn--ancho" data-pago="${e.tieneComprobante ? "revisar" : "pendiente"}" data-id="${esc(e.id)}">Desmarcar pago</button>` : ""}
        ${e.estado === "vencida" ? `<button class="btn btn--linea btn--ancho" data-pago="pendiente" data-id="${esc(e.id)}">Guardarle el lugar igual</button>` : ""}
        ${e.estado !== "cancelada" ? `<button class="btn btn--peligro btn--ancho" data-cancelar-entrada="${esc(e.id)}">Cancelar reserva</button>` : ""}
      </div>`);
  }

  function formCata(f) {
    const c = catas().find((x) => x.fecha === f) || { bodega: "", cupo: cataCfg().cupo || 60, nota: "", cancelada: false };
    abrirHoja(`
      <h2 class="det__titulo" id="hoja-titulo">Cata del ${esc(corta(f))}</h2>
      <form class="form-reserva" data-form-cata data-fecha="${f}">
        <label class="campo"><span class="campo__label">Bodega invitada</span>
          <input class="campo__input" name="bodega" maxlength="80" value="${esc(c.bodega)}" placeholder="Ej: Bodega Catena Zapata" autofocus></label>
        <label class="campo"><span class="campo__label">Detalle (opcional, se ve en la página)</span>
          <input class="campo__input" name="nota" maxlength="200" value="${esc(c.nota || "")}" placeholder="Ej: Malbecs de altura"></label>
        <label class="campo"><span class="campo__label">Cupo (lugares)</span>
          <input class="campo__input" name="cupo" type="number" min="1" max="300" inputmode="numeric" value="${esc(c.cupo)}"></label>
        <label class="check"><input type="checkbox" name="suspendida" ${c.cancelada ? "checked" : ""}><span>Suspender esta cata (nadie puede reservar)</span></label>
        <button class="btn btn--oro btn--ancho" type="submit">Guardar</button>
      </form>`);
  }

  function formEntrada(fechaInicial) {
    const opciones = catas().filter((c) => c.fecha >= hoyLocal() && !c.cancelada);
    if (!opciones.length) return aviso("No hay catas próximas abiertas.");
    const elegida = opciones.some((c) => c.fecha === fechaInicial) ? fechaInicial : opciones[0].fecha;
    abrirHoja(`
      <h2 class="det__titulo" id="hoja-titulo">Cargar entrada</h2>
      <form class="form-reserva" data-form-entrada>
        <div class="doble">
          <label class="campo"><span class="campo__label">Cata</span>
            <select class="campo__input" name="fecha">${opciones.map((c) => `<option value="${c.fecha}" ${c.fecha === elegida ? "selected" : ""}>${esc(corta(c.fecha))} · quedan ${c.libres}</option>`).join("")}</select></label>
          <label class="campo"><span class="campo__label">Personas</span>
            <input class="campo__input" type="number" name="personas" min="1" max="100" value="2" inputmode="numeric" required></label>
        </div>
        <label class="campo"><span class="campo__label">Nombre</span>
          <input class="campo__input" name="nombre" required maxlength="80" autocomplete="off" autofocus></label>
        <div class="doble">
          <label class="campo"><span class="campo__label">Teléfono</span>
            <input class="campo__input" name="telefono" type="tel" inputmode="tel" maxlength="30"></label>
          <label class="campo"><span class="campo__label">Mail (opcional)</span>
            <input class="campo__input" name="email" type="email" maxlength="120"></label>
        </div>
        <label class="campo"><span class="campo__label">Restricciones alimentarias (opcional)</span>
          <input class="campo__input" name="restricciones" maxlength="300" placeholder="Ej: 1 celíaco"></label>
        <label class="check"><input type="checkbox" name="pagada" checked><span>Ya pagó la seña</span></label>
        <button class="btn btn--oro btn--ancho" type="submit">Guardar entrada</button>
        <p class="error" data-form-error></p>
      </form>`);
  }

  async function verComprobante(id) {
    const b = $(`[data-ver-comprobante="${id}"]`);
    if (b) { b.disabled = true; b.textContent = "Abriendo…"; }
    try {
      const r = await llamar("verComprobante", { id });
      if (!r.ok) throw new Error(r.error);
      let url = r.url;
      if (!url) {
        const bytes = Uint8Array.from(atob(r.datos), (ch) => ch.charCodeAt(0));
        url = URL.createObjectURL(new Blob([bytes], { type: r.tipo }));
      }
      const e = entradas().find((x) => x.id === id);
      const esPdf = /pdf/.test(r.tipo || "");
      abrirHoja(`
        <h2 class="det__titulo" id="hoja-titulo">Comprobante</h2>
        <p class="tarjeta__texto">${esc(e ? e.nombre : "")} · seña de ${plata(e ? e.sena : 0)}</p>
        ${esPdf ? `<a class="btn btn--linea btn--ancho" href="${url}" target="_blank" rel="noopener">Abrir PDF</a>`
          : `<a href="${url}" target="_blank" rel="noopener"><img class="comprobante" src="${url}" alt="Comprobante de transferencia"></a>`}
        <div class="det__acciones" style="margin-top:1rem">
          ${e && e.estado !== "pagada" ? `<button class="btn btn--oro btn--ancho" data-pago="pagada" data-id="${esc(id)}">Está bien: marcar pagada</button>` : ""}
          <button class="btn btn--linea btn--ancho" data-entrada="${esc(id)}">Volver</button>
        </div>`);
    } catch (e) {
      aviso(e.message || "No se pudo abrir el comprobante.");
      if (b) { b.disabled = false; b.textContent = "Ver comprobante"; }
    }
  }

  /* ----- Ajustes ----- */
  function pintarAjustes() {
    const hoy = hoyLocal();
    const cerradas = bloqueos().filter((b) => b.mesa === "todas" && b.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha));
    $("[data-cerradas]").innerHTML = cerradas.length
      ? cerradas.map((b) => `<li><div><strong>${esc(mayus(larga(b.fecha)))}${b.turno ? ` · ${esc(nombreTurno(b.turno))}` : ""}</strong><br><span>${esc(b.motivo || "Sin motivo")}</span></div><button class="btn btn--chico" data-desbloquear="${esc(b.id)}">Reabrir</button></li>`).join("")
      : "";
    const inp = $("[data-cerrar-fecha]");
    inp.min = hoy;
    if (!inp.value) inp.value = proximoDia();
  }

  function proximoDia() {
    for (let i = 0; i < 14; i++) { const f = sumar(hoyLocal(), i); if (TURNOS.some((t) => t.dias.includes(aFecha(f).getDay()))) return f; }
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
    $(".hoja__caja").scrollTop = 0;
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
    const sinTel = 'aria-disabled="true" style="opacity:.35;pointer-events:none"';
    abrirHoja(`
      <div class="det__cabeza">
        <span class="item__mesa${armada ? " item__mesa--armada" : ""}">${armada ? `${esc(r.personas)}<small>armada</small>` : esc(r.mesa)}</span>
        <div>
          <h2 id="hoja-titulo">${esc(r.nombre)}</h2>
          <p>${armada ? "Mesa armada" : `Mesa ${esc(r.mesa)}`} · ${esc(r.personas)} personas · ${esc(r.hora)} hs</p>
        </div>
      </div>
      <div class="det__contacto">
        <a href="${tel ? `tel:${esc(tel)}` : "#"}" ${tel ? "" : sinTel}>${icono.tel}Llamar</a>
        <a href="${esc(waLink(r.telefono)) || "#"}" target="_blank" rel="noopener" ${tel ? "" : sinTel}>${icono.wa}WhatsApp</a>
        <a href="${r.email ? `mailto:${esc(r.email)}` : "#"}" ${r.email ? "" : sinTel}>${icono.mail}Mail</a>
      </div>
      <dl class="det__datos">
        <div><dt>Día</dt><dd>${esc(mayus(larga(r.fecha)))} · ${esc(nombreTurno(turnoDe(r.hora)))}</dd></div>
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
    const e = estadoMesas(st.fecha, st.turno)[num];
    if (e && e.tipo === "reserva") return detalleReserva(e.r.id);
    const cierre = cierreDe(st.fecha, st.turno);
    const cuando = `${larga(st.fecha)} (${nombreTurno(st.turno).toLowerCase()})`;
    if (e && e.tipo === "bloqueo") {
      return abrirHoja(`
        <h2 class="det__titulo" id="hoja-titulo">Mesa ${num}</h2>
        <p class="tarjeta__texto">Para ${m.cap} personas · Bloqueada${e.b.turno ? "" : " todo el día"}${e.b.motivo ? ` · ${esc(e.b.motivo)}` : ""}.</p>
        ${cierre ? '<p class="tarjeta__texto">Este turno está cerrado. Podés reabrirlo desde el aviso de arriba o en Ajustes.</p>'
          : `<button class="btn btn--oro btn--ancho" data-desbloquear="${esc(e.b.id)}">Desbloquear mesa</button>`}`);
    }
    abrirHoja(`
      <h2 class="det__titulo" id="hoja-titulo">Mesa ${num}</h2>
      <p class="tarjeta__texto">Para ${m.cap} personas · Libre el ${esc(cuando)}.</p>
      <div class="det__acciones">
        <button class="btn btn--oro btn--ancho" data-nueva-en="${num}">Cargar reserva en esta mesa</button>
        <button class="btn btn--linea btn--ancho" data-bloquear-mesa="${num}">Bloquear en este turno</button>
      </div>`);
  }

  function horariosPara(f) {
    const dia = aFecha(f).getDay();
    const lista = TURNOS.filter((t) => t.dias.includes(dia));
    return (lista.length ? lista : TURNOS).flatMap((t) => t.horarios);
  }

  function pintarHorasForm(preferida) {
    const form = $("[data-form-nueva]"); if (!form) return;
    const horas = horariosPara(form.fecha.value || st.fecha);
    const actual = preferida || (($("[data-hora-form][aria-pressed='true']") || {}).dataset || {}).horaForm;
    const elegida = horas.includes(actual) ? actual : (horas.find((h) => turnoDe(h) === st.turno) || horas[0]);
    $("[data-horas-form]").innerHTML = horas.map((h) => `<button type="button" class="opcion" data-hora-form="${h}" aria-pressed="${h === elegida}">${h}</button>`).join("");
  }

  function formNueva(mesaInicial) {
    abrirHoja(`
      <h2 class="det__titulo" id="hoja-titulo">Cargar reserva</h2>
      <form class="form-reserva" data-form-nueva>
        <div class="doble">
          <label class="campo"><span class="campo__label">Día</span>
            <input class="campo__input" type="date" name="fecha" required value="${st.fecha}"></label>
          <label class="campo"><span class="campo__label">Personas</span>
            <input class="campo__input" type="number" name="personas" min="1" max="200" required value="2" inputmode="numeric"></label>
        </div>
        <div class="campo"><span class="campo__label">Horario</span>
          <div class="opciones" data-horas-form></div>
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
    pintarHorasForm();
    llenarMesas(mesaInicial);
  }

  function horaForm() {
    const b = $("[data-hora-form][aria-pressed='true']");
    return b ? b.dataset.horaForm : horariosPara(st.fecha)[0];
  }

  function llenarMesas(preferida) {
    const form = $("[data-form-nueva]"); if (!form) return;
    const f = form.fecha.value;
    const ocupadas = estadoMesas(f, turnoDe(horaForm()));
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

  $$("[data-tab]").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.tab === "catas" && st.tab === "catas") st.cataFecha = null;
    irA(b.dataset.tab);
    if (b.dataset.tab === "catas") pintarCatas();
  }));
  $("[data-actualizar]").addEventListener("click", () => cargar().then(() => aviso("Actualizado")));

  function cambiarDia(f) {
    irAFecha(f);
    if (st.desde && st.fecha < st.desde) cargar(); else pintarNoche();
  }
  $$("[data-dia-mover]").forEach((b) => b.addEventListener("click", () => cambiarDia(sumar(st.fecha, Number(b.dataset.diaMover)))));
  $("[data-fecha-elegir]").addEventListener("click", () => {
    const inp = $("[data-fecha-input]");
    if (inp.showPicker) { try { inp.showPicker(); return; } catch (e) {} }
    inp.focus(); inp.click();
  });
  $("[data-fecha-input]").addEventListener("change", (ev) => { if (ev.target.value) cambiarDia(ev.target.value); });
  $("[data-turnos]").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-turno]"); if (!b) return;
    st.turno = b.dataset.turno;
    pintarNoche();
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
    if (t.dataset.entrada) return detalleEntrada(t.dataset.entrada);
    if (t.dataset.irFecha) { irAFecha(t.dataset.irFecha); irA("noche"); return pintarNoche(); }

    // Catas
    if (t.dataset.cataAbrir) { st.cataFecha = t.dataset.cataAbrir; pintarCatas(); return window.scrollTo(0, 0); }
    if (t.hasAttribute("data-cata-volver")) { st.cataFecha = null; pintarCatas(); return window.scrollTo(0, 0); }
    if (t.dataset.cataEditar) return formCata(t.dataset.cataEditar);
    if (t.dataset.verComprobante) return verComprobante(t.dataset.verComprobante);
    if (t.hasAttribute("data-ver-revisar")) {
      const lista = porRevisar().sort((a, b) => a.fecha.localeCompare(b.fecha));
      return abrirHoja(`
        <h2 class="det__titulo" id="hoja-titulo">Comprobantes para revisar</h2>
        <ul class="nuevas-lista">
          ${lista.map((e) => `
            <li><button data-entrada="${esc(e.id)}">
              <span><strong>${esc(e.nombre)}</strong><span>Cata ${esc(corta(e.fecha))} · ${esc(e.personas)} pers. · seña ${plata(e.sena)}</span></span>
              <span class="chip chip--nueva">Ver</span>
            </button></li>`).join("")}
        </ul>`);
    }
    if (t.dataset.pago) {
      const e = entradas().find((x) => x.id === t.dataset.id);
      if (t.dataset.pago === "pagada" && !confirm(`¿Confirmar la seña de ${e ? e.nombre : "esta reserva"}? Le llega un mail confirmando su lugar.`)) return;
      t.disabled = true;
      const ok = await accion("pagoCata", { id: t.dataset.id, valor: t.dataset.pago }, t.dataset.pago === "pagada" ? "Seña confirmada" : "Listo");
      return ok ? detalleEntrada(t.dataset.id) : (t.disabled = false);
    }
    if (t.dataset.cancelarEntrada) {
      const e = entradas().find((x) => x.id === t.dataset.cancelarEntrada);
      if (!confirm(`¿Cancelar la reserva de ${e ? e.nombre : "esta persona"} para la cata? Se liberan los lugares.`)) return;
      t.disabled = true;
      if (await accion("cancelarEntrada", { id: t.dataset.cancelarEntrada }, "Reserva cancelada")) cerrarHoja();
      return;
    }

    // Mesas
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
      if (await accion("bloquear", { fecha: st.fecha, mesa: t.dataset.bloquearMesa, turno: st.turno, motivo: "" }, "Mesa bloqueada")) cerrarHoja();
      return;
    }
    if (t.dataset.nuevaEn) return formNueva(Number(t.dataset.nuevaEn));
    if (t.dataset.horaForm) {
      $$("[data-hora-form]").forEach((b) => b.setAttribute("aria-pressed", b === t));
      llenarMesas();
      return;
    }
  });

  $("[data-reabrir]").addEventListener("click", async () => {
    const c = cierreDe(st.fecha, st.turno); if (!c) return;
    await accion("desbloquear", { id: c.id }, "Reabierto");
  });

  $("[data-nueva]").addEventListener("click", () => (st.tab === "catas" ? formEntrada(st.cataFecha) : formNueva()));

  document.addEventListener("input", (ev) => {
    if (!ev.target.closest("[data-form-nueva]")) return;
    if (ev.target.name === "fecha") { pintarHorasForm(); llenarMesas(); }
    if (ev.target.name === "personas") llenarMesas();
  });

  document.addEventListener("submit", async (ev) => {
    const formN = ev.target.closest("[data-form-nueva]");
    const formC = ev.target.closest("[data-form-cata]");
    const formE = ev.target.closest("[data-form-entrada]");
    if (!formN && !formC && !formE) return;
    ev.preventDefault();

    if (formC) {
      const boton = formC.querySelector("[type=submit]");
      boton.disabled = true;
      const ok = await accion("guardarCata", {
        fecha: formC.dataset.fecha,
        bodega: formC.bodega.value.trim(),
        nota: formC.nota.value.trim(),
        cupo: formC.cupo.value,
        estado: formC.suspendida.checked ? "cancelada" : "abierta"
      }, "Cata guardada");
      boton.disabled = false;
      if (ok) cerrarHoja();
      return;
    }

    if (formE) {
      const err = formE.querySelector("[data-form-error]");
      const datos = {
        fecha: formE.fecha.value, personas: formE.personas.value,
        nombre: formE.nombre.value.trim(), telefono: formE.telefono.value.trim(), email: formE.email.value.trim(),
        restricciones: formE.restricciones.value.trim(), pagada: formE.pagada.checked
      };
      if (!datos.nombre) { err.textContent = "Falta el nombre."; formE.nombre.focus(); return; }
      const boton = formE.querySelector("[type=submit]");
      boton.disabled = true; boton.textContent = "Guardando…";
      const ok = await accion("agregarEntrada", datos, "Entrada cargada");
      boton.disabled = false; boton.textContent = "Guardar entrada";
      if (ok) { st.cataFecha = datos.fecha; cerrarHoja(); irA("catas"); pintarCatas(); }
      return;
    }

    const form = formN;
    const err = $("[data-form-error]");
    const datos = {
      fecha: form.fecha.value,
      hora: horaForm(),
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
    if (ok) { irAFecha(datos.fecha, turnoDe(datos.hora)); cerrarHoja(); irA("noche"); pintarNoche(); }
  });

  $("[data-cerrar-form]").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const fecha = $("[data-cerrar-fecha]").value;
    const turno = $("[data-cerrar-turno]").value;
    if (!fecha) return;
    const ya = activas(fecha, turno || undefined).length;
    if (ya && !confirm(`Ya hay ${plural(ya, "reserva", "reservas")}. Se mantienen, pero nadie más va a poder reservar. ¿Cerrar igual?`)) return;
    const ok = await accion("bloquear", { fecha, mesa: "todas", turno, motivo: $("[data-cerrar-motivo]").value.trim() }, "Cerrado");
    if (ok) $("[data-cerrar-motivo]").value = "";
  });

  $("[data-nuevas-btn]").addEventListener("click", () => {
    const lista = nuevas().sort((a, b) => (a.x.fecha + (a.x.hora || "")).localeCompare(b.x.fecha + (b.x.hora || "")));
    abrirHoja(`
      <h2 class="det__titulo" id="hoja-titulo">${plural(lista.length, "reserva nueva", "reservas nuevas")}</h2>
      <ul class="nuevas-lista">
        ${lista.map(({ tipo, x }) => tipo === "mesa" ? `
          <li><button data-ir-reserva="${esc(x.id)}">
            <span><strong>${esc(x.nombre)}</strong><span>${esc(corta(x.fecha))} · ${esc(x.hora)} hs · ${x.mesa === "armada" ? "Mesa armada" : `Mesa ${esc(x.mesa)}`} · ${esc(x.personas)} pers.</span></span>
            <span class="chip chip--nueva">Ver</span>
          </button></li>` : `
          <li><button data-ir-entrada="${esc(x.id)}">
            <span><strong>${esc(x.nombre)}</strong><span>Cata ${esc(corta(x.fecha))} · ${esc(x.personas)} pers. · ${esc(ESTADOS[x.estado] || "")}</span></span>
            <span class="chip chip--restr">Cata</span>
          </button></li>`).join("")}
      </ul>
      <button class="btn btn--oro btn--ancho" data-marcar-vistas>Marcar como vistas</button>`);
  });
  document.addEventListener("click", (ev) => {
    const ir = ev.target.closest("[data-ir-reserva]");
    if (ir) {
      const r = reservas().find((x) => x.id === ir.dataset.irReserva);
      if (r) { irAFecha(r.fecha, turnoDe(r.hora)); irA("noche"); pintarNoche(); detalleReserva(r.id); }
      return;
    }
    const irE = ev.target.closest("[data-ir-entrada]");
    if (irE) {
      const e = entradas().find((x) => x.id === irE.dataset.irEntrada);
      if (e) { st.cataFecha = e.fecha; irA("catas"); pintarCatas(); detalleEntrada(e.id); }
      return;
    }
    if (ev.target.closest("[data-marcar-vistas]")) {
      st.visto = [st.visto, st.datos && st.datos.ahora, ...reservas().map((r) => r.creada), ...entradas().map((e) => e.creada)].filter(Boolean).sort().pop();
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
  const enApp = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const banda = $("[data-instalar-banda]");
  let promptInstalar = null;
  banda.hidden = enApp || guardado.leer("amo-instalar-oculto") === "1";
  $("[data-instalar]").hidden = enApp;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); promptInstalar = e; });
  window.addEventListener("appinstalled", () => { promptInstalar = null; banda.hidden = true; $("[data-instalar]").hidden = true; });
  async function instalar() {
    if (promptInstalar) {
      promptInstalar.prompt();
      const r = await promptInstalar.userChoice;
      promptInstalar = null;
      if (r.outcome === "accepted") { banda.hidden = true; $("[data-instalar]").hidden = true; }
      return;
    }
    const pasos = esIOS
      ? ["Abrí esta página en <b>Safari</b>.", "Tocá el botón <b>Compartir</b> (el cuadradito con la flecha para arriba).", "Elegí <b>Agregar a inicio</b> y tocá <b>Agregar</b>."]
      : ["Tocá el menú <b>⋮</b> de Chrome.", "Elegí <b>Instalar app</b> o <b>Agregar a la pantalla principal</b>.", "Confirmá con <b>Instalar</b>."];
    abrirHoja(`
      <h2 class="det__titulo" id="hoja-titulo">Instalar en el celular</h2>
      <ol class="pasos-instalar">${pasos.map((p) => `<li><span>${p}</span></li>`).join("")}</ol>
      <button class="btn btn--oro btn--ancho" data-hoja-cerrar>Entendido</button>`);
  }
  $("[data-instalar]").addEventListener("click", instalar);
  $("[data-instalar-banda-btn]").addEventListener("click", instalar);
  $("[data-instalar-banda-x]").addEventListener("click", () => { guardado.escribir("amo-instalar-oculto", "1"); banda.hidden = true; });
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  /* ---------- MODO DEMO (sin Google) ---------- */
  function demo(d) {
    const db = demo.db || (demo.db = crearDemo());
    const ok = (o) => Promise.resolve(Object.assign({ ok: true }, o));
    const ahora = () => { const n = new Date(); return `${iso(n)} ${n.toTimeString().slice(0, 8)}`; };
    const ocupa = (f, mesa, hora) => db.r.some((r) => r.fecha === f && r.mesa === String(mesa) && r.estado === "confirmada" && turnoDe(r.hora) === turnoDe(hora));
    const infoCatas = () => {
      const fechas = new Set(db.c.map((c) => c.fecha));
      for (let i = 0; i < 42; i++) { const f = sumar(hoyLocal(), i); if (aFecha(f).getDay() === 3) fechas.add(f); }
      return [...fechas].sort().map((f) => {
        const c = db.c.find((x) => x.fecha === f) || {};
        const cupo = Number(c.cupo) || 60;
        const ocupados = db.e.filter((e) => e.fecha === f && ocupaLugar(e)).reduce((s, e) => s + Number(e.personas), 0);
        return { fecha: f, hora: CATA.hora, bodega: c.bodega || "", nota: c.nota || "", cupo, ocupados, libres: Math.max(0, cupo - ocupados), cancelada: c.estado === "cancelada" };
      });
    };
    if (d.accion === "panel") {
      return ok({
        hoy: hoyLocal(), ahora: ahora(),
        reservas: db.r.filter((r) => r.fecha >= d.desde), bloqueos: db.b.filter((b) => b.fecha >= d.desde),
        catas: infoCatas(), entradas: db.e.filter((e) => e.fecha >= d.desde).map((e) => Object.assign({}, e)),
        cata: { precio: CATA.precio, senaPorc: CATA.senaPorc, hora: CATA.hora, cupo: 60 }
      });
    }
    if (d.accion === "cancelar") { db.r.find((r) => r.id === d.id).estado = "cancelada"; return ok(); }
    if (d.accion === "asistencia") { db.r.find((r) => r.id === d.id).asistencia = d.valor; return ok(); }
    if (d.accion === "agregar") {
      if (d.mesa !== "armada" && ocupa(d.fecha, d.mesa, d.hora)) return ok({ ok: false, error: "Esa mesa ya está ocupada en ese turno." });
      db.r.push(Object.assign({ id: "d" + Date.now(), creada: ahora(), estado: "confirmada", asistencia: "", origen: "manual" }, d, { mesa: String(d.mesa), personas: String(d.personas) }));
      return ok();
    }
    if (d.accion === "bloquear") { db.b.push({ id: "b" + Date.now(), creado: ahora(), fecha: d.fecha, mesa: String(d.mesa), motivo: d.motivo || "", turno: d.turno || "" }); return ok(); }
    if (d.accion === "desbloquear") { db.b = db.b.filter((b) => b.id !== d.id); return ok(); }
    if (d.accion === "guardarCata") {
      db.c = db.c.filter((c) => c.fecha !== d.fecha);
      db.c.push({ fecha: d.fecha, bodega: d.bodega, cupo: d.cupo, estado: d.estado, nota: d.nota });
      return ok();
    }
    if (d.accion === "pagoCata") { const e = db.e.find((x) => x.id === d.id); e.estado = d.valor; if (d.valor === "pendiente") e.vence = ""; return ok(); }
    if (d.accion === "cancelarEntrada") { db.e.find((x) => x.id === d.id).estado = "cancelada"; return ok(); }
    if (d.accion === "agregarEntrada") {
      const total = Number(d.personas) * CATA.precio;
      db.e.push({ id: "e" + Date.now(), creada: ahora(), fecha: d.fecha, personas: String(d.personas), nombre: d.nombre, telefono: d.telefono, email: d.email,
        restricciones: d.restricciones || "No", total: String(total), sena: String(total / 2), estado: d.pagada ? "pagada" : "pendiente", vence: "", tieneComprobante: false, origen: "manual", nota: "" });
      return ok();
    }
    if (d.accion === "verComprobante") return ok({ tipo: "image/jpeg", url: "../img/sirviendo.jpg" });
    return ok({ ok: false, error: "Acción desconocida" });
  }

  function crearDemo() {
    const hoy = hoyLocal();
    const prox = (dias, n) => { const out = []; for (let i = 0; out.length < n && i < 21; i++) { const f = sumar(hoy, i); if (dias.includes(aFecha(f).getDay())) out.push(f); } return out; };
    const [n1, n2, n3] = prox([4, 5, 6], 3);
    const [sab] = prox([6], 1);
    const [dom] = prox([0], 1);
    const [mie1, mie2, mie3] = prox([3], 3);
    const viejo = `${sumar(hoy, -3)} 12:00:00`;
    const nuevo = "2099-01-01 10:00:00";
    const enDosHoras = (() => { const v = new Date(Date.now() + 5400000); return `${iso(v)} ${v.toTimeString().slice(0, 8)}`; })();
    const r = (id, fecha, hora, mesa, personas, nombre, telefono, extra = {}) => Object.assign({ id, creada: viejo, fecha, hora, mesa: String(mesa), personas: String(personas), nombre, telefono, email: nombre.split(" ")[0].toLowerCase() + "@mail.com", estado: "confirmada", asistencia: "", origen: "web", nota: "" }, extra);
    const e = (id, fecha, personas, nombre, estado, extra = {}) => Object.assign({ id, creada: viejo, fecha, personas: String(personas), nombre, telefono: "11 5555 0000", email: nombre.split(" ")[0].toLowerCase() + "@mail.com",
      restricciones: "No", total: String(personas * CATA.precio), sena: String(personas * CATA.precio / 2), estado, vence: "", tieneComprobante: estado === "revisar" || estado === "pagada", origen: "web", nota: "" }, extra);
    return {
      r: [
        r("a1", n1, "20:00", 5, 4, "Laura Gómez", "11 5555 1234", { asistencia: "llegó" }),
        r("a2", n1, "20:00", 9, 6, "Familia Ríos", "11 4321 8765"),
        r("a3", n1, "20:00", 21, 2, "Tomás Benítez", "11 6000 1122", { creada: nuevo }),
        r("a4", n1, "22:00", 14, 8, "Cumple de Sofi", "11 4444 0000", { nota: "Traen torta" }),
        r("a5", n1, "22:00", 2, 3, "Martín Ruiz", "11 3333 2222", { origen: "manual", email: "" }),
        r("a6", n1, "22:00", "armada", 12, "Oficina Pereyra", "11 2222 9999", { creada: nuevo }),
        r("a7", n1, "20:00", 12, 2, "Clara Sosa", "11 1111 2222", { estado: "cancelada" }),
        r("a8", n2, "20:00", 7, 4, "Diego Paz", "11 7777 8888", { creada: nuevo }),
        r("a9", n2, "22:00", 13, 2, "Valen y Juli", "11 8888 7777"),
        r("m1", sab, "13:00", 6, 4, "Ana Ferreira", "11 2345 6789"),
        r("m2", sab, "12:00", 20, 2, "Pablo Díaz", "11 9876 5432", { creada: nuevo }),
        r("m3", dom, "13:00", 9, 5, "Familia Costa", "11 2468 1357")
      ],
      b: n3 ? [{ id: "b1", creado: viejo, fecha: n3, mesa: "todas", motivo: "Evento privado", turno: "noche" }] : [],
      c: [
        { fecha: mie1, bodega: "Bodega Catena Zapata", cupo: "60", estado: "abierta", nota: "Malbecs de altura" },
        { fecha: mie2, bodega: "Zuccardi Valle de Uco", cupo: "60", estado: "abierta", nota: "" }
      ],
      e: [
        e("e1", mie1, 4, "Carla Méndez", "pagada", { restricciones: "1 celíaca" }),
        e("e2", mie1, 2, "Juan Pérez", "pagada"),
        e("e3", mie1, 3, "Rocío Álvarez", "revisar", { creada: nuevo, restricciones: "1 vegetariano" }),
        e("e4", mie1, 2, "Nico Torres", "pendiente", { creada: nuevo, vence: enDosHoras }),
        e("e5", mie1, 6, "Grupo Oficina Sur", "pagada", { restricciones: "2 sin lactosa" }),
        e("e6", mie1, 2, "Lucía Romero", "vencida", { vence: viejo }),
        e("e7", mie2, 2, "Fede Gil", "revisar"),
        e("e8", mie2, 4, "Sol Martínez", "pagada", { origen: "manual", tieneComprobante: false }),
        e("e9", mie3, 2, "Marcos Vera", "pendiente", { vence: enDosHoras })
      ]
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
  irAFecha(hoyLocal());
  if (st.datos && st.clave) { if (!st.datos.catas) st.datos.catas = []; if (!st.datos.entradas) st.datos.entradas = []; mostrarApp(); pintar(); }
  irA("noche");
  if (st.clave) cargar(); else mostrarLogin();
})();