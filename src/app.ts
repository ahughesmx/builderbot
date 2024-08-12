import "dotenv/config";
import {
  createBot,
  createProvider,
  createFlow,
  addKeyword,
  EVENTS,
} from "@builderbot/bot";
import { MemoryDB as Database } from "@builderbot/bot";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import { toAsk, httpInject } from "@builderbot-plugins/openai-assistants";
import { typing } from "./utils/presence";

const PORT = process.env.PORT ?? 3008;
const ASSISTANT_ID = process.env.ASSISTANT_ID ?? "";

// Enlace de Google Maps predefinido
const googleMapsLink = "https://maps.app.goo.gl/THmP2g8CCJMNKCo17"; // Reemplaza con tu enlace
const logoLink = "https://iili.io/d0hHo0P.jpg";
const promoLink = "https://cdn.shopify.com/s/files/1/0257/8605/6753/files/Promociones_de_Verano_2024_Banner_web.png";

// Palabras clave para responder con el enlace de ubicación
const locationKeywords: [string, ...string[]] = ["dirección", "localización", "localizados", "domicilio", "ubicación", "ubicados", "sucursal", "tienda", "negocio", "mapa"];
const promoKeywords: [string, ...string[]] = ["promoción", "promociones", "descuento", "rebaja", "rebajas", "descuentos", "oferta", "ofertas"];


// Función para manejar errores de forma centralizada
const handleError = async (flowDynamic, error, customMessage = "Hubo un error procesando tu mensaje.") => {
  console.error(customMessage, error);
  await flowDynamic([{ body: customMessage }]);
};

// Flujo de bienvenida
const welcomeFlow = addKeyword<Provider, Database>(EVENTS.WELCOME).addAction(
  async (ctx, { flowDynamic, state, provider }) => {
    try {
      await typing(ctx, provider);
      const response = await toAsk(ASSISTANT_ID, ctx.body, state);
      const chunks = response.split(/\n\n+/);
      for (const chunk of chunks) {
        await flowDynamic([{ body: chunk.trim() }]);
      }
    } catch (error) {
      await handleError(flowDynamic, error);
    }
  }
);

// Flujo para responder con el enlace de Google Maps
const locationFlow = addKeyword<Provider, Database>(locationKeywords).addAction(
  async (ctx, { flowDynamic }) => {
    try {
     await flowDynamic([{ body: `Av. Salvador Díaz Mirón #2668, Colonia Electricistas, C.P. 91916, Veracruz, Ver.`, media: logoLink }]);
     await flowDynamic([{ body: googleMapsLink }]);
    } catch (error) {
      await handleError(flowDynamic, error, "Error al enviar el enlace de ubicación:");
    }
  }
);

// Flujo para responder con el enlace de Google Maps
const promoFlow = addKeyword<Provider, Database>(promoKeywords).addAction(
  async (ctx, { flowDynamic }) => {
    try {
     await flowDynamic([{ body: `Aprovecha en Agosto.`, media: promoLink }]);
     await flowDynamic([{ body: `*Aplican Restricciones*` }]);
    } catch (error) {
      await handleError(flowDynamic, error, "Error al enviar el enlace de ubicación:");
    }
  }
);


const main = async () => {
  try {
    const adapterFlow = createFlow([welcomeFlow, locationFlow]);

    // Configuración del proveedor
    const adapterProvider = createProvider(Provider, {
      experimentalSyncMessage: true, // Activar sincronización experimental de mensajes
      markOnlineOnConnect: true,    // Marcar al bot como en línea al conectar
      syncFullHistory: true,        // Sincronizar todo el historial de mensajes al conectar
    });

    const adapterDB = new Database();

    const { httpServer } = await createBot({
      flow: adapterFlow,
      provider: adapterProvider,
      database: adapterDB,
    });

    httpInject(adapterProvider.server);
    httpServer(+PORT);
  } catch (error) {
    console.error("Error initializing bot:", error);
  }
};

main();
