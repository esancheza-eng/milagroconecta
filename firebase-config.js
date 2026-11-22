// ============================================================
//  MILAGRO CONECTA · Configuración
//  1) Pega aquí los datos de tu proyecto Firebase
//     (Firebase Console → Configuración del proyecto → Tus apps → Web)
//  2) Ajusta precios y dominio si hace falta
// ============================================================
export const firebaseConfig = {
  apiKey: "AIzaSyDOkCM9wLp_2UCxNmYHGoZqzILNVdp5AZo",
  authDomain: "milagro-conecta.firebaseapp.com",
  projectId: "milagro-conecta",
  storageBucket: "milagro-conecta.firebasestorage.app",
  messagingSenderId: "813537951460",
  appId: "1:813537951460:web:fc9f62d92813b0afa5f6f1"
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
