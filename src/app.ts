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

// Constants
const PORT = process.env?.PORT ?? 3008;
const ASSISTANT_ID = process.env?.ASSISTANT_ID ?? "";
const GOOGLE_MAPS_URL = "https://www.google.com/maps/place/12668+Diaz+Miron,+Veracruz,+Mexico"; // Replace with your actual Google Maps URL

// Welcome Flow
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

// Location Flow
const locationKeywords = ["dirección", "localización", "domicilio", "ubicación"];
const locationFlow = addKeyword<Provider, Database>(locationKeywords).addAction(
  async (ctx, { flowDynamic, provider }) => {
    try {
      await typing(ctx, provider);
      await flowDynamic([
        { body: "Aquí está la ubicación que solicitaste:" },
        { body: GOOGLE_MAPS_URL },
      ]);
    } catch (error) {
      console.error("Error processing location request:", error);
      await flowDynamic([{ body: "Hubo un error procesando tu solicitud de ubicación." }]);
    }
  }
);

// Main Function
const main = async () => {
  const adapterFlow = createFlow([welcomeFlow, locationFlow]);

  // Optimized Provider Configuration
  const adapterProvider = createProvider(Provider, {
    experimentalSyncMessage: true, // Activate experimental message synchronization
    markOnlineOnConnect: true, // Mark the bot online upon connection
    syncFullHistory: true, // Synchronize the full message history upon connection
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
