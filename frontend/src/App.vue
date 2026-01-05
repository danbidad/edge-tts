<script setup>
import { ref, computed, watch, onMounted } from 'vue';

// --- State ---
const audioRef = ref(null);
const loading = ref(false);
const error = ref(null);
const audioSrc = ref(null);
const metadata = ref([]);
const currentTime = ref(0);
const currentWordIndex = ref(-1);

// Sample Data for Languages
const languages = [
  {
    code: 'ko-KR',
    name: 'Korean (한국어)',
    flag: '🇰🇷',
    voice: 'ko-KR-SunHiNeural',
    text: '안녕하세요. 이것은 Edge TTS를 이용한 한국어 음성 합성 테스트입니다. 단어를 클릭하면 해당 위치로 이동하며, 재생 중에는 현재 읽고 있는 단어가 강조됩니다.'
  },
  {
    code: 'en-US',
    name: 'English (US)',
    flag: '🇺🇸',
    voice: 'en-US-JennyNeural',
    text: 'Hello! This is a demonstration of the multi-language Text-to-Speech player. You can click on any word to jump to that exact moment in the audio. Notice how the words light up as they are spoken.'
  },
  {
    code: 'ja-JP',
    name: 'Japanese (日本語)',
    flag: '🇯🇵',
    voice: 'ja-JP-NanamiNeural',
    text: 'こんにちは。これは多言語対応の音声合成プレーヤーのデモです。単語をクリックすると、その位置にジャンプできます。再生に合わせて単語がハイライトされるのを確認してください。'
  },
  {
    code: 'zh-CN',
    name: 'Chinese (中文)',
    flag: '🇨🇳',
    voice: 'zh-CN-XiaoxiaoNeural',
    text: '你好！这是一个多语言语音合成演示。您可以点击任何单词跳转到音频中的确切位置。请注意单词在朗读时是如何高亮的。'
  },
  {
    code: 'es-ES',
    name: 'Spanish (Español)',
    flag: '🇪🇸',
    voice: 'es-ES-ElviraNeural',
    text: '¡Hola! Esta es una demostración del reproductor de texto a voz en varios idiomas. Puedes hacer clic en cualquier palabra para saltar a ese momento exacto. Observa cómo se iluminan las palabras mientras se pronuncian.'
  },
  {
    code: 'fr-FR',
    name: 'French (Français)',
    flag: '🇫🇷',
    voice: 'fr-FR-DeniseNeural',
    text: 'Bonjour! Ceci est une démonstration du lecteur de synthèse vocale multilingue. Vous pouvez cliquer sur n\'importe quel mot pour accéder à ce moment précis. Remarquez comment les mots s\'illuminent lorsqu\'ils sont prononcés.'
  },
  {
    code: 'de-DE',
    name: 'German (Deutsch)',
    flag: '🇩🇪',
    voice: 'de-DE-KatjaNeural',
    text: 'Hallo! Dies ist eine Demonstration des mehrsprachigen Text-to-Speech-Players. Sie können auf jedes Wort klicken, um genau zu diesem Zeitpunkt zu springen. Beachten Sie, wie die Wörter beim Sprechen hervorgehoben werden.'
  },
  {
    code: 'vi-VN',
    name: 'Vietnamese (Tiếng Việt)',
    flag: '🇻🇳',
    voice: 'vi-VN-HoaiMyNeural',
    text: 'Xin chào! Đây là bản demo của trình phát chuyển văn bản sang giọng nói đa ngôn ngữ. Bạn có thể nhấp vào bất kỳ từ nào để chuyển đến thời điểm chính xác đó. Hãy chú ý cách các từ sáng lên khi chúng được nói.'
  },
  {
    code: 'th-TH',
    name: 'Thai (ไทย)',
    flag: '🇹🇭',
    voice: 'th-TH-PremwadeeNeural',
    text: 'สวัสดี! นี่คือการสาธิตเครื่องเล่น Text-to-Speech หลายภาษา คุณสามารถคลิกที่คำใดก็ได้เพื่อข้ามไปยังช่วงเวลานั้น สังเกตว่าคำต่างๆ สว่างขึ้นอย่างไรเมื่อถูกพูด'
  },
];

const selectedLangCode = ref('ko-KR');
const selectedLanguage = computed(() => languages.find(l => l.code === selectedLangCode.value));

const text = ref(selectedLanguage.value.text);
const activeWords = ref([]);

// Rate Setting
const rate = ref(0); // -50 to 50
// Map slider (-50 to 50) to playbackRate (0.5 to 1.5)
const playbackRate = computed(() => {
    return 1 + (rate.value / 100);
});
const rateString = computed(() => {
    return (rate.value > 0 ? '+' : '') + rate.value + '%';
});

