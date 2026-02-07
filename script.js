let ticketsActivos = JSON.parse(localStorage.getItem('cochera_activos')) || [];
let historialVentas = JSON.parse(localStorage.getItem('cochera_ventas')) || [];
let correlativo = parseInt(localStorage.getItem('cochera_correlativo')) || 1;

const TARIFAS = {
    '2_espacios': 8,
    'auto': 4,
    'moto': 2,
    'moto_electrica': 2,
    'bicicleta': 2
};

const COSTO_NOCHE = {
    '2_espacios': 15,
    'auto': 10,
    'moto': 5,
    'moto_electrica': 5,
    'bicicleta': 5
};

const TOLERANCIA_MIN = 6;
const PASSWORD_ADMIN = "admin";

function registrarIngreso() {
    const placaInput = document.getElementById('placa');
    const placa = placaInput.value.trim().toUpperCase();
    const tipo = document.getElementById('tipo').value;
    if (!placa) return alert("❌ Ingrese una placa o descripción");

    const tkt = {
        id: correlativo++,
        placa: placa,
        tipo: tipo,
        entrada: new Date().getTime()
    };
    ticketsActivos.push(tkt);
    save();
    imprimirTicket(tkt, 'ENTRADA');
    placaInput.value = "";
    render();
}

function calcular(entradaMs, tipo) {
    const ahora = new Date();
    const entrada = new Date(entradaMs);
    const minTotales = Math.floor((ahora - entrada) / 60000);

    if (minTotales < TOLERANCIA_MIN) {
        return { monto: 0, horas: 0, nocheMonto: 0, montoBase: 0, salida: ahora.getTime() };
    }

    const precioHora = TARIFAS[tipo] || 2;
    const precioNoche = COSTO_NOCHE[tipo] || 10;
    
    let montoTotal = 0;
    let montoHoras = 0;
    let montoNoche = 0;
    let horasACobrar = 0;

    // CONFIGURACIÓN COCHERA PUNO: 8 AM a 12 AM
    const HORA_INICIO_NOCHE = 0; // 12:00 AM
    const HORA_FIN_NOCHE = 8;    // 8:00 AM

    let puntero = new Date(entradaMs);

    while (puntero < ahora) {
        let h = puntero.getHours();

        // RANGO NOCHE: 12 AM a 8 AM
        if (h >= HORA_INICIO_NOCHE && h < HORA_FIN_NOCHE) {
            montoNoche = precioNoche;
            puntero.setHours(HORA_FIN_NOCHE, 0, 0, 0);
            if (puntero <= new Date(entradaMs)) {
                puntero.setDate(puntero.getDate() + 1);
            }
        } else {
            // RANGO DÍA: 8 AM a 12 AM
            let inicioHora = new Date(puntero);
            puntero.setHours(puntero.getHours() + 1);
            
            let finDeEsteBloque = puntero > ahora ? ahora : puntero;
            let minEnEsteBloque = Math.floor((finDeEsteBloque - inicioHora) / 60000);

            if (minEnEsteBloque >= TOLERANCIA_MIN || puntero <= ahora) {
                montoHoras += precioHora;
                horasACobrar++;
            }
        }
    }

    montoTotal = montoHoras + montoNoche;

    return { 
        monto: montoTotal, 
        horas: horasACobrar, 
        nocheMonto: montoNoche, 
        montoBase: montoHoras,
        salida: ahora.getTime()
    };
}

let tktActual = null;
function abrirCobro(id) {
    tktActual = ticketsActivos.find(t => t.id === id);
    const res = calcular(tktActual.entrada, tktActual.tipo);
    
    document.getElementById('montoTotal').innerText = res.monto.toFixed(2);
    
    let htmlDetalle = `
        <div class="flex flex-col text-blue-600"><span>Unidad:</span> <b class="text-lg leading-tight uppercase">${tktActual.placa}</b></div>
        <div class="flex justify-between mt-2 pt-2 border-t text-xs"><span>Horas Diurnas:</span> <span>S/ ${res.montoBase.toFixed(2)}</span></div>
    `;

    if (res.nocheMonto > 0) {
        htmlDetalle += `
            <div class="flex justify-between text-orange-600 font-bold text-xs">
                <span>Tarifa Noche (12AM-8AM):</span> <span>S/ ${res.nocheMonto.toFixed(2)}</span>
            </div>
        `;
    }
    
    document.getElementById('detalleSalida').innerHTML = htmlDetalle;
    document.getElementById('modalSalida').classList.remove('hidden');
}

