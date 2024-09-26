import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Función para descargar la nota de voz
const downloadAudio = async (url: string, filePath: string) => {
    const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream',
    });
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);
    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
};

// Función para transcribir audio
export const transcribeAudio = async (audioUrl: string): Promise<string> => {
    const audioFilePath = path.join(__dirname, 'audios', `voice-note-${Date.now()}.ogg`);

    try {
        // Descargar la nota de voz
        await downloadAudio(audioUrl, audioFilePath);
        console.log(`Audio descargado en: ${audioFilePath}`);

        // Aquí agregarías la llamada a la API de OpenAI para transcribir
        // Simulamos la transcripción como si la API hubiera funcionado
        const transcribedText = 'Esta es una transcripción de prueba de la nota de voz.';
        return transcribedText;
    } catch (error) {
        console.error('Error transcribiendo el audio:', error);
        throw new Error('Error transcribiendo el audio.');
    } finally {
        // Elimina el archivo de audio descargado
        if (fs.existsSync(audioFilePath)) {
            fs.unlinkSync(audioFilePath);
        }
    }
};

// Función para generar respuesta de audio
export const generateAudio = async (text: string): Promise<string | null> => {
    const audioFilePath = path.join(__dirname, 'audios', `response-${Date.now()}.mp3`);

    try {
        // Aquí iría el código para generar el audio utilizando la API de OpenAI
        // Simulamos la generación del audio creando un archivo vacío
        fs.writeFileSync(audioFilePath, ''); // Crea un archivo de prueba

        console.log(`Audio generado en: ${audioFilePath}`);
        return audioFilePath;
    } catch (error) {
        console.error('Error generando el audio:', error);
        return null;
    }
};