// Watch playbackRate to update audio element immediately
watch(playbackRate, (newRate) => {
    if (audioRef.value) {
        audioRef.value.playbackRate = newRate;
    }
});

// Watch language change to update text
watch(selectedLangCode, (newVal) => {
  const lang = languages.find(l => l.code === newVal);
  if (lang) {
    text.value = lang.text;
    // Reset state
    audioSrc.value = null;
    metadata.value = [];
    activeWords.value = [];
    currentWordIndex.value = -1;
  }
});

// --- API & Playback Logic ---

const generateTTS = async () => {
    loading.value = true;
    error.value = null;
    audioSrc.value = null;
    metadata.value = [];
    currentWordIndex.value = -1;
    activeWords.value = [];

    try {
        // Request default speed (0%) from backend to ensure consistent base file
        const response = await fetch('http://localhost:3000/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: text.value,
                voice: selectedLanguage.value.voice,
                // Rate removed or set to default '0%' implicitly by backend if omitted
            }),
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Failed to generate TTS');
        }

        const data = await response.json();
        
        // Process Audio
        // Backend now returns a relative URL for the audio file
        if (data.audioUrl) {
            audioSrc.value = `http://localhost:3000/audio/${data.audioUrl}`;
        } else if (data.audio) {
            // Fallback for legacy (if any)
            const byteCharacters = atob(data.audio);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'audio/mp3' });
            audioSrc.value = URL.createObjectURL(blob);
        }
        
        // Process Metadata
        if (data.metadata && Array.isArray(data.metadata)) {
            // Normalize metadata structure
            // Usually comes as objects with { Data: { Offset, Duration, text: { Text } } } or flat
            // We map it to a simpler structure: { text, start (sec), end (sec) }
            
            activeWords.value = data.metadata.map((item, index) => {
                // Defensive parsing depending on exact return shape
                const dataObj = item.Data || item;
                const textObj = dataObj.text || {};
                const rawText = textObj.Text || dataObj.Text || '';
                
                const offsetTicks = dataObj.Offset || 0;
                const durationTicks = dataObj.Duration || 0;
                
                return {
                    index,
                    text: rawText,
                    start: offsetTicks / 10000000,
                    end: (offsetTicks + durationTicks) / 10000000
                };
            }).filter(w => w.text.trim() !== ''); // Filter out empty space events if any
            
            metadata.value = data.metadata;
        }

    } catch (e) {
        error.value = e.message;
        console.error(e);
    } finally {
        loading.value = false;
    }
};

const onTimeUpdate = () => {
    if (!audioRef.value) return;
    
    // Ensure playback rate is maintained (sometimes resets on new source load)
    if (audioRef.value.playbackRate !== playbackRate.value) {
        audioRef.value.playbackRate = playbackRate.value;
    }

    const time = audioRef.value.currentTime;
    currentTime.value = time;
    
    // Find active word
    // We assume words are sorted by time.
    const active = activeWords.value.find(word => time >= word.start && time < word.end);
    
    // Use a bit of buffer/hysteresis or stick to the last one if slightly between words
    // But strict check is usually fine for highlights
    if (active) {
        currentWordIndex.value = active.index;
    } else {
        // Optional: Keep last word highlighted if pause between sentences? 
        // Or just clear it. Let's clear it.
        currentWordIndex.value = -1;
    }
};

const seekToWord = (word) => {
    if (audioRef.value && word) {
        audioRef.value.currentTime = word.start + 0.01; // Adding a tiny bit to ensure it lands inside
        audioRef.value.play();
    }
};
</script>

