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
  const R = Object.assign({ dias: [4, 5, 6], horarios: ["20:00", "22:00"], semanasAdelante: 4, maxPersonas: 8 }, D.config.reservas);
  const sel = { fecha: null, hora: null, personas: null, otro: false };
  let fechas = [];

  const conHora = (d, h) => {
    const [hh, mm] = h.split(":").map(Number);
    const x = new Date(d); x.setHours(hh, mm || 0, 0, 0); return x;
  };
  const horasLibres = (d) => R.horarios.filter((h) => conHora(d, h) > new Date());
  const fechaLarga = (d) => `${DIAS_LARGO[d.getDay()]} ${d.getDate()} de ${MESES_LARGO[d.getMonth()]}`;
  const mayus = (t) => t.charAt(0).toUpperCase() + t.slice(1);
  const textoPersonas = (n) => `${n} ${n === 1 ? "persona" : "personas"}`;

  const cajaOtro = $("[data-personas-otro]");
  const inputOtro = $("[data-personas-input]");
  const notaOtro = $("[data-personas-nota]");
  inputOtro.min = R.maxPersonas + 1;

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
    sel.fecha = null; sel.hora = null; sel.personas = null; sel.otro = false;
    inputOtro.value = ""; notaOtro.textContent = ""; cajaOtro.hidden = true;
    fechas = calcularFechas();
    $("[data-dias]").innerHTML = fechas.map((d, i) => `
      <button type="button" class="dia" data-dia="${i}" aria-pressed="false" aria-label="${esc(fechaLarga(d))}">
        <span class="dia__sem">${DIAS[d.getDay()]}</span>
        <span class="dia__num">${d.getDate()}</span>
        <span class="dia__mes">${MESES[d.getMonth()]}</span>
      </button>`).join("");
    pintarHoras();
    pintarPersonas();
    pintarResumen();
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

  function leerOtro() {
    const n = parseInt(inputOtro.value, 10);
    if (!inputOtro.value) { notaOtro.textContent = ""; return null; }
    if (isNaN(n) || n <= R.maxPersonas) { notaOtro.textContent = `Escribí un número mayor a ${R.maxPersonas}.`; return null; }
    notaOtro.textContent = "";
    return n;
  }

  function pintarResumen() {
    const caja = $("[data-resumen]");
    if (!sel.fecha || !sel.hora || !sel.personas) { caja.hidden = true; return; }
    const estabaOculta = caja.hidden;
    const dia = mayus(fechaLarga(sel.fecha));
    $("[data-resumen-texto]").innerHTML = `<small>Tu reserva</small>${esc(dia)}<br>a las ${esc(sel.hora)} hs · ${esc(textoPersonas(sel.personas))}`;
    $("[data-confirmar]").href = wa(
      `¡Hola AMO! Quiero reservar una mesa.\n\n` +
      `Día: ${dia}\n` +
      `Horario: ${sel.hora} hs\n` +
      `Personas: ${sel.personas}\n\n` +
      `¿Tienen lugar? ¡Gracias!`
    );
    caja.hidden = false;
    if (estabaOculta && !sel.otro) caja.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  $("[data-dias]").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-dia]"); if (!b) return;
    sel.fecha = fechas[Number(b.dataset.dia)];
    sel.hora = null;
    $$("[data-dia]").forEach((x) => x.setAttribute("aria-pressed", x === b));
    pintarHoras();
    pintarPersonas();
    pintarResumen();
  });

  $("[data-horas]").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-hora]"); if (!b || b.disabled) return;
    sel.hora = b.dataset.hora;
    $$("[data-hora]").forEach((x) => x.setAttribute("aria-pressed", x === b));
    pintarPersonas();
    pintarResumen();
  });

  $("[data-personas]").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-persona]"); if (!b) return;
    if (b.dataset.persona === "mas") {
      sel.otro = true;
      sel.personas = leerOtro();
    } else {
      sel.otro = false;
      sel.personas = Number(b.dataset.persona);
    }
    pintarPersonas();
    pintarResumen();
    if (sel.otro) inputOtro.focus();
  });

  inputOtro.addEventListener("input", () => {
    sel.personas = leerOtro();
    pintarResumen();
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

    if (partes[0] === "reservar") { pintarReserva(); mostrar("reservar"); document.title = "Reservar · AMO"; }
    else if (partes[0] === "menu" && partes[1]) { pintarPlato(decodeURIComponent(partes[1])); mostrar("plato"); }
    else if (partes[0] === "menu") { mostrar("menu"); document.title = "Menú · AMO"; }
    else if (partes[0] === "eventos") { mostrar("eventos"); document.title = "Eventos · AMO"; }
    else mostrar("inicio");

    window.scrollTo(0, 0);
  }

  window.addEventListener("hashchange", rutear);
  rutear();
})();