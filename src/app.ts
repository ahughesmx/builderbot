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
      const history = messageHistory[ctx.from] || []; // Obtenemos el historial de mensajes del usuario
      console.log(`Historial del usuario ${ctx.from}:`, history); // Log para ver el historial

      if (history.length === 0) {
        await flowDynamic([{ body: "No hay historial disponible para reenviar." }]);
      } else {
        const humanContact = '5218143044840@s.whatsapp.net'; // Número de contacto humano

        // Enviar el encabezado del historial
        await provider.sendText(humanContact, `Historial de mensajes del usuario ${ctx.from}:`);

        // Reenviar cada mensaje del historial
        for (const message of history) {
          await provider.sendText(humanContact, `${new Date(message.timestamp).toLocaleString()}: ${message.body}`);
        }

        await flowDynamic([{ body: "Un agente se pondrá en contacto contigo pronto." }]);
         await flowDynamic([{body: "Si lo deseas, puedes contactar a un ejecutivo de ventas aquí: [https://wa.me/5218143044840] 📞"
        }]);
      }
    } catch (error) {
      // Mostrar el mensaje de error al usuario y loguear el error inmediatamente
      await flowDynamic([{ body: "Error al reenviar el historial de mensajes." }]);
      console.error("Detalles del error:", error); // Log del error para depuración
    }
  }
);

const main = async () => {
  try {
    const adapterFlow = createFlow([welcomeFlow, locationFlow, promoFlow, humanFlow]);

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
