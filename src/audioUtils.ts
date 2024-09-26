import https from 'https';

// Función para descargar audio
export const downloadAudio = (url: string): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            const { statusCode } = res;

            // Verificar si la solicitud fue exitosa
            if (statusCode !== 200) {
                reject(new Error(`Error al descargar el audio. Código de estado: ${statusCode}`));
                res.resume(); // Consumir datos para liberar la memoria
                return;
            }

            const data: Uint8Array[] = [];
            res.on('data', (chunk) => data.push(chunk));
            res.on('end', () => {
                const buffer = Buffer.concat(data);
                if (buffer.length === 0) {
                    reject(new Error('El archivo descargado está vacío.'));
                } else {
                    resolve(buffer);
                }
            });
        }).on('error', (err) => {
            reject(new Error(`Error al intentar descargar el audio: ${err.message}`));
        });
    });
};

// Función para transcribir el audio (simulación)
export const transcribeAudio = async (audioUrl: string): Promise<string> => {
    try {
        const audioBuffer = await downloadAudio(audioUrl);
        console.log('Audio descargado exitosamente, tamaño del archivo:', audioBuffer.length);

        // Simulación de transcripción
        const transcription = 'Simulación de transcripción de la nota de voz.';
        return transcription;
    } catch (error) {
        console.error('Error transcribiendo el audio:', error.message);
        throw new Error('No se pudo transcribir la nota de voz.');
    }
};
