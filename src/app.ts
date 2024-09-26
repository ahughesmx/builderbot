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

// Flujo de bienvenida con envío de audio
const welcomeFlow = addKeyword<Provider, Database>(['hi', 'hello', 'hola']).addAnswer(
  'Te voy a enviar un audio...'
).addAction(async (ctx, { flowDynamic, provider }) => {
    try {
        const text = `Hola ${ctx.name}, ¿cómo estás? Bienvenido a builderbot.`;
        const audioPath = await generateAudio(text);  // Generar el archivo de audio a partir del texto

        // Verificar si el archivo de audio fue generado correctamente
        if (audioPath) {
            await flowDynamic([
                { body: 'Aquí tienes el audio y el texto.', media: audioPath }
            ]);
        } else {
            await flowDynamic([{ body: 'Hubo un error al generar el audio.' }]);
        }
    } catch (error) {
        console.error('Error enviando el audio de bienvenida:', error);
        await flowDynamic([{ body: 'Ocurrió un error procesando el audio.' }]);
    }
});

// Flujo para manejar notas de voz
const voiceNoteFlow = addKeyword<Provider, Database>(['nota de voz']).addAction(
  async (ctx, { flowDynamic, provider }) => {
    try {
        const audioUrl = ctx.urlMedia;  // La URL del archivo de audio enviado por el usuario
        if (!audioUrl) {
            await flowDynamic([{ body: 'No se ha recibido una nota de voz.' }]);
            return;
        }

        const audioBuffer = await downloadAudio(audioUrl);  // Descargar el archivo de audio
        const transcription = await transcribeAudio(audioBuffer);  // Transcribir el audio

        // Generar una respuesta en audio a partir de la transcripción
        const responseAudioPath = await generateAudio(transcription);

        // Verificar si el audio fue generado correctamente
        if (responseAudioPath) {
            await flowDynamic([
                { body: `Transcripción de tu nota de voz: ${transcription}` },
                { body: 'Aquí tienes la respuesta en audio.', media: responseAudioPath }
            ]);
        } else {
            await flowDynamic([{ body: 'Hubo un error al generar la respuesta en audio.' }]);
        }
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

  const { httpServer } = await createBot({
    flow: adapterFlow,
    provider: adapterProvider,
    database: adapterDB,
  });

  httpServer(+PORT);
};

main();
