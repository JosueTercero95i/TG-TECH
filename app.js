document.addEventListener('DOMContentLoaded', () => {
    // State management
    let state = {
        saleType: 'iphone', // 'iphone' or 'concept'
        customerName: '',
        model: '',
        type: '',
        storage: '',
        conceptText: '',
        imei: '',
        price: '',
        warranty: '30',
        paymentMethod: 'Efectivo',
        currency: 'C$',
        months: '3',
        cashReceived: ''
    };

    // DOM Elements
    const customerNameInput = document.getElementById('customer-name');
    const modelButtons = document.querySelectorAll('[data-model]');
    const typeButtons = document.querySelectorAll('[data-type]');
    const storageButtons = document.querySelectorAll('[data-storage]');
    const displayProduct = document.getElementById('display-product');
    const displayTotal = document.getElementById('display-total');
    const displayChange = document.getElementById('display-change');
    const imeiInput = document.getElementById('imei-input');
    const priceInput = document.getElementById('price-input');
    const warrantyInput = document.getElementById('warranty-input');
    const paymentMethodSelect = document.getElementById('payment-method');
    const currencySelect = document.getElementById('currency-select');
    const cashInput = document.getElementById('cash-input');
    const cashInputContainer = document.getElementById('cash-input-container');
    const monthsInputContainer = document.getElementById('months-input-container');
    const monthsSelect = document.getElementById('months-select');
    const btnPrint = document.getElementById('btn-print');
    const btnPdf = document.getElementById('btn-pdf');
    const btnClear = document.getElementById('btn-clear');
    const businessNameEl = document.getElementById('business-name');

    // Tab and Concept elements
    const tabIphone = document.getElementById('tab-iphone');
    const tabConcept = document.getElementById('tab-concept');
    const iphoneSelectionGroup = document.getElementById('iphone-selection-group');
    const conceptSelectionGroup = document.getElementById('concept-selection-group');
    const conceptInput = document.getElementById('concept-input');
    const btnSuggestions = document.querySelectorAll('.btn-suggestion');
    
    // Bluetooth State
    let printerDevice = null;
    let printerCharacteristic = null;
    let logoBytes = null; // Stores processed image
    let logoDataUrl = null; // Stores logo as base64 for PDF
    const btnConnectBT = document.getElementById('btn-connect-bt');
    const statusText = btnConnectBT.querySelector('.status-text');

    // Auto-load TGTECH logo
    window.addEventListener('load', () => {
        const img = new Image();
        img.onload = () => processImage(img);
        img.src = 'TGTECH.png';
        fetch('TGTECH.png')
            .then(r => r.blob())
            .then(b => {
                const reader = new FileReader();
                reader.onloadend = () => { logoDataUrl = reader.result; };
                reader.readAsDataURL(b);
            })
            .catch(() => {});
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
        if (!navigator.bluetooth) {
            alert('Tu navegador no soporta Bluetooth Web. En iPhone, usa el navegador "Bluefy". En Android, usa Chrome.');
            return;
        }
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
            console.error(error);
            statusText.innerText = 'Conectar BT';
            if (error.name !== 'NotFoundError') {
                alert('No se pudo establecer conexión con la impresora.');
            }
        }
    });

    function onConnected() { btnConnectBT.classList.add('connected'); statusText.innerText = 'Conectado'; }
    function onDisconnected() { btnConnectBT.classList.remove('connected'); statusText.innerText = 'Conectar BT'; printerDevice = null; printerCharacteristic = null; }

    // Tab switching event listeners
    tabIphone.addEventListener('click', () => {
        if (state.saleType === 'iphone') return;
        state.saleType = 'iphone';
        
        tabIphone.classList.add('bg-white', 'text-gray-800', 'shadow-sm', 'font-normal');
        tabIphone.classList.remove('text-gray-500', 'font-light');
        tabConcept.classList.add('text-gray-500', 'font-light');
        tabConcept.classList.remove('bg-white', 'text-gray-800', 'shadow-sm', 'font-normal');
        
        iphoneSelectionGroup.classList.remove('hidden');
        conceptSelectionGroup.classList.add('hidden');
        
        playClickSound();
        updateDisplay();
        validateForm();
    });

    tabConcept.addEventListener('click', () => {
        if (state.saleType === 'concept') return;
        state.saleType = 'concept';
        
        tabConcept.classList.add('bg-white', 'text-gray-800', 'shadow-sm', 'font-normal');
        tabConcept.classList.remove('text-gray-500', 'font-light');
        tabIphone.classList.add('text-gray-500', 'font-light');
        tabIphone.classList.remove('bg-white', 'text-gray-800', 'shadow-sm', 'font-normal');
        
        iphoneSelectionGroup.classList.add('hidden');
        conceptSelectionGroup.classList.remove('hidden');
        
        playClickSound();
        updateDisplay();
        validateForm();
        conceptInput.focus();
    });

    // Concept input changes
    conceptInput.addEventListener('input', (e) => {
        state.conceptText = e.target.value;
        updateDisplay();
        validateForm();
    });

    // Suggestions click
    btnSuggestions.forEach(btn => btn.addEventListener('click', () => {
        const val = btn.dataset.suggest;
        state.conceptText = val;
        conceptInput.value = val;
        playClickSound();
        updateDisplay();
        validateForm();
    }));

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

    storageButtons.forEach(btn => btn.addEventListener('click', () => {
        storageButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.storage = btn.dataset.storage;
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
        if (state.paymentMethod.startsWith('Finan')) {
            monthsInputContainer.classList.remove('hidden');
            cashInputContainer.classList.add('hidden');
            state.cashReceived = '';
            cashInput.value = '';
            updateTotals();
        } else {
            monthsInputContainer.classList.add('hidden');
            cashInputContainer.classList.remove('hidden');
        }
        validateForm();
    });

    currencySelect.addEventListener('change', (e) => {
        state.currency = e.target.value;
        updateTotals();
        validateForm();
    });

    monthsSelect.addEventListener('change', (e) => {
        state.months = e.target.value;
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
        const isNameValid = state.customerName.trim().length > 2;
        const isPriceValid = parseFloat(state.price) > 0;
        
        let isValid = false;
        
        if (state.saleType === 'concept') {
            const isConceptValid = state.conceptText.trim().length > 1;
            const isImeiValid = state.imei === '' || state.imei.length === 4;
            isValid = isConceptValid && isNameValid && isImeiValid && isPriceValid;
        } else {
            const isModelSelected = state.model !== '';
            const isTypeSelected = state.type !== '';
            const isStorageSelected = state.storage !== '';
            const isImeiValid = state.imei.length === 4;
            isValid = isModelSelected && isTypeSelected && isStorageSelected && isNameValid && isImeiValid && isPriceValid;
        }
        
        btnPrint.disabled = !isValid;
        btnPdf.disabled = !isValid;
        
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

        // Visual feedback for concept text input
        if (state.saleType === 'concept') {
            if (state.conceptText.trim().length > 1) {
                conceptInput.classList.add('success');
                conceptInput.classList.remove('error');
            } else if (state.conceptText.length > 0) {
                conceptInput.classList.add('error');
                conceptInput.classList.remove('success');
            } else {
                conceptInput.classList.remove('error', 'success');
            }
        } else {
            conceptInput.classList.remove('error', 'success');
        }

        return isValid;
    }

    function updateTotals() {
        const total = parseFloat(state.price || 0);
        const cash = parseFloat(state.cashReceived || 0);
        displayTotal.innerText = `${state.currency}${total.toFixed(2)}`;
        const change = cash - total;
        displayChange.innerText = `${state.currency}${(change >= 0 ? change : 0).toFixed(2)}`;
        
        if (cash < total && cash > 0) {
            cashInput.classList.add('error');
        } else {
            cashInput.classList.remove('error');
        }
    }

    function updateDisplay() {
        if (state.saleType === 'concept') {
            if (state.conceptText.trim()) {
                displayProduct.innerText = state.conceptText;
                displayProduct.classList.remove('placeholder');
            } else {
                displayProduct.innerText = 'Escribe el concepto de venta';
                displayProduct.classList.add('placeholder');
            }
        } else {
            if (state.model && state.type && state.storage) {
                displayProduct.innerText = `iPhone ${state.model} ${state.type} ${state.storage}`;
                displayProduct.classList.remove('placeholder');
            } else {
                displayProduct.innerText = 'Selecciona modelo, tipo y almacenamiento';
                displayProduct.classList.add('placeholder');
            }
        }
    }

    btnClear.addEventListener('click', resetForm);

    function resetForm() {
        state.saleType = 'iphone';
        state.customerName = ''; state.model = ''; state.type = ''; state.storage = ''; state.conceptText = ''; state.imei = ''; state.price = ''; state.cashReceived = '';
        state.warranty = '30'; state.paymentMethod = 'Efectivo'; state.currency = 'C$'; state.months = '3';
        
        customerNameInput.value = '';
        conceptInput.value = '';
        modelButtons.forEach(b => b.classList.remove('active'));
        typeButtons.forEach(b => b.classList.remove('active'));
        storageButtons.forEach(b => b.classList.remove('active'));
        
        tabIphone.classList.add('bg-white', 'text-gray-800', 'shadow-sm', 'font-normal');
        tabIphone.classList.remove('text-gray-500', 'font-light');
        tabConcept.classList.add('text-gray-500', 'font-light');
        tabConcept.classList.remove('bg-white', 'text-gray-800', 'shadow-sm', 'font-normal');
        
        iphoneSelectionGroup.classList.remove('hidden');
        conceptSelectionGroup.classList.add('hidden');
        
        imeiInput.value = ''; 
        priceInput.value = ''; 
        cashInput.value = '';
        warrantyInput.value = '30';
        paymentMethodSelect.value = 'Efectivo';
        currencySelect.value = 'C$';
        monthsSelect.value = '3';
        
        monthsInputContainer.classList.add('hidden');
        cashInputContainer.classList.remove('hidden');
        
        customerNameInput.classList.remove('error', 'success');
        conceptInput.classList.remove('error', 'success');
        imeiInput.classList.remove('error', 'success');
        cashInput.classList.remove('error', 'success');

        updateTotals(); 
        updateDisplay();
        validateForm();
    }

    btnPrint.addEventListener('click', () => {
        if (!validateForm()) {
            alert('Por favor complete todos los campos obligatorios'); return;
        }
        updatePrintTemplate();
        
        if (printerCharacteristic) { 
            // Bluetooth printing is naturally async
            printToBluetooth().then(() => setTimeout(triggerSuccess, 2000));
        } else { 
            // To avoid Safari's "automated printing" block, window.print() 
            // should be called as directly as possible in the event chain.
            window.print();
            setTimeout(triggerSuccess, 2000);
        }
    });

    function updatePrintTemplate() {
        document.getElementById('p-customer').innerText = state.customerName;
        
        const pProductEl = document.getElementById('p-product');
        const pImeiEl = document.getElementById('p-imei');
        const imeiRow = pImeiEl.closest('.ticket-row');
        
        if (state.saleType === 'concept') {
            pProductEl.innerText = state.conceptText;
            if (state.imei) {
                pImeiEl.innerText = state.imei;
                if (imeiRow) imeiRow.style.display = 'flex';
            } else {
                pImeiEl.innerText = '---';
                if (imeiRow) imeiRow.style.display = 'none';
            }
        } else {
            pProductEl.innerText = `iPhone ${state.model} ${state.type} ${state.storage}`;
            pImeiEl.innerText = state.imei;
            if (imeiRow) imeiRow.style.display = 'flex';
        }
        
        document.getElementById('p-warranty').innerText = `${state.warranty} días`;
        
        let methodText = state.paymentMethod;
        if (state.paymentMethod.startsWith('Finan')) {
            methodText += ` (${state.months} Meses)`;
        }
        document.getElementById('p-method').innerText = `${methodText} (${state.currency})`;
        document.getElementById('p-total').innerText = `${state.currency}${parseFloat(state.price).toFixed(2)}`;
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
        
        if (state.saleType === 'concept') {
            data += BOLD_ON + 'CONCEPTO: ' + state.conceptText + BOLD_OFF + '\n';
            if (state.imei) {
                data += 'IMEI (ULT 4): ' + state.imei + '\n';
            }
        } else {
            data += BOLD_ON + 'PRODUCTO: ' + `iPhone ${state.model} ${state.type} ${state.storage}` + BOLD_OFF + '\n';
            data += 'IMEI (ULT 4): ' + state.imei + '\n';
        }
        
        let methodText = state.paymentMethod;
        if (state.paymentMethod.startsWith('Finan')) {
            methodText += ' (' + state.months + ' Meses)';
        }
        data += 'PAGO: ' + methodText + ' (' + state.currency + ')\n';
        data += 'GARANTIA: ' + state.warranty + ' DIAS\n';
        data += '--------------------------------\n';
        data += BOLD_ON + 'TOTAL: ' + state.currency + parseFloat(state.price).toFixed(2) + BOLD_OFF + '\n';
        if (state.cashReceived) {
            data += 'RECIBIDO: ' + state.currency + parseFloat(state.cashReceived).toFixed(2) + '\n';
            data += 'CAMBIO: ' + state.currency + (parseFloat(state.cashReceived) - parseFloat(state.price)).toFixed(2) + '\n';
        }
        data += '********************************\n\n';
        data += CENTER + BOLD_ON + 'POLITICAS DE GARANTIA\n\n' + BOLD_OFF;
        data += LEFT +
               '- Cliente: ' + state.customerName + '\n';
               
        if (state.saleType === 'concept') {
            data += '- Concepto: ' + state.conceptText + '\n';
            if (state.imei) {
                data += '- IMEI: ' + state.imei + '\n';
            }
        } else {
            data += '- Producto: iPhone ' + state.model + ' ' + state.type + ' ' + state.storage + '\n';
            data += '- IMEI: ' + state.imei + '\n';
        }
        
data += '- Garantia por ' + state.warranty + ' dias\n  por fallas de fabrica.\n' +
       '- Aplica solo con factura\n' +
       '  original firmada.\n' +
       '- No valida si esta vencida.\n' +
       '- No cubre: golpes, humedad,\n  caidas, sobrecargas o software.\n' +
       '- No cubre desgaste de puertos,\n  botones o alteraciones fisicas.\n' +
       '- Revision tecnica previa (24h).\n' +
       '- No hay cambios ni reembolsos.\n' +
       '- No se aceptan reclamos por\n  detalles esteticos.\n' +
       '- Bateria: solo si no carga 100%\n  o apaga antes de 20%.\n';

data += '\n\n\n' + CENTER + '-------------------------\nFirma del Cliente\n';

data += '\nGRACIAS POR SU COMPRA\n' + FEED + CUT;

        const bytes = encoder.encode(data);
        const CHUNK_SIZE = 100;
        for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
            await printerCharacteristic.writeValue(bytes.slice(i, i+CHUNK_SIZE));
        }
    }

    btnPdf.addEventListener('click', async () => {
        if (!validateForm()) {
            alert('Por favor complete todos los campos obligatorios'); return;
        }
        const filename = `FACTURA (${state.customerName.trim()})`;
        try {
            if (window.electronAPI) {
                const html = buildInvoiceHtml();
                const result = await window.electronAPI.generatePdf(html, filename);
                if (!result.canceled) {
                    triggerSuccess('La factura PDF se descargó correctamente.');
                }
            } else {
                downloadPdfBrowser(filename);
                triggerSuccess('La factura PDF se descargó correctamente.');
            }
        } catch (error) {
            console.error(error);
            alert('No se pudo generar la factura PDF.');
        }
    });

    function getFolio() {
        const now = new Date();
        const d = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
        let seq = parseInt(localStorage.getItem('tg_folio_seq') || '0', 10) + 1;
        localStorage.setItem('tg_folio_seq', String(seq));
        return `FAC-${d}-${String(seq).padStart(4, '0')}`;
    }

    function buildInvoiceHtml() {
        const businessName = (businessNameEl.innerText || 'TG TECH').trim();
        const productText = state.saleType === 'concept'
            ? state.conceptText
            : `iPhone ${state.model} ${state.type} ${state.storage}`;

        let methodText = state.paymentMethod;
        if (state.paymentMethod.startsWith('Finan')) {
            methodText += ` (${state.months} Meses)`;
        }

        const total = parseFloat(state.price || 0).toFixed(2);
        const hasCash = state.cashReceived && state.cashReceived !== '' && !state.paymentMethod.startsWith('Finan');
        const cash = parseFloat(state.cashReceived || 0).toFixed(2);
        const change = hasCash ? (parseFloat(cash) - parseFloat(total)).toFixed(2) : null;

        const rows = `
            <tr><td class="lbl">CLIENTE</td><td>${escapeHtml(state.customerName)}</td></tr>
            <tr><td class="lbl">PRODUCTO / CONCEPTO</td><td>${escapeHtml(productText)}</td></tr>
            <tr><td class="lbl">IMEI (ÚLT. 4)</td><td>${escapeHtml(state.imei || '---')}</td></tr>
            <tr><td class="lbl">GARANTÍA</td><td>${escapeHtml(state.warranty || '30')} días</td></tr>
            <tr><td class="lbl">MÉTODO DE PAGO</td><td>${escapeHtml(methodText)} (${escapeHtml(state.currency)})</td></tr>
        `;

        return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Factura ${businessName}</title>
<style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Inter", "Helvetica Neue", Arial, sans-serif; color: #111827; background: #fff; }
    .invoice { width: 210mm; min-height: 297mm; padding: 14mm; display: flex; flex-direction: column; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2.5px solid #111827; padding-bottom: 14px; margin-bottom: 18px; }
    .brand { display: flex; align-items: center; gap: 14px; }
    .brand img { height: 58px; width: auto; }
    .brand .name { font-size: 24px; font-weight: 700; letter-spacing: 1px; line-height: 1.1; }
    .brand .info { font-size: 11px; color: #4b5563; line-height: 1.55; }
    .doc-title { text-align: right; }
    .doc-title h1 { font-size: 30px; font-weight: 700; letter-spacing: 3px; }
    .doc-title p { font-size: 11px; color: #4b5563; margin-top: 3px; }
    .meta { display: flex; justify-content: space-between; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; margin-bottom: 18px; font-size: 12px; }
    .meta .lbl { color: #6b7280; font-size: 10px; text-transform: uppercase; letter-spacing: 1px; }
    .meta .col > div { margin-bottom: 5px; }
    .meta .col > div:last-child { margin-bottom: 0; }
    table.info { width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 13px; }
    table.info td { padding: 9px 12px; border: 1px solid #e5e7eb; vertical-align: top; }
    table.info td.lbl { background: #f9fafb; font-weight: 600; width: 38%; color: #374151; font-size: 12px; }
    .total-box { display: flex; justify-content: flex-end; align-items: center; gap: 16px; margin-bottom: 20px; }
    .total-box .t-label { font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px; }
    .total-box .t-value { background: #111827; color: #fff; padding: 13px 26px; border-radius: 10px; font-size: 22px; font-weight: 700; }
    .warranty { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 18px; font-size: 11px; line-height: 1.7; color: #374151; flex: 1; }
    .warranty h3 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px; color: #111827; }
    .signature { text-align: center; margin-top: 56px; }
    .signature .line { border-bottom: 1.5px solid #111827; width: 240px; margin: 0 auto 6px; }
    .signature p { font-size: 11px; color: #4b5563; }
    .footer { text-align: center; margin-top: 20px; font-size: 11px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 12px; }
</style>
</head>
<body>
    <div class="invoice">
        <div class="header">
            <div class="brand">
                ${logoDataUrl ? `<img src="${logoDataUrl}" alt="Logo">` : ''}
                <div>
                    <div class="name">${escapeHtml(businessName)}</div>
                    <div class="info">Tel: +505 8537-9833<br>Rotonda Cristo Rey, 2c Al Sur</div>
                </div>
            </div>
            <div class="doc-title">
                <h1>FACTURA</h1>
                <p>${escapeHtml(getFolio())}</p>
            </div>
        </div>

        <div class="meta">
            <div class="col">
                <div><span class="lbl">Fecha:&nbsp;</span>${new Date().toLocaleString()}</div>
                <div><span class="lbl">Atendido por:&nbsp;</span>${escapeHtml(businessName)}</div>
            </div>
            <div class="col">
                <div><span class="lbl">Moneda:&nbsp;</span>${escapeHtml(state.currency)}</div>
                <div><span class="lbl">Documento:&nbsp;</span>Factura Digital</div>
            </div>
        </div>

        <table class="info">
            ${rows}
        </table>

        <div class="total-box">
            <span class="t-label">Total a Pagar</span>
            <span class="t-value">${escapeHtml(state.currency)}${total}</span>
        </div>

        ${hasCash ? `<div class="total-box" style="justify-content: flex-start; margin-bottom: 10px;">
            <div style="font-size: 12px; color: #374151; line-height: 1.8;">
                Efectivo recibido: <b>${escapeHtml(state.currency)}${cash}</b><br>
                Cambio: <b>${escapeHtml(state.currency)}${change}</b>
            </div>
        </div>` : ''}

        <div class="warranty">
            <h3>Políticas de Garantía</h3>
            - Garantía por ${escapeHtml(state.warranty || '30')} días por fallas de fábrica.<br>
            - Aplica solo con factura original firmada.<br>
            - No valida si está vencida.<br>
            - No cubre: golpes, humedad, caídas, sobrecargas o software.<br>
            - No cubre desgaste de puertos, botones o alteraciones físicas.<br>
            - Revisión técnica previa (24h).<br>
            - No hay cambios ni reembolsos.<br>
            - No se aceptan reclamos por detalles estéticos.<br>
            - Batería: solo si no carga 100% o apaga antes de 20%.
        </div>

        <div class="signature">
            <div class="line"></div>
            <p>Firma del Cliente</p>
        </div>

        <div class="footer">¡Gracias por su compra! — ${escapeHtml(businessName)}</div>
    </div>
</body>
</html>`;
    }

    function downloadPdfBrowser(filename) {
        if (!window.jspdf) {
            alert('No se pudo cargar la librería de PDF.');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });

        const businessName = (businessNameEl.innerText || 'TG TECH').trim();
        const productText = state.saleType === 'concept'
            ? state.conceptText
            : `iPhone ${state.model} ${state.type} ${state.storage}`;

        let methodText = state.paymentMethod;
        if (state.paymentMethod.startsWith('Finan')) {
            methodText += ` (${state.months} Meses)`;
        }

        const totalStr = `${state.currency}${parseFloat(state.price || 0).toFixed(2)}`;
        const folioStr = getFolio();
        const dateStr = new Date().toLocaleString();

        let curY = 15;

        // Logo
        if (logoDataUrl) {
            try {
                doc.addImage(logoDataUrl, 'PNG', 15, curY, 25, 25);
            } catch (e) {
                console.error('Logo error', e);
            }
        }

        const textX = logoDataUrl ? 44 : 15;

        // Business Name & Address
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(17, 24, 39);
        doc.text(businessName, textX, curY + 7);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(75, 85, 99);
        doc.text('Tel: +505 8537-9833\nRotonda Cristo Rey, 2c Al Sur', textX, curY + 13);

        // Title & Folio
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.setTextColor(17, 24, 39);
        doc.text('FACTURA', 195, curY + 8, { align: 'right' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(75, 85, 99);
        doc.text(folioStr, 195, curY + 14, { align: 'right' });

        curY += 28;

        // Separator Line
        doc.setDrawColor(17, 24, 39);
        doc.setLineWidth(0.6);
        doc.line(15, curY, 195, curY);

        curY += 6;

        // Meta Box
        doc.setFillColor(249, 250, 251);
        doc.setDrawColor(229, 231, 235);
        doc.setLineWidth(0.3);
        doc.rect(15, curY, 180, 16, 'FD');

        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(107, 114, 128);
        doc.text('FECHA:', 19, curY + 6);
        doc.text('ATENDIDO POR:', 19, curY + 12);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(17, 24, 39);
        doc.text(dateStr, 33, curY + 6);
        doc.text(businessName, 45, curY + 12);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(107, 114, 128);
        doc.text('MONEDA:', 110, curY + 6);
        doc.text('DOCUMENTO:', 110, curY + 12);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(17, 24, 39);
        doc.text(state.currency, 128, curY + 6);
        doc.text('Factura Digital', 133, curY + 12);

        curY += 22;

        // Data Table
        const tableData = [
            ['CLIENTE', state.customerName],
            ['PRODUCTO / CONCEPTO', productText],
            ['IMEI (ÚLT. 4)', state.imei || '---'],
            ['GARANTÍA', `${state.warranty || '30'} días`],
            ['MÉTODO DE PAGO', `${methodText} (${state.currency})`]
        ];

        tableData.forEach(([label, val]) => {
            doc.setFillColor(249, 250, 251);
            doc.setDrawColor(229, 231, 235);
            doc.rect(15, curY, 60, 9, 'FD');

            doc.setFillColor(255, 255, 255);
            doc.rect(75, curY, 120, 9, 'FD');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(55, 65, 81);
            doc.text(label, 19, curY + 6);

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9.5);
            doc.setTextColor(17, 24, 39);
            doc.text(String(val), 79, curY + 6);

            curY += 9;
        });

        curY += 6;

        // Total Box
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(107, 114, 128);
        doc.text('TOTAL A PAGAR:', 120, curY + 8);

        doc.setFillColor(17, 24, 39);
        doc.rect(153, curY, 42, 12, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(13);
        doc.text(totalStr, 174, curY + 8, { align: 'center' });

        doc.setTextColor(17, 24, 39);

        curY += 18;

        // Cash / Change info
        const hasCash = state.cashReceived && state.cashReceived !== '' && !state.paymentMethod.startsWith('Finan');
        if (hasCash) {
            const cashNum = parseFloat(state.cashReceived || 0);
            const totalNum = parseFloat(state.price || 0);
            const changeNum = cashNum - totalNum;

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            doc.setTextColor(55, 65, 81);
            doc.text(`Efectivo recibido: ${state.currency}${cashNum.toFixed(2)}    |    Cambio: ${state.currency}${(changeNum >= 0 ? changeNum : 0).toFixed(2)}`, 15, curY);
            curY += 10;
        }

        // Warranty Box
        doc.setFillColor(249, 250, 251);
        doc.setDrawColor(229, 231, 235);
        doc.rect(15, curY, 180, 58, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.5);
        doc.setTextColor(17, 24, 39);
        doc.text('POLÍTICAS DE GARANTÍA', 20, curY + 7);

        const bullets = [
            `- Garantía por ${state.warranty || '30'} días por fallas de fábrica.`,
            '- Aplica solo con factura original firmada.',
            '- No válida si está vencida.',
            '- No cubre: golpes, humedad, caídas, sobrecargas o software.',
            '- No cubre desgaste de puertos, botones o alteraciones físicas.',
            '- Revisión técnica previa (24h).',
            '- No hay cambios ni reembolsos.',
            '- No se aceptan reclamos por detalles estéticos.',
            '- Batería: solo si no carga 100% o apaga antes de 20%.'
        ];

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(55, 65, 81);

        let bY = curY + 13;
        bullets.forEach(b => {
            doc.text(b, 20, bY);
            bY += 4.8;
        });

        curY += 75;

        // Signature Line
        doc.setDrawColor(17, 24, 39);
        doc.setLineWidth(0.5);
        doc.line(75, curY, 135, curY);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(75, 85, 99);
        doc.text('Firma del Cliente', 105, curY + 5, { align: 'center' });

        // Footer
        doc.setFontSize(9);
        doc.setTextColor(107, 114, 128);
        doc.text(`¡Gracias por su compra! — ${businessName}`, 105, 285, { align: 'center' });

        doc.save(filename + '.pdf');
    }

    function escapeHtml(text) {
        return String(text).replace(/[&<>"']/g, (c) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function triggerSuccess(message) {
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
                    <p class="success-msg">${message || 'El ticket ha sido procesado e impreso correctamente.'}</p>
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
