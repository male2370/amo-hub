/* =========================================================
   AMO - PLANO DEL SALÓN
   Cada mesa tiene:
   - num:  número real de la mesa (el cliente NO lo ve; le llega a tu jefe)
   - x, y: posición en el plano (de 0 a 1000 de ancho, 0 a 1400 de alto)
   - w, h: ancho y alto
   - cap:  para cuántas personas es
   - min:  desde cuántas personas se puede elegir
           (así una pareja no ocupa la mesa grande)
   ========================================================= */

window.AMO_SALON = {
  ancho: 1000,
  alto: 1400,

  mesas: [
    { num: 20, x: 30,  y: 40,   w: 160, h: 58,  cap: 4, min: 1 },
    { num: 21, x: 30,  y: 170,  w: 160, h: 58,  cap: 4, min: 1 },
    { num: 22, x: 30,  y: 300,  w: 160, h: 58,  cap: 4, min: 1 },
    { num: 8,  x: 335, y: 45,   w: 145, h: 65,  cap: 4, min: 1 },
    { num: 9,  x: 345, y: 190,  w: 135, h: 150, cap: 6, min: 5 },
    { num: 7,  x: 780, y: 95,   w: 160, h: 58,  cap: 4, min: 1 },
    { num: 6,  x: 780, y: 225,  w: 160, h: 58,  cap: 4, min: 1 },
    { num: 5,  x: 780, y: 355,  w: 160, h: 58,  cap: 4, min: 1 },
    { num: 12, x: 225, y: 475,  w: 140, h: 85,  cap: 4, min: 1 },
    { num: 13, x: 545, y: 480,  w: 90,  h: 75,  cap: 4, min: 1 },
    { num: 14, x: 360, y: 620,  w: 175, h: 120, cap: 8, min: 5 },
    { num: 15, x: 330, y: 815,  w: 120, h: 275, cap: 4, min: 1 },
    { num: 4,  x: 790, y: 680,  w: 160, h: 62,  cap: 4, min: 1 },
    { num: 3,  x: 800, y: 810,  w: 150, h: 58,  cap: 4, min: 1 },
    { num: 2,  x: 810, y: 935,  w: 140, h: 62,  cap: 4, min: 1 },
    { num: 1,  x: 425, y: 1195, w: 170, h: 75,  cap: 4, min: 1 }
  ],

  // Referencias del salón (solo decorativas)
  referencias: [
    { texto: "Puerta",          x: 735, y: 0,    w: 175, h: 16,  tipo: "puerta" },
    { texto: "Piano",           x: 900, y: 460,  w: 70,  h: 170, tipo: "bloque", vertical: true },
    { texto: "Barra y cocina",  x: 0,   y: 900,  w: 125, h: 500, tipo: "bloque", vertical: true },
    { texto: "Vinoteca",        x: 0,   y: 365,  w: 14,  h: 180, tipo: "pared",  vertical: true },
    { texto: "Baño",            x: 0,   y: 610,  w: 14,  h: 135, tipo: "pared",  vertical: true }
  ]
};