<template>
  <div class="min-h-screen bg-base-200 p-8 font-sans">
    <div class="max-w-5xl mx-auto space-y-8">
      
      <!-- Header -->
      <div class="text-center space-y-2">
        <h1 class="text-4xl font-extrabold text-primary flex items-center justify-center gap-3">
          <span class="text-5xl">🗣️</span>
          <span>Global TTS Player</span>
        </h1>
        <p class="text-base-content/70">Multi-language Text-to-Speech with Real-time Sync Highlighting</p>
      </div>

      <!-- Main Card -->
      <div class="card bg-base-100 shadow-2xl overflow-hidden border border-base-300">
        
        <!-- Language Tabs -->
        <div class="bg-base-200/50 p-2 overflow-x-auto">
            <div class="flex gap-2">
                <button 
                    v-for="lang in languages" 
                    :key="lang.code"
                    @click="selectedLangCode = lang.code"
                    class="btn btn-sm md:btn-md transition-all"
                    :class="selectedLangCode === lang.code ? 'btn-primary shadow-lg scale-105' : 'btn-ghost hover:bg-base-300'"
                >
                    <span class="text-lg">{{ lang.flag }}</span>
                    <span class="hidden md:inline">{{ lang.name.split('(')[0] }}</span>
                </button>
            </div>
        </div>

        <div class="card-body p-6 md:p-8 gap-6 grid md:grid-cols-2">
            
            <!-- Input Section -->
            <div class="flex flex-col gap-4 h-full">
                <div class="flex justify-between items-center">
                    <label class="label">
                        <span class="label-text font-bold text-lg">Input Text</span>
                    </label>
                    <div class="flex items-center gap-2">
                         <div class="badge badge-outline">{{ selectedLanguage.voice }}</div>
                         <div class="badge badge-ghost gap-1">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-3 h-3">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {{ rateString }}
                         </div>
                    </div>
                </div>
                
                <!-- Speed Control -->
                <div class="form-control w-full">
                    <label class="label py-1">
                        <span class="label-text-alt">Speed Control</span>
                    </label>
                    <input type="range" min="-50" max="50" v-model.number="rate" class="range range-xs range-primary" step="5" />
                    <div class="w-full flex justify-between text-xs px-2 opacity-50">
                        <span>-50%</span>
                        <span>0%</span>
                        <span>+50%</span>
                    </div>
                </div>
                
                <textarea 
                    v-model="text"
                    class="textarea textarea-bordered h-full min-h-[250px] text-lg leading-relaxed resize-none focus:textarea-primary transition-all shadow-inner"
                    placeholder="Enter text here..."
                ></textarea>
                
                <button 
                    @click="generateTTS" 
                    class="btn btn-primary btn-lg w-full shadow-lg group"
                    :disabled="loading"
                >
                    <span v-if="loading" class="loading loading-spinner"></span>
                    <span v-else class="flex items-center gap-2">
                        Generate Audio
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor" class="w-5 h-5 group-hover:translate-x-1 transition-transform">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                        </svg>
                    </span>
                </button>
            </div>

            <!-- Output Section -->
            <div class="flex flex-col gap-4 h-full bg-base-200/30 rounded-2xl p-6 border border-base-200 relative">
                <div class="absolute top-4 right-4 text-xs font-mono text-base-content/40">
                  Preview
                </div>

                <div v-if="loading" class="flex-1 flex flex-col items-center justify-center text-base-content/50 gap-4">
                    <span class="loading loading-dots loading-lg text-primary"></span>
                    <p class="animate-pulse">Synthesizing speech...</p>
                </div>

                <div v-else-if="!audioSrc" class="flex-1 flex flex-col items-center justify-center text-base-content/30 gap-2 border-2 border-dashed border-base-300 rounded-xl">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-16 h-16">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 9c.366-2.747 2.276-4.993 4.904-5.234C5.512 3.52 6.046 3 6.75 3z" />
                    </svg>
                    <p>Generated audio & text will appear here</p>
                </div>

                <div v-else class="flex flex-col h-full gap-4">
                    <!-- Audio Player -->
                    <div class="w-full bg-base-100 p-3 rounded-full shadow-sm border border-base-200">
                        <audio 
                            ref="audioRef" 
                            controls 
                            autoplay 
                            :src="audioSrc" 
                            @timeupdate="onTimeUpdate"
                            class="w-full h-10"
                        ></audio>
                    </div>

                    <!-- Interactive Transcript -->
                    <div class="flex-1 overflow-y-auto p-4 bg-base-100 rounded-xl shadow-inner border border-base-200 leading-8">
                        <div v-if="activeWords.length > 0" class="flex flex-wrap gap-x-1.5 gap-y-1 content-start">
                            <span 
                                v-for="word in activeWords" 
                                :key="word.index"
                                @click="seekToWord(word)"
                                class="px-1.5 py-0.5 rounded cursor-pointer transition-all duration-200 hover:bg-base-200 select-none"
                                :class="[
                                    currentWordIndex === word.index 
                                        ? 'bg-primary text-primary-content scale-110 font-bold shadow-md z-10' 
                                        : 'text-base-content hover:scale-105'
                                ]"
                            >
                                {{ word.text }}
                            </span>
                        </div>
                        <div v-else class="text-base-content/60 italic text-center mt-10">
                             Metadata not available for sync features.
                        </div>
                    </div>
                </div>

            </div>
        </div>

        <!-- Debug Info (Collapsed) -->
        <div v-if="error" class="alert alert-error m-6 mb-0">
            <span>{{ error }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Custom Scrollbar for transcript */
.overflow-y-auto::-webkit-scrollbar {
  width: 8px;
}
.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}
.overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: oklch(var(--b3));
  border-radius: 20px;
}
</style>
