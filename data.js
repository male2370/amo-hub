/* =========================================================
   AMO - DATOS DEL HUB
   Este es el UNICO archivo que tenes que tocar para cambiar
   el menu, los eventos, el WhatsApp o los links.

   Reglas para no romper nada:
   - Los textos van entre comillas "asi".
   - Cada bloque { ... } se separa del siguiente con una coma.
   - Las fechas van en formato "AAAA-MM-DD" (ej: "2026-10-21").
   - Las horas en formato "HH:MM" de 24 hs (ej: "20:30").
   ========================================================= */

window.AMO = {

  /* ---------- DATOS GENERALES ---------- */
  config: {
    // Numero de WhatsApp del restaurante: codigo de pais + 9 + area + numero,
    // todo junto, sin +, sin espacios ni guiones. Ej: "5491123456789"
    whatsapp: "5491127084259",
    mensajeWhatsapp: "¡Hola AMO! Quería hacer una consulta.",

    vinotecaUrl: "https://amolavinoteca.com.ar",
    instagram: "https://instagram.com/amo.resto",

    lugar: "Club Portugués · Caballito",
    horarios: [
      "Jueves y viernes · de 20 a 00 h",
      "Sábados · de 12 a 16 h y de 20 a 00 h",
      "Domingos · de 12 a 16 h"
    ],

    // Reservas: qué días se puede reservar y en qué horarios.
    // Días: 0 = domingo, 1 = lunes, 2 = martes, 3 = miércoles,
    //       4 = jueves, 5 = viernes, 6 = sábado
    // (si cambiás días u horarios, cambialos también en el Apps Script)
    reservas: {
      turnos: [
        { id: "mediodia", nombre: "Mediodía", dias: [6, 0], horarios: ["12:00", "13:00", "14:00"] },
        { id: "noche", nombre: "Noche", dias: [4, 5, 6], horarios: ["20:00", "22:00"] }
      ],
      semanasAdelante: 4,
      maxPersonas: 8,
      // Link del Apps Script de Google (ver LEEME). Si está vacío, funciona en "modo prueba".
      api: "https://script.google.com/macros/s/AKfycbxVaVxRwDG5ot6_xIg_dFezsJc54kwuju4QbJitn3Wc5KfkAe4lMjGukjRDg_s8ErF46Q/exec"
    },

    // Catas de los miércoles
    cata: {
      hora: "20:30",
      precio: 30000,      // por persona
      senaPorc: 50,       // % de seña
      incluye: "Vinos de la bodega invitada para degustar y tapeos alternativos.",
      horasParaPagar: 2
    }
  },

  /* ---------- MENU ----------
     Cada categoria tiene una lista de platos.
     - id: nombre corto, sin espacios ni tildes (se usa en el link)
     - foto: ruta a la foto dentro de img/platos/ (si no hay foto, deja "")
     - precio: opcional, deja "" para que no se muestre
  */
  menu: [
    {
      categoria: "Entradas",
      platos: [
        { id: "rabas", nombre: "Rabas", precio: "$16.200", foto: "",
          descripcion: "En tempura con salsa tártara." },
        { id: "gambas-al-ajillo", nombre: "Gambas al ajillo", precio: "$18.400", foto: "",
          descripcion: "Con confitura de limón." },
        { id: "empanadas-de-camaron-2-unidades", nombre: "Empanadas de camarón (2 unidades)", precio: "$8.800", foto: "",
          descripcion: "Rellenas de camarón, muzzarella, verdeo y pimentón." },
        { id: "boquerones-en-oliva", nombre: "Boquerones en oliva", precio: "$18.200", foto: "",
          descripcion: "Con tomatitos asados, ajo y perejil." },
        { id: "bunuelitos-de-acelga-y-queso-sardo-estacionado", nombre: "Buñuelitos de acelga y queso sardo estacionado", precio: "$12.400", foto: "",
          descripcion: "Con salsa casera de mayonesa, mostaza, ajo y miel." },
        { id: "provoleta-rebozada", nombre: "Provoleta rebozada", precio: "$16.800", foto: "",
          descripcion: "Con ragout de hongos." }
      ]
    },
    {
      categoria: "Platos principales",
      platos: [
        { id: "bacalhau-a-bras-reversionado", nombre: "Bacalhau à Brás (reversionado)", precio: "$34.600", foto: "",
          descripcion: "Con revuelto de cebollas, papas pai, huevo, crema y sal de olivas negras." },
        { id: "trucha-mariposa", nombre: "Trucha mariposa", precio: "$32.800", foto: "",
          descripcion: "Con verduras al horno y crocante de frutos secos." },
        { id: "chernia-a-la-manteca-con-alcaparras", nombre: "Chernia a la manteca con alcaparras", precio: "$28.600", foto: "",
          descripcion: "Con papas y cebollas en caldo de ajo, pimentón y chardonnay." },
        { id: "salmon-grillado", nombre: "Salmón grillado", precio: "$34.600", foto: "",
          descripcion: "Con puré de palta cremoso y ensalada fresca." },
        { id: "bondiola-braseada", nombre: "Bondiola braseada", precio: "$28.600", foto: "",
          descripcion: "Con puré de boniato, miel ahumada, ciruelas y castañas de cajú." },
        { id: "pechuga-a-la-portuguesa", nombre: "Pechuga a la portuguesa", precio: "$24.800", foto: "",
          descripcion: "Salsa pomodoro con morrones y cebollas, con papas al horno." },
        { id: "risotto-negro-de-langostinos-y-chipirones", nombre: "Risotto negro de langostinos y chipirones", precio: "$28.800", foto: "",
          descripcion: "Opción veggie con espinacas y portobellos." },
        { id: "raviolones-negros-de-salmon", nombre: "Raviolones negros de salmón", precio: "$24.400", foto: "",
          descripcion: "Con crema de camarones, cúrcuma y eneldo." },
        { id: "canelones-de-osobuco", nombre: "Canelones de osobuco", precio: "$26.400", foto: "",
          descripcion: "Con salsa blanca y parmesano gratinado." },
        { id: "sorrentinos-de-berenjena-ahumada-batata-y-nuez", nombre: "Sorrentinos de berenjena ahumada, batata y nuez", precio: "$24.400", foto: "",
          descripcion: "Con salsa pomodoro, crema o rosa." },
        { id: "fetuccinis-con-camarones-y-mejillones", nombre: "Fetuccinis con camarones y mejillones", precio: "$24.800", foto: "",
          descripcion: "Con salsa rosa, tomates cherry asados y ajo." }
      ]
    },
    {
      categoria: "Para compartir",
      platos: [
        { id: "paella-de-mariscos", nombre: "Paella de mariscos", precio: "$58.600", foto: "",
          descripcion: "Arroz bomba, azafrán, gambas, langostinos, camarones, calamares, berberechos, callos de vieira y mejillones." },
        { id: "paella-del-senorito", nombre: "Paella del señorito", precio: "$66.200", foto: "",
          descripcion: "Todos los mariscos vienen pelados y agregamos boquerones." }
      ]
    },
    {
      categoria: "Postres",
      platos: [
        { id: "trifle-de-peras-y-ciruelas-al-oporto", nombre: "Trifle de peras y ciruelas al oporto", precio: "$8.200", foto: "",
          descripcion: "Con merengue seco y crema de canela." },
        { id: "frutillas-con-crema", nombre: "Frutillas con crema", precio: "$7.400", foto: "",
          descripcion: "Con almíbar de romero y praliné de frutos secos." },
        { id: "flan-de-miel", nombre: "Flan de miel", precio: "$7.400", foto: "",
          descripcion: "Con dulce de leche Vacalín y crema chantilly." },
        { id: "mousse-de-chocolate", nombre: "Mousse de chocolate", precio: "$7.200", foto: "",
          descripcion: "Con frutos rojos y nueces." },
        { id: "chocotorta", nombre: "Chocotorta", precio: "$8.400", foto: "",
          descripcion: "Galletas de chocolate, queso crema y dulce de leche." }
      ]
    },
    {
      categoria: "Menú kids",
      platos: [
        { id: "menu-kids-bebida-postre", nombre: "Menú kids + bebida + postre", precio: "$24.000", foto: "",
          descripcion: "Ñoquis de papa con salsa fileto o manteca, o milanesa de pollo con fideos o papa natural." }
      ]
    },
    {
      categoria: "Vinos por copa",
      platos: [
        { id: "finca-laurel-criolla-grande", nombre: "Finca Laurel Criolla Grande", precio: "$6.500", foto: "",
          descripcion: "De baja intervención." },
        { id: "nicasia-blend-de-blancs", nombre: "Nicasia Blend de Blancs", precio: "$6.500", foto: "",
          descripcion: "Catena Zapata." },
        { id: "amistad-cabernet-sauvignon", nombre: "Amistad Cabernet Sauvignon", precio: "$5.800", foto: "",
          descripcion: "Grazie Mille Vinos de Diseño." },
        { id: "amistad-rose-de-sangiovese", nombre: "Amistad Rosé de Sangiovese", precio: "$5.800", foto: "",
          descripcion: "Grazie Mille Vinos de Diseño." }
      ]
    },
    {
      categoria: "Vinos tintos",
      platos: [
        { id: "barda-pinot-noir-2021", nombre: "Barda Pinot Noir 2021", precio: "$88.400", foto: "",
          descripcion: "Bodega Chacra." },
        { id: "primus-cabernet-sauvignon-2018", nombre: "Primus Cabernet Sauvignon 2018", precio: "$78.600", foto: "",
          descripcion: "Bodega Salentein." },
        { id: "gran-design-merlot-2021", nombre: "Gran Design Merlot 2021", precio: "$66.400", foto: "",
          descripcion: "Grazie Mille Vinos de Diseño." },
        { id: "pequenas-producciones-barbera", nombre: "Pequeñas Producciones Barbera", precio: "$42.600", foto: "",
          descripcion: "Escorihuela Gascón." },
        { id: "dv-catena-malbec-malbec", nombre: "DV Catena Malbec Malbec", precio: "$40.500", foto: "",
          descripcion: "Catena Zapata." },
        { id: "espiritu-indomito-prieto-picudo", nombre: "Espíritu Indómito Prieto Picudo", precio: "$35.500", foto: "",
          descripcion: "Mauricio Lorca (España)." },
        { id: "numina-malbec", nombre: "Numina Malbec", precio: "$34.200", foto: "",
          descripcion: "Bodega Salentein." },
        { id: "libertad-cabernet-franc", nombre: "Libertad Cabernet Franc", precio: "$32.000", foto: "",
          descripcion: "Grazie Mille Vinos de Diseño." },
        { id: "libertad-syrah", nombre: "Libertad Syrah", precio: "$32.000", foto: "",
          descripcion: "Grazie Mille Vinos de Diseño." },
        { id: "finca-la-anita-gran-corte", nombre: "Finca La Anita Gran Corte", precio: "$30.600", foto: "",
          descripcion: "Finca La Anita." },
        { id: "gran-tomero-malbec", nombre: "Gran Tomero Malbec", precio: "$28.600", foto: "",
          descripcion: "Bodega Vistalba." },
        { id: "turbio-garnacha-sin-filtrar", nombre: "Turbio Garnacha (sin filtrar)", precio: "$26.400", foto: "",
          descripcion: "Ravera Wines." },
        { id: "dv-catena-cabernet-malbec", nombre: "DV Catena Cabernet - Malbec", precio: "$24.600", foto: "",
          descripcion: "Catena Zapata." },
        { id: "finca-la-anita-malbec", nombre: "Finca La Anita Malbec", precio: "$23.800", foto: "",
          descripcion: "Finca La Anita." },
        { id: "finca-la-anita-cabernet-franc", nombre: "Finca La Anita Cabernet Franc", precio: "$23.800", foto: "",
          descripcion: "Finca La Anita." },
        { id: "finca-la-anita-petit-verdot", nombre: "Finca La Anita Petit Verdot", precio: "$23.800", foto: "",
          descripcion: "Finca La Anita." },
        { id: "sapo-de-otro-pozo-blend", nombre: "Sapo de Otro Pozo Blend", precio: "$21.200", foto: "",
          descripcion: "Mosquita Muerta Wines." },
        { id: "piatelli-malbec-tannat", nombre: "Piatelli Malbec - Tannat", precio: "$20.400", foto: "",
          descripcion: "Piatelli Vineyards." },
        { id: "vistalba-d-o-c-malbec", nombre: "Vistalba D.O.C. Malbec", precio: "$19.800", foto: "",
          descripcion: "Bodega Vistalba." },
        { id: "saurus-select-pinot-noir", nombre: "Saurus Select Pinot Noir", precio: "$19.200", foto: "",
          descripcion: "Bodega Schroeder (Patagonia)." },
        { id: "nicasia-red-blend", nombre: "Nicasia Red Blend", precio: "$19.000", foto: "",
          descripcion: "Catena Zapata." },
        { id: "finca-laurel-malbec", nombre: "Finca Laurel Malbec", precio: "$19.000", foto: "",
          descripcion: "De baja intervención." },
        { id: "mita-ancellotta", nombre: "Mita Ancellotta", precio: "$19.000", foto: "",
          descripcion: "Mita Wines." },
        { id: "la-iride-malbec", nombre: "La Iride Malbec", precio: "$18.500", foto: "",
          descripcion: "Bodega La Íride." },
        { id: "amistad-cabernet-sauvignon-2", nombre: "Amistad Cabernet Sauvignon", precio: "$17.000", foto: "",
          descripcion: "Grazie Mille Vinos de Diseño." },
        { id: "perro-callejero-malbec", nombre: "Perro Callejero Malbec", precio: "$16.800", foto: "",
          descripcion: "Mosquita Muerta Wines." }
      ]
    },
    {
      categoria: "Vinos blancos",
      platos: [
        { id: "rutini-chardonnay", nombre: "Rutini Chardonnay", precio: "$38.400", foto: "",
          descripcion: "Rutini Wines." },
        { id: "calma-indomita-albarin", nombre: "Calma Indómita Albarín", precio: "$28.500", foto: "",
          descripcion: "Mauricio Lorca (España)." },
        { id: "turbio-ugni-blanc-sin-filtrar", nombre: "Turbio Ugni Blanc (sin filtrar)", precio: "$26.400", foto: "",
          descripcion: "Ravera Wines." },
        { id: "finca-la-anita-chardonnay", nombre: "Finca La Anita Chardonnay", precio: "$23.800", foto: "",
          descripcion: "Finca La Anita." },
        { id: "finca-la-anita-sauvignon-blanc", nombre: "Finca La Anita Sauvignon Blanc", precio: "$23.800", foto: "",
          descripcion: "Finca La Anita." },
        { id: "piatelli-torrontes", nombre: "Piatelli Torrontés", precio: "$20.400", foto: "",
          descripcion: "Piatelli Vineyards." },
        { id: "opalo-semillon-sauvignon", nombre: "Ópalo Semillón - Sauvignon", precio: "$19.800", foto: "",
          descripcion: "Mauricio Lorca." },
        { id: "nicasia-blend-de-blancs-2", nombre: "Nicasia Blend de Blancs", precio: "$19.000", foto: "",
          descripcion: "Catena Zapata." },
        { id: "tomero-sauvignon-blanc", nombre: "Tomero Sauvignon Blanc", precio: "$18.800", foto: "",
          descripcion: "Bodega Vistalba." },
        { id: "mikron-torrontes", nombre: "Mikron Torrontés", precio: "$17.000", foto: "",
          descripcion: "Bodega Krontiras." }
      ]
    },
    {
      categoria: "Vinos rosados",
      platos: [
        { id: "finca-la-anita-rose-de-malbec", nombre: "Finca La Anita Rosé de Malbec", precio: "$23.800", foto: "",
          descripcion: "Finca La Anita." },
        { id: "tomero-rose-de-pinot-noir", nombre: "Tomero Rosé de Pinot Noir", precio: "$18.800", foto: "",
          descripcion: "Bodega Vistalba." },
        { id: "zorzal-rose-de-pinot-noir", nombre: "Zorzal Rosé de Pinot Noir", precio: "$18.500", foto: "",
          descripcion: "Zorzal Wines." },
        { id: "amistad-rose-de-sangiovese-2", nombre: "Amistad Rosé de Sangiovese", precio: "$17.000", foto: "",
          descripcion: "Grazie Mille Vinos de Diseño." }
      ]
    },
    {
      categoria: "Espumantes",
      platos: [
        { id: "baron-b-brut-nature", nombre: "Barón B Brut Nature", precio: "$52.000", foto: "",
          descripcion: "Bodegas Chandon." },
        { id: "salentein-brut-nature", nombre: "Salentein Brut Nature", precio: "$28.500", foto: "",
          descripcion: "Bodegas Salentein." },
        { id: "chandon-extra-brut", nombre: "Chandon Extra Brut", precio: "$19.800", foto: "",
          descripcion: "Bodegas Chandon." },
        { id: "chandon-187-extra-brut", nombre: "Chandon 187 Extra Brut", precio: "$7.800", foto: "",
          descripcion: "Bodegas Chandon." }
      ]
    },
    {
      categoria: "Bebidas sin alcohol",
      platos: [
        { id: "agua-con-y-sin-gas", nombre: "Agua con y sin gas", precio: "$2.500", foto: "",
          descripcion: "" },
        { id: "limonada-750-cc", nombre: "Limonada 750 cc", precio: "$8.000", foto: "",
          descripcion: "" },
        { id: "limonada-con-menta-y-jengibre-750-cc", nombre: "Limonada con menta y jengibre 750 cc", precio: "$8.500", foto: "",
          descripcion: "" },
        { id: "limonada-con-frutos-rojos-y-miel-750-cc", nombre: "Limonada con frutos rojos y miel 750 cc", precio: "$8.500", foto: "",
          descripcion: "" },
        { id: "gaseosas-linea-coca-600-cc", nombre: "Gaseosas línea Coca 600 cc", precio: "$3.800", foto: "",
          descripcion: "" },
        { id: "aguas-saborizadas-aquarius-600-cc", nombre: "Aguas saborizadas Aquarius 600 cc", precio: "$3.800", foto: "",
          descripcion: "" }
      ]
    },
    {
      categoria: "Cervezas",
      platos: [
        { id: "corona-porron", nombre: "Corona porrón", precio: "$7.000", foto: "",
          descripcion: "" },
        { id: "guinness-stout-lata-473-cc", nombre: "Guinness Stout lata 473 cc", precio: "$7.200", foto: "",
          descripcion: "" },
        { id: "guinness-roja-lata-473-cc", nombre: "Guinness Roja lata 473 cc", precio: "$7.200", foto: "",
          descripcion: "" }
      ]
    },
    {
      categoria: "Cafetería",
      platos: [
        { id: "cafe", nombre: "Café", precio: "$2.500", foto: "",
          descripcion: "" },
        { id: "cafe-en-jarrito", nombre: "Café en jarrito", precio: "$2.900", foto: "",
          descripcion: "" },
        { id: "te-en-hebras", nombre: "Té en hebras", precio: "$3.000", foto: "",
          descripcion: "" }
      ]
    }
  ],

  /* ---------- EVENTOS ----------
     Agregalos en cualquier orden: la pagina los ordena sola
     (el mas cercano primero) y esconde los que ya pasaron.
     - link: opcional. Si lo dejas "", el boton abre WhatsApp para reservar.
  */
  eventos: [
    
    {
      fecha: "2026-10-16",
      hora: "21:00",
      titulo: "Viernes con música en vivo",
      descripcion: "Evento de ejemplo: cantante con piano. Reemplazalo por el real.",
      link: ""
    }
  ]
};