import "dotenv/config";
import axios from "axios";
import {
  createBot,
  createProvider,
  createFlow,
  addKeyword,
  EVENTS,
} from "@builderbot/bot";
import { MemoryDB as Database } from "@builderbot/bot";
import { BaileysProvider as Provider } from "@builderbot/provider-baileys";
import { typing } from "./utils/presence";

const PORT = process.env?.PORT ?? 3008;
const ASSISTANT_ID = process.env?.ASSISTANT_ID ?? "";

// Enlace de Google Maps para la ubicación fija
const fixedLocationLink = "https://www.google.com/maps/place/123+Main+St,+City,+Country"; // Reemplaza con la dirección específica

// Función para analizar el mensaje del usuario con OpenAI
async function analyzeMessage(userMessage) {
  try {
    const response = await axios.post(
      "https://api.openai.com/v1/engines/davinci-codex/completions",
      {
        prompt: `El usuario ha enviado el siguiente mensaje: "${userMessage}". ¿Debería enviar un enlace de ubicación? Responde con "sí" o "no".`,
        max_tokens: 10,
        n: 1,
        stop: ["\n"],
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    const message = response.data.choices[0].text.trim().toLowerCase();
    return message === "sí";
  } catch (error) {
    console.error("Error al analizar el mensaje:", error);
    return false;
  }
}

const mainFlow = addKeyword<Provider, Database>(EVENTS.WELCOME).addAction(
  async (ctx, { flowDynamic, state, provider }) => {
    try {
      await typing(ctx, provider);

      // Analizar el mensaje del usuario para determinar si enviar la ubicación
      const shouldSendLocation = await analyzeMessage(ctx.body);

      if (shouldSendLocation) {
        await flowDynamic([
          {
            body: `Aquí tienes el enlace de Google Maps para la ubicación: ${fixedLocationLink}`,
          },
        ]);
      } else {
        const response = await toAsk(ASSISTANT_ID, ctx.body, state);
        const chunks = response.split(/\n\n+/);
        for (const chunk of chunks) {
          await flowDynamic([{ body: chunk.trim() }]);
        }
      }
    } catch (error) {
      console.error("Error processing message:", error);
      await flowDynamic([{ body: "Hubo un error procesando tu mensaje." }]);
    }
  }
);

const main = async () => {
  const adapterFlow = createFlow([mainFlow]);

  const adapterProvider = createProvider(Provider, {
    experimentalSyncMessage: true,
    markOnlineOnConnect: true,
    syncFullHistory: true,
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
