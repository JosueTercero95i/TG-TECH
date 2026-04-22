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
        cashReceived: ''
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
        
        // Ocultar loader con un pequeño retraso intencional para que sea visible
        setTimeout(() => {
            const loader = document.getElementById('loader');
            if (loader) {
                loader.style.opacity = '0';
                setTimeout(() => loader.remove(), 500);
            }
        }, 1200);
    }

    // Set Default Business Name
    if (!localStorage.getItem('iphone_business_name')) {
        businessNameEl.innerText = 'TG TECH';
        localStorage.setItem('iphone_business_name', 'TG TECH');
    } else {
        businessNameEl.innerText = localStorage.getItem('iphone_business_name');
    }

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

    function triggerSuccess() {
        const overlay = document.createElement('div');
        overlay.className = 'success-overlay';
        overlay.innerHTML = `
            <div class="success-modal">
                <div class="success-circle-container">
                    <svg class="success-svg" viewBox="0 0 100 100">
                        <circle class="success-circle-bg" cx="50" cy="50" r="45"></circle>
                        <circle class="success-circle-path" cx="50" cy="50" r="45"></circle>
                    </svg>
                    <div class="success-check">
                        <i class="fa-solid fa-check"></i>
                    </div>
                </div>
                <div class="success-content">
                    <h3 class="success-title">Venta Exitosa</h3>
                    <p class="success-msg">El ticket ha sido procesado e impreso correctamente.</p>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        
        // Trigger animations
        setTimeout(() => overlay.classList.add('show'), 10);
        
        // Auto remove after 3.5s
        setTimeout(() => {
            overlay.classList.add('hide');
            setTimeout(() => overlay.remove(), 600);
        }, 3500);
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

    // Safety fallback: Ocultar loader si algo falla tras 3 segundos
    setTimeout(() => {
        const loader = document.getElementById('loader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 500);
        }
    }, 3000);
});

// Premium Success Modal Styles
const style = document.createElement('style');
style.textContent = `
.success-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    opacity: 0;
    transition: opacity 0.4s ease;
}

.success-overlay.show { opacity: 1; }
.success-overlay.hide { opacity: 0; }

.success-modal {
    background: white;
    padding: 40px;
    border-radius: 40px;
    box-shadow: 0 30px 60px -12px rgba(0,0,0,0.15);
    text-align: center;
    transform: scale(0.8) translateY(20px);
    transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    max-width: 380px;
    width: 90%;
    border: 1px solid rgba(0,0,0,0.03);
}

.success-overlay.show .success-modal {
    transform: scale(1) translateY(0);
}

.success-circle-container {
    position: relative;
    width: 100px;
    height: 100px;
    margin: 0 auto 24px;
}

.success-svg {
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
}

.success-circle-bg {
    fill: none;
    stroke: #f3f4f6;
    stroke-width: 6;
}

.success-circle-path {
    fill: none;
    stroke: #10b981;
    stroke-width: 6;
    stroke-linecap: round;
    stroke-dasharray: 283;
    stroke-dashoffset: 283;
    transition: stroke-dashoffset 1.5s ease-in-out;
}

.success-overlay.show .success-circle-path {
    stroke-dashoffset: 0;
}

.success-check {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 40px;
    color: #10b981;
    opacity: 0;
    transform: scale(0.5);
    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.5) 1.2s;
}

.success-overlay.show .success-check {
    opacity: 1;
    transform: scale(1);
}

.success-title {
    font-size: 24px;
    font-weight: 400;
    color: #111827;
    margin-bottom: 8px;
    letter-spacing: -0.5px;
}

.success-msg {
    font-size: 15px;
    color: #6b7280;
    font-weight: 300;
    line-height: 1.5;
}

@keyframes modalPop {
    0% { transform: scale(0.8); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
}
`;
document.head.appendChild(style);
