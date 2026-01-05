const axios = require('axios');

class ProxyManager {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.proxies = [];
        this.currentIndex = 0;
    }

    async initialize() {
        try {
            console.log('Webshare.io에서 프록시 목록을 가져오는 중...');
            // Webshare API to get proxy list. 
            // Using page_size=100 for now. The user didn't specify strict pagination needs, 
            // but for a rotation pool, 100 is usually a good start.
            const response = await axios.get('https://proxy.webshare.io/api/v2/proxy/list/?mode=direct&page=1&page_size=100', {
                headers: {
                    'Authorization': `Token ${this.apiKey}`
                }
            });

            if (response.data && response.data.results) {
                this.proxies = response.data.results.map(p => {
                    // Webshare returns object like { username, password, proxy_address, port, ... }
                    // We need to format it for https-proxy-agent: http://user:pass@host:port
                    return `http://${p.username}:${p.password}@${p.proxy_address}:${p.port}`;
                });
                console.log(`성공적으로 ${this.proxies.length}개의 프록시를 가져왔습니다.`);
            } else {
                console.error('프록시 가져오기 실패: 잘못된 응답 형식', response.data);
                throw new Error('잘못된 프록시 응답');
            }
        } catch (error) {
            console.error('프록시 목록 가져오기 오류:', error.message);
            throw error;
        }
    }

    getNextProxy() {
        if (this.proxies.length === 0) {
            throw new Error('No proxies available. Call initialize() first.');
        }

        const proxy = this.proxies[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
        return proxy;
    }
}

module.exports = ProxyManager;
