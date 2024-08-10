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

const PORT = process.env?.PORT ?? 3008;
const ASSISTANT_ID = process.env?.ASSISTANT_ID ?? "";

// Definir la URL de Google Maps para la ubicación fija
const LOCATION_URL = "https://www.google.com/maps/place/2668+Diaz Miron,+Veracruz,+Mexico"; // Reemplaza "xxxxxx" con el enlace correcto

// Definir las palabras clave que activarán la respuesta con la ubicación
const LOCATION_KEYWORDS = ["dirección", "localización", "domicilio", "ubicación"];

const locationFlow = addKeyword<Provider, Database>(EVENTS.MESSAGE).addAction(
  async (ctx, { flowDynamic, provider }) => {
    const message = ctx.body.toLowerCase();
    // Comprobar si el mensaje contiene alguna de las palabras clave de ubicación
    if (LOCATION_KEYWORDS.some(keyword => message.includes(keyword))) {
      try {
        await typing(ctx, provider);
        await flowDynamic([{ body: `Aquí tienes la ubicación: ${LOCATION_URL}` }]);
      } catch (error) {
        console.error("Error enviando ubicación:", error);
        await flowDynamic([{ body: "Hubo un error al enviar la ubicación." }]);
      }
    }
  }
);

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
      console.error("Error processing message:", error);
      await flowDynamic([{ body: "Hubo un error procesando tu mensaje." }]);
    }
  }
);

const main = async () => {
  const adapterFlow = createFlow([welcomeFlow, locationFlow]); // Añadir locationFlow al flujo

  // Configuración optimizada del proveedor
  const adapterProvider = createProvider(Provider, {
    experimentalSyncMessage: true, // Activamos el modo experimental de sincronización de mensajes
    markOnlineOnConnect: true, // Marca al bot como en línea al conectar
    syncFullHistory: true, // Sincroniza todo el historial de mensajes al conectar
  });

  const adapterDB = new Database();

  const { httpServer } = await createBot({
    flow: adapterFlow,
    provider: adapterProvider,
    database: adapterDB,
  });

  httpInject(adapterProvider.server);
  httpServer(+PORT);
};

main();
