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
import axios from "axios"; // Nuevo import

const PORT = process.env.PORT ?? 3008;
const ASSISTANT_ID = process.env.ASSISTANT_ID ?? "";

// Enlace de Google Maps predefinido
const googleMapsLink = "https://maps.app.goo.gl/THmP2g8CCJMNKCo17"; 
const logoLink = "https://iili.io/d0hHo0P.jpg";
const promoLink = "https://cdn.shopify.com/s/files/1/0257/8605/6753/files/Promociones_de_Verano_2024_Banner_web.png";

// Palabras clave para responder con el enlace de ubicación
const locationKeywords: [string, ...string[]] = ["dirección", "localización", "localizados", "domicilio", "ubicación", "ubicados", "sucursal", "tienda", "negocio", "mapa"];
const promoKeywords: [string, ...string[]] = ["promoción", "promociones", "descuento", "rebaja", "rebajas", "descuentos", "oferta", "ofertas"];
const humanKeywords: [string, ...string[]] = ["persona", "humano", "promotor", "agente", "vendedor", "vendedora", "ventas", "asesor", "asesora", "ejecutivo", "ejecutiva"];

// Implementación de almacenamiento local para el historial de mensajes
const messageHistory: { [key: string]: { body: string, timestamp: number }[] } = {};

// Función para manejar errores de forma centralizada
const handleError = async (flowDynamic, error, customMessage = "Hubo un error procesando tu mensaje.") => {
  console.error(customMessage, error);
  await flowDynamic([{ body: customMessage }]);
};

// Función para almacenar mensajes en el historial
const saveMessage = (from: string, body: string) => {
  if (!messageHistory[from]) {
    messageHistory[from] = [];
  }
  messageHistory[from].push({ body, timestamp: Date.now() });
};

// Función para limpiar caracteres basura de las respuestas
const cleanMessage = (message: string): string => {
  return message.trim().replace(/【.*?】/g, ""); // Eliminar caracteres no deseados
};

// Función para procesar archivos de audio
const processAudioMessage = async (ctx, flowDynamic) => {
  try {
    // Extraer el enlace del archivo de audio
    const audioUrl = ctx.message.audio.url;

    // Descargar el archivo de audio desde el enlace
    const audioData = await axios.get(audioUrl, { responseType: "arraybuffer" });

    // Convertir el archivo de audio en texto usando OpenAI API
    const transcriptionResponse = await axios.post(
      "https://api.openai.com/v1/audio/transcriptions",
      audioData.data,
      {
        headers: {
          "Content-Type": "audio/mpeg",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    const transcribedText = transcriptionResponse.data.text;

    // Llamar al flujo de bienvenida o cualquier flujo relevante con el texto transcrito
    ctx.body = transcribedText;
    await welcomeFlow.getHandler()(ctx, { flowDynamic });
  } catch (error) {
    await handleError(flowDynamic, error, "Error al procesar el mensaje de audio:");
  }
};

// Flujo de bienvenida
const welcomeFlow = addKeyword<Provider, Database>(EVENTS.WELCOME).addAction(
  async (ctx, { flowDynamic, state, provider }) => {
    try {
      await typing(ctx, provider);
      const response = await toAsk(ASSISTANT_ID, ctx.body, state);
      const chunks = response.split(/\n\n+/);
      for (const chunk of chunks) {
        const cleanedChunk = cleanMessage(chunk);
        await flowDynamic([{ body: cleanedChunk }]);
      }
      saveMessage(ctx.from, ctx.body);
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

// Flujo para responder con promociones
const promoFlow = addKeyword<Provider, Database>(promoKeywords).addAction(
  async (ctx, { flowDynamic }) => {
    try {
      await flowDynamic([{ body: `Aprovecha en Agosto.`, media: promoLink }]);
      await flowDynamic([{ body: `*Aplican Restricciones*` }]);
    } catch (error) {
      await handleError(flowDynamic, error, "Error al enviar las promociones:");
    }
  }
);

// Flujo para reenviar historial de mensajes a un humano
const humanFlow = addKeyword<Provider, Database>(humanKeywords).addAction(
  async (ctx, { flowDynamic, provider }) => {
    try {
      const history = messageHistory[ctx.from] || [];
      console.log(`Historial del usuario ${ctx.from}:`, history);

      if (history.length === 0) {
        await flowDynamic([{ body: "No hay historial disponible para reenviar." }]);
      } else {
        const humanContact = '5218143044840@s.whatsapp.net';
        await provider.sendText(humanContact, `Historial de mensajes del usuario ${ctx.from}:`);

        for (const message of history) {
          await provider.sendText(humanContact, `${new Date(message.timestamp).toLocaleString()}: ${message.body}`);
        }

        await flowDynamic([{ body: "Un agente se pondrá en contacto contigo pronto." }]);
         await flowDynamic([{body: `Teléfono 2292 300 400`}])
      }
    } catch (error) {
      await handleError(flowDynamic, error, "Error al reenviar el historial:");
    }
  }
);

// Flujo para manejar mensajes de audio
const audioMessageFlow = addKeyword<Provider, Database>(["audio"]).addAction(
  async (ctx, { flowDynamic }) => {
    if (ctx.message.audio) {
      await processAudioMessage(ctx, flowDynamic);
    } else {
      await flowDynamic([{ body: "Por favor envía un mensaje de audio para procesar." }]);
    }
  }
);

// Crear flujo principal
const adapterFlow = createFlow([welcomeFlow, locationFlow, promoFlow, humanFlow, audioMessageFlow]);

// Iniciar el bot con Baileys como proveedor
const main = async () => {
  const provider = createProvider(Provider);
  const bot = createBot(adapterFlow, provider, Database);
  bot.start(PORT);
};

main();
