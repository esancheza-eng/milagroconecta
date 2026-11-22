// ============================================================
//  MILAGRO CONECTA · Configuración
//  1) Pega aquí los datos de tu proyecto Firebase
//     (Firebase Console → Configuración del proyecto → Tus apps → Web)
//  2) Ajusta precios y dominio si hace falta
// ============================================================
export const firebaseConfig = {
  apiKey: "PEGA_AQUI_TU_API_KEY",
  authDomain: "TU-PROYECTO.firebaseapp.com",
  projectId: "TU-PROYECTO",
  storageBucket: "TU-PROYECTO.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000"
};

export const APP = {
  nombre: "Milagro Conecta",
  dominio: "https://milagroconecta.elhyai.com",
  centro: [-2.1342, -79.5942],          // Milagro, Guayas
  // Valores iniciales (el administrador los cambia desde Admin → Ajustes)
  defaults: {
    precioPro: 5,
    precioPremium: 12,
    precioPerfilPremium: 2,
    whatsappAdmin: "",                  // ej: 0991234567
    datosPago: "Escribe aquí los datos de transferencia/depósito.",
    anuncio: ""                         // texto opcional en la barra superior
  }
};
