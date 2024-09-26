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
import { downloadAudio, transcribeAudio, generateAudio } from './audioUtils';

const PORT = process.env.PORT ?? 3008;

// Flujo de bienvenida
const welcomeFlow = addKeyword<Provider, Database>(['hi', 'hello', 'hola']).addAnswer(
  'Te voy a enviar un audio...'
).addAction(async (ctx, { flowDynamic }) => {
    const text = `Hola ${ctx.name}, ¿cómo estás? Bienvenido a builderbot.`;
    const audioPath = await generateAudio(text);  // Generar el archivo de audio a partir del texto
    await flowDynamic([{
        body: 'Aquí tienes el audio y el texto.',
        media: audioPath
    }]);
});

// Flujo para manejar notas de voz
const voiceNoteFlow = addKeyword<Provider, Database>(['nota de voz']).addAction(
  async (ctx, { flowDynamic, provider }) => {
    try {
        const audioUrl = ctx.urlMedia;  // La URL del archivo de audio enviado por el usuario
        const audioBuffer = await downloadAudio(audioUrl);  // Descargar el archivo de audio
        const transcription = await transcribeAudio(audioBuffer);  // Transcribir el audio

        // Generar una respuesta en audio a partir de la transcripción
        const responseAudioPath = await generateAudio(transcription);

        await flowDynamic([
            { body: `Transcripción de tu nota de voz: ${transcription}` },
            { body: 'Aquí tienes la respuesta en audio.', media: responseAudioPath }
        ]);
    } catch (error) {
        console.error('Error procesando la nota de voz:', error);
        await flowDynamic([{ body: 'Hubo un error procesando la nota de voz.' }]);
    }
  }
);

const main = async () => {
  const adapterFlow = createFlow([welcomeFlow, voiceNoteFlow]);
  const adapterProvider = createProvider(Provider);
  const adapterDB = new Database();

  const { handleCtx, httpServer } = await createBot({
    flow: adapterFlow,
    provider: adapterProvider,
    database: adapterDB,
  });

  httpServer(+PORT);
};

main();
