const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const BASE = 'https://vendix-app.vercel.app';
const OUT = path.join(__dirname, 'screenshots');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

async function shot(page, name) {
    await new Promise(r => setTimeout(r, 600));
    await page.screenshot({ path: path.join(OUT, name), fullPage: false });
    console.log('📸', name);
}

(async () => {
    const browser = await puppeteer.launch({
        executablePath: CHROME,
        headless: true,
        defaultViewport: { width: 1400, height: 800 },
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
    });
    const page = await browser.newPage();

    // Get auth token via API
    const res = await page.evaluate(async () => {
        const r = await fetch('https://vendix-app.vercel.app/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: 'takethebite200', password: 'fqcj$SCFuJy5' })
        });
        return r.json();
    });
    // Store token in page context
    const token = res.token;

    // Login page screenshot
    await page.goto(BASE + '/login.html', { waitUntil: 'domcontentloaded' });
    await shot(page, '00_login.png');

    // Inject token and navigate to dashboard
    await page.evaluate((tok) => { localStorage.setItem('authToken', tok); }, token);
    await page.goto(BASE + '/index.html', { waitUntil: 'networkidle2', timeout: 15000 });
    await shot(page, '01_dashboard.png');

    // Inventory
    await page.goto(BASE + '/inventory.html', { waitUntil: 'networkidle2', timeout: 15000 });
    await shot(page, '02_inventory.png');

    // Try to open add product modal
    try {
        const btn = await page.$('button.btn-primary, button[onclick*="add"], button::-p-text(Add Product)');
        if (!btn) {
            const btns = await page.$$('button');
            for (const b of btns) {
                const txt = await b.evaluate(el => el.textContent);
                if (txt.includes('Add') || txt.includes('Agregar')) { await b.click(); break; }
            }
        } else { await btn.click(); }
        await new Promise(r => setTimeout(r, 800));
        await shot(page, '03_add_product_modal.png');
        await page.keyboard.press('Escape');
    } catch(e) { console.log('Modal skip:', e.message); }

    // Sales
    await page.goto(BASE + '/sales.html', { waitUntil: 'networkidle2', timeout: 15000 });
    await shot(page, '04_sales.png');

    // Sellers
    await page.goto(BASE + '/sellers.html', { waitUntil: 'networkidle2', timeout: 15000 });
    await shot(page, '05_sellers.png');

    // Add Seller modal
    try {
        const btns = await page.$$('button');
        for (const b of btns) {
            const txt = await b.evaluate(el => el.textContent);
            if (txt.includes('Add') || txt.includes('Agregar')) { await b.click(); break; }
        }
        await new Promise(r => setTimeout(r, 800));
        await shot(page, '06_add_seller_modal.png');
        await page.keyboard.press('Escape');
    } catch(e) {}

    // Settings
    await page.goto(BASE + '/settings.html', { waitUntil: 'networkidle2', timeout: 15000 });
    await shot(page, '07_settings.png');

    await browser.close();
    console.log('\n✅ Done! Saved to:', OUT);
    fs.readdirSync(OUT).filter(f=>f.endsWith('.png')).forEach(f => console.log(' -', f));
})();
