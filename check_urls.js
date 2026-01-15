const axios = require('axios');

const urls = [
    'https://masbaratodeals-net.onrender.com/',
    'https://masbaratodeals-net.onrender.com/test',
    'https://masbaratodeals-net.onrender.com/health',
    'https://masbarato-deals-net.onrender.com/',
    'https://masbarato-deals-net.onrender.com/test'
];

async function check() {
    for (const url of urls) {
        try {
            const res = await axios.get(url, { timeout: 10000 });
            console.log(`✅ [${res.status}] ${url}`);
        } catch (e) {
            console.log(`❌ [${e.response ? e.response.status : 'ERR'}] ${url}`);
        }
    }
}

check();