function finalizarPago() {
    const res = calcular(tktActual.entrada, tktActual.tipo);
    const venta = {
        ...tktActual,
        salida: res.salida,
        monto: res.monto,
        obs: document.getElementById('observaciones').value,
        fecha: new Date().toLocaleDateString()
    };
    historialVentas.push(venta);
    ticketsActivos = ticketsActivos.filter(t => t.id !== tktActual.id);
    save();
    imprimirTicket(venta, 'SALIDA');
    cerrarModal();
    render();
}

function imprimirTicket(t, modo) {
    const area = document.getElementById('areaImpresion');
    const esSalida = modo === 'SALIDA';
    let detallePrecios = '';
    
    if (esSalida) {
        const res = calcular(t.entrada, t.tipo);
        detallePrecios = `
            HORAS DÍA: S/ ${res.montoBase.toFixed(2)}<br>
            ${res.nocheMonto > 0 ? `TARIFA NOCHE: S/ ${res.nocheMonto.toFixed(2)}<br>` : ''}
            <span style="font-size:16pt;">TOTAL: S/ ${t.monto.toFixed(2)}</span><br>
        `;
    }

    area.innerHTML = `
        <div style="text-align:center; font-weight:bold;">
            <span style="font-size:14pt;">COCHERA PUNO</span><br>
            <span style="font-size:10pt;">TICKET DE ${modo}</span><br>
            <div class="divider"></div>
            <span style="font-size:22pt; display:block; margin:5px 0;">${t.placa}</span>
            <span style="font-size:12pt;">#${t.id}</span>
        </div>
        <div class="divider"></div>
        <div style="font-size:10pt; font-weight:bold;">
            INGRESO: ${new Date(t.entrada).toLocaleString()}<br>
            ${esSalida ? `SALIDA : ${new Date(t.salida).toLocaleString()}<br>` : ''}
            TIPO: ${t.tipo.toUpperCase().replace('_', ' ')}<br>
            ${detallePrecios}
        </div>
        <div style="text-align:center; font-weight:bold;">
            <div class="divider"></div>
            HORARIO: 8:00 AM - 12:00 AM<br>
            ¡MUCHAS GRACIAS!
            <div class="cut-space"></div>
        </div>
    `;
    setTimeout(() => { window.print(); }, 500);
}

function exportarExcel() {
    const pass = prompt("🔐 Contraseña Admin:");
    if (pass !== PASSWORD_ADMIN) return alert("❌ Incorrecta");
    const data = historialVentas.map(v => ({
        "TKT": v.id, "Descripción": v.placa, "Monto S/": v.monto, "Fecha": v.fecha, "Observaciones": v.obs
    }));
    const total = historialVentas.reduce((s, v) => s + v.monto, 0);
    data.push({}, { "Fecha": "TOTAL RECAUDADO:", "Monto S/": total });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    XLSX.writeFile(wb, "Reporte_Cochera_Puno.xlsx");
}

function limpiarHistorial() {
    const pass = prompt("🔐 Contraseña para REINICIAR:");
    if (pass !== PASSWORD_ADMIN) return alert("❌ Incorrecta");
    if (confirm("¿Borrar todo el historial?")) {
        historialVentas = [];
        save();
        render();
    }
}

function anularTicket(id) {
    if (confirm("¿Anular este ticket?")) {
        ticketsActivos = ticketsActivos.filter(t => t.id !== id);
        save();
        render();
    }
}

function save() {
    localStorage.setItem('cochera_activos', JSON.stringify(ticketsActivos));
    localStorage.setItem('cochera_ventas', JSON.stringify(historialVentas));
    localStorage.setItem('cochera_correlativo', correlativo);
}

function cerrarModal() {
    document.getElementById('modalSalida').classList.add('hidden');
    document.getElementById('observaciones').value = "";
}

function render() {
    const tabla = document.getElementById('listaTickets');
    const totalHoy = historialVentas.reduce((s, v) => s + v.monto, 0);
    document.getElementById('totalAcumulado').innerText = `S/ ${totalHoy.toFixed(2)}`;
    document.getElementById('contador').innerText = ticketsActivos.length;
    
    tabla.innerHTML = ticketsActivos.map(t => `
        <tr class="border-b">
            <td class="px-6 py-4 text-center text-xs text-slate-400">#${t.id}</td>
            <td class="px-6 py-4 font-bold uppercase text-slate-700">${t.placa}</td>
            <td class="px-6 py-4 text-xs text-slate-500">${new Date(t.entrada).toLocaleTimeString()}</td>
            <td class="px-6 py-4 text-right">
                <button onclick="abrirCobro(${t.id})" class="text-emerald-500 font-black mr-4 text-sm">COBRAR</button>
                <button onclick="anularTicket(${t.id})" class="text-red-400 font-bold text-[10px]">ANULAR</button>
            </td>
        </tr>
    `).reverse().join('');
}
render();