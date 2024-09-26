
const downloadAudio = (url: string): Promise<Buffer> => {
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
