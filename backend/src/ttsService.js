const { Communicate } = require('universal-edge-tts');

class TTSService {
    /**
     * Synthesize text to speech
     * @param {string} text - Text to synthesize
     * @param {string} voice - Voice name (e.g., "en-US-AriaNeural")
     * @param {string} proxy - Proxy URL (http://user:pass@host:port)
     * @param {string} rate - Speech rate (e.g., "0%", "+10%")
     * @returns {Promise<{audio: Buffer, metadata: Array}>}
     */
    async synthesize(text, voice, proxy, rate = '+0%') {
        const options = {
            voice: voice,
            rate: rate,
            proxy: proxy
        };

        const communicate = new Communicate(text, options);
        const audioChunks = [];
        const metadata = [];

        try {
            for await (const chunk of communicate.stream()) {
                if (chunk.type === 'audio') {
                    audioChunks.push(chunk.data);
                } else if (chunk.type === 'WordBoundary') {
                    // Map back to original structure for compatibility
                    metadata.push({
                        Type: 'WordBoundary',
                        Data: {
                            Offset: chunk.offset,
                            Duration: chunk.duration,
                            text: {
                                Text: chunk.text
                            }
                        }
                    });
                }
            }
        } catch (error) {
            console.error('TTS Synthesis error:', error);
            throw error;
        }

        const audioBuffer = Buffer.concat(audioChunks);

        return {
            audio: audioBuffer,
            metadata: metadata
        };
    }
}

module.exports = TTSService;

