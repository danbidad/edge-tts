const express = require('express');
const ProxyManager = require('./proxyManager');
const TTSService = require('./ttsService');
const { db } = require('./db/index');
const { ttsLogs } = require('./db/schema');
const { eq, and, lt } = require('drizzle-orm');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const port = 3000;

// Ensure audio directory exists
const audioDir = path.join(__dirname, '../public/audio');
if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
}

// Middleware
const cors = require('cors');
app.use(cors());
app.use(express.json());
// Serve static files for audio
app.use('/audio', express.static(audioDir));

// Initialize services
const proxyManager = new ProxyManager('3judf9mc4p9hu2lx71eenooni2wakfswkgz9tpqt');
const ttsService = new TTSService();

async function startServer() {
    try {
        await proxyManager.initialize();
        console.log('프록시 매니저 초기화 완료.');

        // Cleanup Job (Every 10 minutes)
        setInterval(cleanupOldFiles, 10 * 60 * 1000);
        // Run once on startup
        cleanupOldFiles();

        app.listen(port, () => {
            console.log(`Edge TTS 서버가 http://localhost:${port} 에서 실행 중입니다.`);
        });
    } catch (error) {
        console.error('프록시 매니저 초기화 실패:', error);
        process.exit(1);
    }
}

async function cleanupOldFiles() {
    console.log('오래된 파일 정리 시작...');
    try {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago

        // Find logs older than 1 hour
        const oldLogs = await db.select().from(ttsLogs).where(lt(ttsLogs.createdAt, oneHourAgo));

        for (const log of oldLogs) {
            // Delete file
            const filePath = path.join(audioDir, log.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`파일 삭제됨: ${log.filename}`);
            }

            // Delete from DB
            await db.delete(ttsLogs).where(eq(ttsLogs.id, log.id));
        }

        if (oldLogs.length > 0) {
            console.log(`${oldLogs.length}개의 오래된 항목을 삭제했습니다.`);
        }
    } catch (error) {
        console.error('파일 정리 중 오류 발생:', error);
    }
}

app.post('/tts', async (req, res) => {
    const { text, voice, rate = '+0%' } = req.body;

    if (!text || !voice) {
        return res.status(400).json({ error: 'text와 voice 파라미터가 필요합니다.' });
    }

    try {
        // 1. Check Cache (Database)
        const cachedResults = await db.select().from(ttsLogs).where(
            and(
                eq(ttsLogs.text, text),
                eq(ttsLogs.voice, voice),
                eq(ttsLogs.rate, rate)
            )
        ).limit(1);

        if (cachedResults.length > 0) {
            const cached = cachedResults[0];
            const filePath = path.join(audioDir, cached.filename);

            // Validate if file actually exists on disk
            if (fs.existsSync(filePath)) {
                console.log(`캐시된 결과 반환 (Rate: ${rate}):`, cached.filename);
                return res.json({
                    audioUrl: cached.filename, // Frontend will prepend base URL
                    metadata: JSON.parse(cached.metadata),
                    cached: true
                });
            } else {
                // DB has record but file is missing? Delete and regenerate
                await db.delete(ttsLogs).where(eq(ttsLogs.id, cached.id));
            }
        }

        // 2. Generate New TTS
        let attempts = 0;
        const maxAttempts = 3;
        let lastError = null;
        let result = null;

        while (attempts < maxAttempts) {
            try {
                const proxy = proxyManager.getNextProxy();
                console.log(`시도 ${attempts + 1}: 프록시 ${proxy} 사용 중`);

                result = await ttsService.synthesize(text, voice, proxy, rate);
                break; // Success

            } catch (error) {
                console.error(`시도 ${attempts + 1} 실패:`, error.message);
                lastError = error;
                attempts++;
            }
        }

        if (!result) {
            return res.status(500).json({ error: '여러 번 시도했으나 음성 합성에 실패했습니다.', details: lastError?.message });
        }

        // 3. Save to File
        const filename = `${uuidv4()}.mp3`;
        const filePath = path.join(audioDir, filename);
        fs.writeFileSync(filePath, result.audio);

        // 4. Save to DB
        await db.insert(ttsLogs).values({
            text: text,
            voice: voice,
            rate: rate,
            filename: filename,
            metadata: JSON.stringify(result.metadata),
            createdAt: new Date(),
        });

        console.log(`새로운 TTS 생성 및 저장 완료 (Rate: ${rate}):`, filename);

        // 5. Return Response
        return res.json({
            audioUrl: filename,
            metadata: result.metadata,
            cached: false
        });

    } catch (error) {
        console.error('서버 오류:', error);
        res.status(500).json({ error: '서버 내부 오류가 발생했습니다.' });
    }
});

startServer();

