import { createBot, createProvider, createFlow, addKeyword } from '@builderbot/bot';
import { MemoryDB as Database } from '@builderbot/bot';
import { BaileysProvider as Provider } from '@builderbot/provider-baileys';
import { transcribeAudio, generateAudio } from './audioUtils';
import path from 'path';
import fs from 'fs';

const PORT = process.env.PORT ?? 3008;

const welcomeFlow = addKeyword<Provider, Database>(['hi', 'hello', 'hola'])
    .addAnswer('Te voy a enviar un audio...')
    .addAction(async (ctx, { flowDynamic }) => {
        const text = `Hola ${ctx.name}, ¿cómo estás? Bienvenido a BuilderBot. Esta es una prueba de cómo se comporta la API de OpenAI.`;
        const audioPath = await generateAudio(text);
        if (audioPath) {
            await flowDynamic([{ media: audioPath }]);
        } else {
            await flowDynamic([{ body: 'Error generando el audio' }]);
        }
    });

// Flujo para procesar notas de voz
const voiceNoteFlow = addKeyword<Provider, Database>(['voice', 'nota de voz'])
    .addAction(async (ctx, { flowDynamic }) => {
        const voiceNoteUrl = ctx.message?.urlMedia;
        if (voiceNoteUrl) {
            try {
                const transcript = await transcribeAudio(voiceNoteUrl);
                const responseText = `Recibí tu nota de voz, transcripción: "${transcript}". Ahora te respondo con un audio.`;
                const audioResponse = await generateAudio(responseText);
                if (audioResponse) {
                    await flowDynamic([{ body: responseText }, { media: audioResponse }]);
                } else {
                    await flowDynamic([{ body: 'Error procesando la nota de voz.' }]);
                }
            } catch (error) {
                console.error('Error procesando la nota de voz:', error);
                await flowDynamic([{ body: 'Error procesando la nota de voz.' }]);
            }
        } else {
            await flowDynamic([{ body: 'No se detectó una nota de voz.' }]);
        }
    });

const main = async () => {
    const adapterFlow = createFlow([welcomeFlow, voiceNoteFlow]);
    const adapterProvider = createProvider(Provider);
    const adapterDB = new Database();

    const { handleCtx, httpServer } = await createBot({
        flow: adapterFlow,
        provider: adapterProvider,
        database: adapterDB,
    });

    adapterProvider.server.post(
        '/v1/messages',
        handleCtx(async (bot, req, res) => {
            const { number, message, urlMedia } = req.body;
            await bot.sendMessage(number, message, { media: urlMedia ?? null });
            return res.end('sended');
        })
    );

    httpServer(+PORT);
};

main();
