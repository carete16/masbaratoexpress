const axios = require('axios');
async function test() {
    try {
        const res = await axios.get('https://dealsea.com/rss', {
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        console.log('STATUS:', res.status);
        console.log('LENGTH:', res.data.length);
    } catch (e) {
        console.log('ERROR:', e.message);
        if (e.response) console.log('STATUS:', e.response.status);
    }
}
test();
