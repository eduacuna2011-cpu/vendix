const router = require('express').Router();

// GET /api/payments/config — public key para el frontend (sin auth)
router.get('/config', (req, res) => {
    const pk = process.env.CULQI_PUBLIC_KEY || '';
    res.json({ publicKey: pk });
});

// POST /api/payments/charge — cobra con token de Culqi
router.post('/charge', async (req, res) => {
    try {
        const sk = process.env.CULQI_SECRET_KEY;
        if (!sk || sk === 'sk_test_REEMPLAZAR') {
            return res.status(503).json({ error: 'Culqi no configurado aún.' });
        }

        const { token, amount, email, firstName, lastName, description } = req.body;
        if (!token || !amount || !email) {
            return res.status(400).json({ error: 'Faltan campos requeridos.' });
        }

        const amountCents = Math.round(parseFloat(amount) * 100);

        // description debe tener entre 5 y 80 caracteres
        let desc = (description || 'Suscripcion mensual Vendix').trim();
        if (desc.length < 5)  desc = 'Suscripcion mensual Vendix';
        if (desc.length > 80) desc = desc.slice(0, 80);

        const charge = {
            amount:        amountCents,
            currency_code: 'PEN',
            email,
            source_id:     token,
            description:   desc
        };

        // antifraud_details solo si tenemos datos reales (campos vacios rompen la validacion)
        if (firstName && lastName) {
            charge.antifraud_details = {
                first_name: firstName,
                last_name:  lastName
            };
        }

        const response = await fetch('https://api.culqi.com/v2/charges', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${sk}`,
                'Content-Type':  'application/json'
            },
            body: JSON.stringify(charge)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Culqi rechazo:', JSON.stringify(data));
            const msg = data?.user_message || data?.merchant_message || 'Error al procesar el pago';
            return res.status(400).json({ error: msg });
        }

        res.json({ success: true, chargeId: data.id });
    } catch (err) {
        console.error('Culqi charge error:', err);
        res.status(500).json({ error: 'Error interno al procesar el pago.' });
    }
});

module.exports = router;
