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
import { transcribeAudio, generateAudio } from './audioUtils';  // Funciones asumidas para procesar audio

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

// Función para procesar notas de voz y generar respuestas
const processVoiceNoteFlow = addKeyword<Provider, Database>(['voice_note']).addAction(
  async (ctx, { flowDynamic, provider }) => {
    try {
      // Obtener la URL de la nota de voz desde el contexto
      const audioUrl = ctx?.mediaUrl;
      if (!audioUrl) {
        throw new Error("No se detectó una nota de voz.");
      }

      // Transcribir la nota de voz
      const transcription = await transcribeAudio(audioUrl);
      await flowDynamic([{ body: `Tu nota de voz dice: ${transcription}` }]);

      // Generar respuesta en audio
      const responseText = `Hola, has dicho lo siguiente: ${transcription}. Gracias por tu mensaje.`;
      const audioResponsePath = await generateAudio(responseText);

      // Enviar la respuesta con audio y transcripción
      await provider.sendMedia(ctx.from, audioResponsePath, 'audio/mpeg');
      await flowDynamic([{ body: `Aquí está mi respuesta en audio.` }]);
    } catch (error) {
      await handleError(flowDynamic, error, "Error procesando la nota de voz:");
    }
  }
);

// Flujo de bienvenida
const welcomeFlow = addKeyword<Provider, Database>(EVENTS.WELCOME).addAction(
  async (ctx, { flowDynamic, state, provider }) => {
    try {
      await typing(ctx, provider);
      const response = await toAsk(ASSISTANT_ID, ctx.body, state);
      const chunks = response.split(/\n\n+/);
      for (const chunk of chunks) {
        const cleanedChunk = cleanMessage(chunk); // Limpiar cada fragmento de la respuesta
        await flowDynamic([{ body: cleanedChunk }]);
      }
      saveMessage(ctx.from, ctx.body); // Almacenar el mensaje recibido
    } catch (error) {
      await handleError(flowDynamic, error);
    }
  }
);

const main = async () => {
  try {
    const adapterFlow = createFlow([welcomeFlow, processVoiceNoteFlow]);

    // Proveedor configurado con manejo robusto de iPhones
    const adapterProvider = createProvider(Provider, {
      markOnlineOnConnect: true,   // Marcar al bot como en línea al conectar
      syncFullHistory: true,       // Sincronizar todo el historial de mensajes al conectar
      experimentalSyncMessage: "Lo siento, tuvimos problemas con tu mensaje. Por favor intenta nuevamente.",
      retryOnFailure: true,        // Reintentar en caso de fallo de conexión
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
