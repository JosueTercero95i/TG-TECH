document.addEventListener('DOMContentLoaded', () => {
    // State management
    let state = {
        customerName: '',
        model: '',
        type: '',
        imei: '',
        price: '',
        warranty: '30',
        paymentMethod: 'Efectivo C$',
        cashReceived: '',
        history: JSON.parse(localStorage.getItem('iphone_sales') || '[]')
    };

    // DOM Elements
    const customerNameInput = document.getElementById('customer-name');
    const modelButtons = document.querySelectorAll('[data-model]');
    const typeButtons = document.querySelectorAll('[data-type]');
    const displayProduct = document.getElementById('display-product');
    const displayTotal = document.getElementById('display-total');
    const displayChange = document.getElementById('display-change');
    const imeiInput = document.getElementById('imei-input');
    const priceInput = document.getElementById('price-input');
    const warrantyInput = document.getElementById('warranty-input');
    const paymentMethodSelect = document.getElementById('payment-method');
    const cashInput = document.getElementById('cash-input');
    const btnPrint = document.getElementById('btn-print');
    const btnClear = document.getElementById('btn-clear');
    const businessNameEl = document.getElementById('business-name');
    
    // Sidebar Elements
    const historySidebar = document.getElementById('history-sidebar');
    const toggleHistoryBtn = document.getElementById('toggle-history');
    const closeHistoryBtn = document.getElementById('close-history');
    const historyList = document.getElementById('history-list');
    const clearHistoryBtn = document.getElementById('btn-clear-history');

    // Bluetooth State
    let printerDevice = null;
    let printerCharacteristic = null;
    let logoBytes = null; // Stores processed image
    const btnConnectBT = document.getElementById('btn-connect-bt');
    const statusText = btnConnectBT.querySelector('.status-text');

    // Auto-load TGTECH logo
    window.addEventListener('load', () => {
        const img = new Image();
        img.onload = () => processImage(img);
        img.src = 'TGTECH.png';
    });

    function processImage(img) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const paperWidth = 384; // Total paper width
        const logoWidth = 180; // Reduced logo size for better aesthetics
        const height = Math.round(img.height * (logoWidth / img.width));
        
        canvas.width = paperWidth;
        canvas.height = height;
        
        // Fill white background and center logo
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, paperWidth, height);
        const xOffset = (paperWidth - logoWidth) / 2;
        ctx.drawImage(img, xOffset, 0, logoWidth, height);
        
        const imgData = ctx.getImageData(0, 0, paperWidth, height);
        const pixels = imgData.data;
        const bytes = new Uint8Array((paperWidth * height) / 8);
        for (let i = 0; i < pixels.length; i += 4) {
            const avg = (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3;
            const black = avg < 128; // Threshold
            if (black) {
                const pixelIdx = i / 4;
                const byteIdx = Math.floor(pixelIdx / 8);
                const bitIdx = 7 - (pixelIdx % 8);
                bytes[byteIdx] |= (1 << bitIdx);
            }
        }
        // ESC/POS GS v 0 m xL xH yL yH
        const xL = (paperWidth / 8) % 256;
        const xH = Math.floor((paperWidth / 8) / 256);
        const yL = height % 256;
        const yH = Math.floor(height / 256);
        const header = new Uint8Array([0x1D, 0x76, 0x30, 0x00, xL, xH, yL, yH]);
        logoBytes = new Uint8Array(header.length + bytes.length);
        logoBytes.set(header);
        logoBytes.set(bytes, header.length);
        alert('Logo cargado y centrado con éxito');
    }

    // Set Default Business Name
    if (!localStorage.getItem('iphone_business_name')) {
        businessNameEl.innerText = 'TG TECH';
        localStorage.setItem('iphone_business_name', 'TG TECH');
    } else {
        businessNameEl.innerText = localStorage.getItem('iphone_business_name');
    }

    // History Sidebar Logic
    toggleHistoryBtn.addEventListener('click', () => {
        historySidebar.classList.add('show');
        playClickSound();
    });

    closeHistoryBtn.addEventListener('click', () => {
        historySidebar.classList.remove('show');
        playClickSound();
    });

    clearHistoryBtn.addEventListener('click', () => {
        if (confirm('¿Estás seguro de que quieres borrar todo el historial?')) {
            state.history = [];
            localStorage.setItem('iphone_sales', JSON.stringify([]));
            renderHistory();
            playClickSound();
        }
    });

    renderHistory();

    // Bluetooth Logic
    btnConnectBT.addEventListener('click', async () => {
        if (printerDevice && printerDevice.gatt.connected) {
            await printerDevice.gatt.disconnect();
            onDisconnected();
            return;
        }
        try {
            statusText.innerText = 'Buscando...';
            const device = await navigator.bluetooth.requestDevice({
                filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
                optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
            });
            printerDevice = device;
            device.addEventListener('gattserverdisconnected', onDisconnected);
            const server = await device.gatt.connect();
            const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
            const characteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
            printerCharacteristic = characteristic;
            onConnected();
        } catch (error) {
            statusText.innerText = 'Conectar BT';
        }
    });

    function onConnected() { btnConnectBT.classList.add('connected'); statusText.innerText = 'Conectado'; }
    function onDisconnected() { btnConnectBT.classList.remove('connected'); statusText.innerText = 'Conectar BT'; printerDevice = null; printerCharacteristic = null; }

    // Inputs
    customerNameInput.addEventListener('input', (e) => {
        state.customerName = e.target.value;
        validateForm();
    });

    modelButtons.forEach(btn => btn.addEventListener('click', () => {
        modelButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.model = btn.dataset.model;
        updateDisplay();
        validateForm();
        playClickSound();
    }));

    typeButtons.forEach(btn => btn.addEventListener('click', () => {
        typeButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.type = btn.dataset.type;
        updateDisplay();
        validateForm();
        playClickSound();
    }));

    imeiInput.addEventListener('input', (e) => {
        // Only numbers, exactly 4 digits
        let val = e.target.value.replace(/\D/g, '').slice(0, 4);
        state.imei = val;
        e.target.value = val;
        
        if (val.length === 4) {
            imeiInput.classList.remove('error');
            imeiInput.classList.add('success');
        } else {
            imeiInput.classList.remove('success');
            if (val.length > 0) imeiInput.classList.add('error');
        }
        validateForm();
    });

    priceInput.addEventListener('input', (e) => {
        state.price = e.target.value;
        updateTotals();
        validateForm();
    });

    cashInput.addEventListener('input', (e) => {
        state.cashReceived = e.target.value;
        updateTotals();
    });

    warrantyInput.addEventListener('input', (e) => {
        state.warranty = e.target.value;
        validateForm();
    });
    
    paymentMethodSelect.addEventListener('change', (e) => {
        state.paymentMethod = e.target.value;
        validateForm();
    });

    // Keyboard Navigation
    const inputs = [customerNameInput, imeiInput, priceInput, warrantyInput, cashInput];
    inputs.forEach((input, index) => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const nextInput = inputs[index + 1];
                if (nextInput) {
                    nextInput.focus();
                } else {
                    if (!btnPrint.disabled) btnPrint.click();
                }
            }
        });
    });

    function validateForm() {
        const isModelSelected = state.model !== '';
        const isTypeSelected = state.type !== '';
        const isNameValid = state.customerName.trim().length > 2;
        const isImeiValid = state.imei.length === 4;
        const isPriceValid = parseFloat(state.price) > 0;
        
        const isValid = isModelSelected && isTypeSelected && isNameValid && isImeiValid && isPriceValid;
        
        btnPrint.disabled = !isValid;
        
        // Visual feedback for name
        if (state.customerName.trim().length > 2) {
            customerNameInput.classList.add('success');
            customerNameInput.classList.remove('error');
        } else if (state.customerName.length > 0) {
            customerNameInput.classList.add('error');
            customerNameInput.classList.remove('success');
        } else {
            customerNameInput.classList.remove('error', 'success');
        }

        return isValid;
    }

    function updateTotals() {
        const total = parseFloat(state.price || 0);
        const cash = parseFloat(state.cashReceived || 0);
        displayTotal.innerText = `$${total.toFixed(2)}`;
        const change = cash - total;
        displayChange.innerText = `$${(change >= 0 ? change : 0).toFixed(2)}`;
        
        if (cash < total && cash > 0) {
            cashInput.classList.add('error');
        } else {
            cashInput.classList.remove('error');
        }
    }

    function updateDisplay() {
        if (state.model && state.type) {
            displayProduct.innerText = `iPhone ${state.model} ${state.type}`;
            displayProduct.classList.remove('placeholder');
        } else {
            displayProduct.innerText = 'Selecciona modelo y tipo';
            displayProduct.classList.add('placeholder');
        }
    }

    btnClear.addEventListener('click', resetForm);

    function resetForm() {
        state.customerName = ''; state.model = ''; state.type = ''; state.imei = ''; state.price = ''; state.cashReceived = '';
        state.warranty = '30'; state.paymentMethod = 'Efectivo C$';
        
        customerNameInput.value = '';
        modelButtons.forEach(b => b.classList.remove('active'));
        typeButtons.forEach(b => b.classList.remove('active'));
        
        imeiInput.value = ''; 
        priceInput.value = ''; 
        cashInput.value = '';
        warrantyInput.value = '30';
        paymentMethodSelect.value = 'Efectivo C$';
        
        customerNameInput.classList.remove('error', 'success');
        imeiInput.classList.remove('error', 'success');
        cashInput.classList.remove('error', 'success');

        updateTotals(); 
        updateDisplay();
        validateForm();
    }

    btnPrint.addEventListener('click', async () => {
        if (!validateForm()) {
            alert('Por favor complete todos los campos obligatorios'); return;
        }
        saveSale();
        updatePrintTemplate();
        if (printerCharacteristic) { await printToBluetooth(); } else { window.print(); }
        triggerSuccess();
    });

    function updatePrintTemplate() {
        document.getElementById('p-customer').innerText = state.customerName;
        document.getElementById('p-product').innerText = `iPhone ${state.model} ${state.type}`;
        document.getElementById('p-imei').innerText = state.imei;
        document.getElementById('p-warranty').innerText = `${state.warranty} días`;
        document.getElementById('p-method').innerText = state.paymentMethod;
        document.getElementById('p-total').innerText = `$${parseFloat(state.price).toFixed(2)}`;
        document.getElementById('print-date').innerText = new Date().toLocaleString();
    }

    async function printToBluetooth() {
        const encoder = new TextEncoder();
        const INIT = '\x1B\x40';
        const CENTER = '\x1B\x61\x01';
        const LEFT = '\x1B\x61\x00';
        const BOLD_ON = '\x1B\x45\x01';
        const BOLD_OFF = '\x1B\x45\x00';
        const SMALL = '\x1B\x4D\x01';
        const LARGE_ON = '\x1D\x21\x11'; 
        const LARGE_OFF = '\x1D\x21\x00';
        const FEED = '\x1B\x64\x0A';
        const CUT = '\x1D\x56\x41\x00';

        // 1. Initialize
        await printerCharacteristic.writeValue(encoder.encode(INIT + CENTER));

        // 2. Print Logo if exists
        if (logoBytes) {
            const B_CHUNK = 100;
            for (let i = 0; i < logoBytes.length; i += B_CHUNK) {
                await printerCharacteristic.writeValue(logoBytes.slice(i, i + B_CHUNK));
            }
            await printerCharacteristic.writeValue(encoder.encode('\n'));
        }

        // 3. Print Text
        let data = BOLD_ON + LARGE_ON + 'TG TECH\n\n' + LARGE_OFF + BOLD_OFF;
        data += 'Tel: +505 8537-9833\n';
        data += 'Direccion: Rotonda Cristo Rey\n2c Al Sur\n';
        data += '--------------------------------\n';
        data += new Date().toLocaleString() + '\n';
        data += '--------------------------------\n';
        data += LEFT + 'CLIENTE: ' + state.customerName + '\n';
        data += BOLD_ON + 'PRODUCTO: ' + `iPhone ${state.model} ${state.type}` + BOLD_OFF + '\n';
        data += 'IMEI (ULT 4): ' + state.imei + '\n';
        data += 'PAGO: ' + state.paymentMethod + '\n';
        data += 'GARANTIA: ' + state.warranty + ' DIAS\n';
        data += '--------------------------------\n';
        data += BOLD_ON + 'TOTAL: $' + parseFloat(state.price).toFixed(2) + BOLD_OFF + '\n';
        if (state.cashReceived) {
            data += 'RECIBIDO: $' + parseFloat(state.cashReceived).toFixed(2) + '\n';
            data += 'CAMBIO: $' + (parseFloat(state.cashReceived) - parseFloat(state.price)).toFixed(2) + '\n';
        }
        data += '********************************\n\n';
        data += CENTER + BOLD_ON + 'POLITICAS DE GARANTIA\n\n' + BOLD_OFF;
        data += LEFT +
               '- Cliente: ' + state.customerName + '\n' +
               '- Producto: iPhone ' + state.model + ' ' + state.type + '\n' +
               '- IMEI: ' + state.imei + '\n' +
               '- Garantia por ' + state.warranty + ' dias\n  por fallas de fabrica.\n' +
               '- Aplica solo con factura original\n  firmada.\n' +
               '- No valida si esta vencida.\n' +
               '- No cubre: golpes, humedad,\n  caidas, sobrecargas o software.\n' +
               '- No cubre desgaste de puertos,\n  botones o alteraciones fisicas.\n' +
               '- Revision tecnica previa (24h).\n' +
               '- No hay cambios ni reembolsos.\n' +
               '- No se aceptan reclamos por\n  detalles esteticos.\n' +
               '- Bateria: solo si no carga 100%\n  o apaga antes de 20%.\n';
        data += CENTER + '\nGRACIAS POR SU COMPRA\n' + FEED + CUT;

        const bytes = encoder.encode(data);
        const CHUNK_SIZE = 100;
        for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
            await printerCharacteristic.writeValue(bytes.slice(i, i+CHUNK_SIZE));
        }
    }

    function saveSale() {
        const sale = {
            id: Date.now(),
            customer: state.customerName,
            product: `iPhone ${state.model} ${state.type}`,
            imei: state.imei,
            price: state.price,
            warranty: state.warranty,
            date: new Date().toISOString()
        };
        state.history.unshift(sale);
        localStorage.setItem('iphone_sales', JSON.stringify(state.history));
        renderHistory();
    }

    function renderHistory() {
        if (state.history.length === 0) {
            historyList.innerHTML = '<p class="empty-msg">No hay ventas registradas</p>';
            return;
        }

        historyList.innerHTML = state.history.map(sale => `
            <div class="sale-item">
                <div class="sale-info">
                    <h4>${sale.product}</h4>
                    <p>${sale.customer || 'Sin cliente'}</p>
                    <p>IMEI: ...${sale.imei} | ${new Date(sale.date).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</p>
                </div>
                <span class="sale-price">$${parseFloat(sale.price).toFixed(2)}</span>
            </div>
        `).join('');
    }

    function triggerSuccess() {
        const feedback = document.createElement('div');
        feedback.className = 'success-feedback';
        feedback.innerText = '✅ Ticket Generado';
        document.body.appendChild(feedback);
        
        setTimeout(() => feedback.classList.add('show'), 10);
        setTimeout(() => {
            feedback.classList.remove('show');
            setTimeout(() => feedback.remove(), 500);
        }, 2000);
    }

    function playClickSound() {
        // Simple artificial tick for touch feedback
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
    }
});

// Extra style for notification
const style = document.createElement('style');
style.textContent = `
.success-feedback {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%) translateY(-100px);
    background: #4cd964;
    color: white;
    padding: 12px 24px;
    border-radius: 30px;
    font-weight: 600;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    z-index: 1000;
}
.success-feedback.show { transform: translateX(-50%) translateY(0); }
`;
document.head.appendChild(style);
