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

// Enlace predefinido de Google Maps
const googleMapsLink = "https://goo.gl/maps/XYZ123"; // Reemplaza XYZ123 con la ubicación deseada

// Palabras clave para activar la respuesta de ubicación
const locationKeywords = ["dirección", "localización", "domicilio", "ubicación", "mapa"];

// Flujo de bienvenida optimizado
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

// Nuevo flujo para responder con el enlace de Google Maps
const locationFlow = addKeyword<Provider, Database>(locationKeywords).addAction(
  async (ctx, { flowDynamic }) => {
    try {
      await flowDynamic([{ body: `Aquí tienes nuestra ubicación: ${googleMapsLink}` }]);
    } catch (error) {
      console.error("Error sending location link:", error);
    }
  }
);

const main = async () => {
  const adapterFlow = createFlow([welcomeFlow, locationFlow]);

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
