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
const googleMapsLink = "https://g.co/kgs/ZJgZ112"; // Reemplaza con tu enlace

// Palabras clave para responder con el enlace de ubicación
const locationKeywords: [string, ...string[]] = ["dirección", "localización", "domicilio", "ubicación", "mapa"];

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
      await flowDynamic([{ body: `Aquí tienes nuestra ubicación: ${googleMapsLink}` }]);
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
