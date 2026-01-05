const WebSocket = require('ws');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { v4: uuidv4 } = require('uuid');

class TTSService {
    constructor() {
        this.endpoint = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4';
    }

    /**
     * Synthesize text to speech
     * @param {string} text - Text to synthesize
     * @param {string} voice - Voice name (e.g., "en-US-AriaNeural")
     * @param {string} proxy - Proxy URL (http://user:pass@host:port)
     * @returns {Promise<{audio: Buffer, metadata: Array}>}
     */
    async synthesize(text, voice, proxy, rate = '0%') {
        return new Promise((resolve, reject) => {
            const agent = new HttpsProxyAgent(proxy);
            const ws = new WebSocket(this.endpoint, {
                agent: agent,
                headers: {
                    'Pragma': 'no-cache',
                    'Cache-Control': 'no-cache',
                    'Origin': 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Accept-Language': 'en-US,en;q=0.9',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.77 Safari/537.36 Edg/91.0.864.41'
                }
            });

            const requestId = uuidv4().replace(/-/g, '');
            const audioChunks = [];
            const metadata = [];

            ws.on('open', () => {
                // Send Speech.Config
                const configMessage = `X-Timestamp:${new Date().toString()}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"true"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}\r\n`;
                ws.send(configMessage);

                // Send SSML with Rate
                const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xmlns:mstts='https://www.w3.org/2001/mstts' xml:lang='en-US'><voice name='${voice}'><prosody rate='${rate}'>${text}</prosody></voice></speak>`;
                const ssmlMessage = `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:${new Date().toString()}\r\nPath:ssml\r\n\r\n${ssml}`;
                ws.send(ssmlMessage);
            });

            ws.on('message', (data, isBinary) => {
                if (isBinary) {
                    const headerLength = (data[0] << 8) | data[1];
                    const header = data.slice(2, 2 + headerLength).toString();

                    if (header.includes('Path:audio\r\n')) {
                        const audioData = data.slice(2 + headerLength);
                        audioChunks.push(audioData);
                    }
                } else {
                    const message = data.toString();
                    if (message.includes('Path:audio.metadata')) {
                        const jsonStart = message.indexOf('\r\n\r\n') + 4;
                        const jsonStr = message.substring(jsonStart);
                        try {
                            const meta = JSON.parse(jsonStr);
                            if (meta.Metadata) {
                                meta.Metadata.forEach(m => metadata.push(m));
                            }
                        } catch (e) {
                            console.error('메타데이터 파싱 오류:', e);
                        }
                    } else if (message.includes('Path:turn.end')) {
                        ws.close();
                    }
                }
            });

            ws.on('close', () => {
                const audioBuffer = Buffer.concat(audioChunks);
                resolve({
                    audio: audioBuffer,
                    metadata: metadata
                });
            });

            ws.on('error', (error) => {
                reject(error);
            });
        });
    }
}

module.exports = TTSService;
