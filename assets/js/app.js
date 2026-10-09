// ============================================================
// Monitor ISP — lógica del dashboard
// Depende de config.js (credenciales) y de la librería
// supabase-js, ambas cargadas antes que este archivo.
// ============================================================

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const UMBRAL_INESTABILIDAD = 3;   // mínimo de cambios de estado en 24h para considerarse "inestable"
const UMBRAL_CORTE_PON = 2;       // mínimo de clientes caídos a la vez en el mismo PON para marcarlo como corte
const INTERVALO_REFRESCO = 30000; // milisegundos entre refrescos automáticos

let chartInstance = null;
let intervaloActivo = null;

let ultimoDataset = [];
let filtroEstado = null;  // null = sin filtro; 'conectado' | 'desconectado' | 'suspendido'
let filtroZona = '';      // '' = todas las zonas


function claseEstado(estado) {
    if (estado === "conectado") return "estado-conectado";
    if (estado === "suspendido") return "estado-suspendido";
    return "estado-desconectado";
}


// ---------- Autenticación ----------

async function iniciarSesion() {
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    document.getElementById('login-error').innerText = error ? error.message : '';
}

async function cerrarSesion() {
    await supabaseClient.auth.signOut();
}


// ---------- Panel principal: gráfica + tabla de detalle ----------

async function cargarDatos() {
    try {
        const { data, error } = await supabaseClient
            .from('estados_actuales')
            .select('cliente_id,estado,session_uptime,updated_at,clientes(nombre,pppoe_user,zona,pon)');

        if (error) { console.error('Error cargando datos:', error); return; }

        ultimoDataset = data;

        const conectados = data.filter(d => d.estado === "conectado").length;
        const desconectados = data.filter(d => d.estado === "desconectado").length;
        const suspendidos = data.filter(d => d.estado === "suspendido").length;

        const ctx = document.getElementById('grafico').getContext('2d');
        if (chartInstance) chartInstance.destroy();
        chartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Conectados', 'Desconectados', 'Suspendidos'],
                datasets: [{
                    data: [conectados, desconectados, suspendidos],
                    backgroundColor: ['#34d399', '#f87171', '#9ca3af']
                }]
            },
            options: {
                onClick: (evt, elements) => {
                    if (elements.length === 0) return;
                    const estados = ['conectado', 'desconectado', 'suspendido'];
                    const clicado = estados[elements[0].index];
                    filtroEstado = (filtroEstado === clicado) ? null : clicado;  // volver a tocar quita el filtro
                    renderizarTabla();
                }
            }
        });

        actualizarOpcionesZona(data);
        renderizarTabla();
    } catch (e) {
        console.error('Error cargando datos:', e);
    }
}

function actualizarOpcionesZona(data) {
    const select = document.getElementById('filtro-zona');
    const seleccionActual = select.value;
    const zonas = [...new Set(data.map(d => d.clientes.zona).filter(Boolean))].sort();

    select.innerHTML = '<option value="">Todas las zonas</option>' +
        zonas.map(z => `<option value="${z}">${z}</option>`).join('');
    select.value = seleccionActual;  // conserva la selección al refrescar
}

function aplicarFiltros() {
    filtroZona = document.getElementById('filtro-zona').value;
    renderizarTabla();
}

function quitarFiltroEstado() {
    filtroEstado = null;
    renderizarTabla();
}

function renderizarTabla() {
    let datos = ultimoDataset;
    if (filtroEstado) datos = datos.filter(d => d.estado === filtroEstado);
    if (filtroZona) datos = datos.filter(d => d.clientes.zona === filtroZona);

    const etiqueta = document.getElementById('filtro-activo');
    etiqueta.innerHTML = filtroEstado
        ? `Filtrando: <strong>${filtroEstado}</strong> · <a href="#" onclick="quitarFiltroEstado(); return false;" class="text-blue-600 underline">quitar</a>`
        : '';

    const lista = document.getElementById('lista-clientes');
    lista.innerHTML = `
        <table class="w-full text-sm">
            <thead>
                <tr class="bg-gray-200">
                    <th class="p-2 text-left">Cliente</th>
                    <th class="p-2 text-left">Usuario PPPoE</th>
                    <th class="p-2 text-left">Zona / PON</th>
                    <th class="p-2 text-left">Estado</th>
                    <th class="p-2 text-left">Tiempo de sesión</th>
                    <th class="p-2 text-left">Última actualización</th>
                </tr>
            </thead>
            <tbody>
                ${datos.map(d => `
                    <tr class="border-b">
                        <td class="p-2">${d.clientes.nombre}</td>
                        <td class="p-2">${d.clientes.pppoe_user}</td>
                        <td class="p-2">${d.clientes.zona ? (d.clientes.zona + ' / ' + (d.clientes.pon || '-')) : '-'}</td>
                        <td class="p-2">
                            <span class="estado-dot ${claseEstado(d.estado)}"></span>
                            ${d.estado}
                        </td>
                        <td class="p-2">${d.session_uptime || '-'}</td>
                        <td class="p-2">${new Date(d.updated_at).toLocaleString()}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        ${datos.length === 0 ? '<p class="text-sm text-gray-500 mt-2">Sin clientes que coincidan con el filtro.</p>' : ''}
    `;
}


// ---------- Formulario de alta ----------

function toggleFormularioAlta() {
    document.getElementById('form-alta').classList.toggle('hidden');
    document.getElementById('alta-mensaje').innerText = '';
}

async function darDeAltaCliente() {
    const nombre = document.getElementById('alta-nombre').value.trim();
    const pppoeUser = document.getElementById('alta-pppoe').value.trim();
    const zona = document.getElementById('alta-zona').value.trim();
    const pon = document.getElementById('alta-pon').value.trim();
    const lat = document.getElementById('alta-lat').value.trim();
    const lng = document.getElementById('alta-lng').value.trim();
    const mensaje = document.getElementById('alta-mensaje');

    if (!nombre || !pppoeUser) {
        mensaje.className = 'text-sm mt-2 text-red-600';
        mensaje.innerText = 'Nombre y usuario PPPoE son obligatorios.';
        return;
    }

    const { error } = await supabaseClient.from('clientes').insert({
        nombre: nombre,
        pppoe_user: pppoeUser,
        zona: zona || null,
        pon: pon || null,
        lat: lat ? parseFloat(lat) : null,
        lng: lng ? parseFloat(lng) : null
    });

    if (error) {
        mensaje.className = 'text-sm mt-2 text-red-600';
        if (error.code === '23505') {  // violación de UNIQUE
            mensaje.innerText = 'Ya existe un cliente con ese usuario PPPoE.';
        } else {
            mensaje.innerText = 'Error al guardar: ' + error.message;
        }
        return;
    }

    mensaje.className = 'text-sm mt-2 text-green-600';
    mensaje.innerText = 'Cliente registrado correctamente.';
    ['alta-nombre', 'alta-pppoe', 'alta-zona', 'alta-pon', 'alta-lat', 'alta-lng']
        .forEach(id => document.getElementById(id).value = '');

    cargarDatos();  // refresca la gráfica y la tabla con el nuevo cliente
}


// ---------- Detección de clientes con conexión inestable ----------

async function cargarInestables() {
    try {
        const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabaseClient
            .from('eventos')
            .select('cliente_id, clientes(nombre, pppoe_user)')
            .gte('timestamp', desde);

        if (error) { console.error('Error cargando inestables:', error); return; }

        const conteo = {};
        data.forEach(ev => {
            const id = ev.cliente_id;
            if (!conteo[id]) {
                conteo[id] = { nombre: ev.clientes.nombre, pppoe: ev.clientes.pppoe_user, cambios: 0 };
            }
            conteo[id].cambios++;
        });

        const inestables = Object.values(conteo)
            .filter(c => c.cambios >= UMBRAL_INESTABILIDAD)
            .sort((a, b) => b.cambios - a.cambios);

        const cont = document.getElementById('lista-inestables');
        if (inestables.length === 0) {
            cont.innerHTML = '<p class="text-sm text-gray-500">Sin clientes inestables detectados en las últimas 24h.</p>';
            return;
        }
        cont.innerHTML = `
            <table class="w-full text-sm">
                <thead>
                    <tr class="bg-gray-200">
                        <th class="p-2 text-left">Cliente</th>
                        <th class="p-2 text-left">Usuario PPPoE</th>
                        <th class="p-2 text-left">Cambios de estado (24h)</th>
                    </tr>
                </thead>
                <tbody>
                    ${inestables.map(c => `
                        <tr class="border-b">
                            <td class="p-2">${c.nombre}</td>
                            <td class="p-2">${c.pppoe}</td>
                            <td class="p-2 font-semibold text-orange-600">${c.cambios}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    } catch (e) {
        console.error('Error cargando inestables:', e);
    }
}


// ---------- Detección de corte masivo por zona/PON ----------

async function cargarCortesPorPON() {
    try {
        const { data, error } = await supabaseClient
            .from('estados_actuales')
            .select('estado, clientes(nombre, pppoe_user, zona, pon)');

        if (error) { console.error('Error cargando cortes por PON:', error); return; }

        const grupos = {};
        data.forEach(d => {
            const zona = d.clientes.zona;
            const pon = d.clientes.pon;
            if (!zona || !pon) return;  // clientes sin zona/pon asignado se ignoran en esta detección

            const clave = `${zona} — PON ${pon}`;
            if (!grupos[clave]) grupos[clave] = { total: 0, caidos: [] };
            grupos[clave].total++;
            if (d.estado === 'desconectado') {
                grupos[clave].caidos.push(`${d.clientes.nombre} (${d.clientes.pppoe_user})`);
            }
        });

        const alertas = Object.entries(grupos)
            .filter(([_, g]) => g.caidos.length >= UMBRAL_CORTE_PON);

        const cont = document.getElementById('lista-cortes-pon');
        if (alertas.length === 0) {
            cont.innerHTML = '<p class="text-sm text-gray-500">Sin patrones de corte masivo detectados en este momento.</p>';
            return;
        }
        cont.innerHTML = alertas.map(([clave, g]) => `
            <div class="alerta-corte">
                <p class="font-semibold text-red-700">🔴 Posible corte de fibra — ${clave}</p>
                <p class="text-sm text-gray-700">${g.caidos.length} de ${g.total} clientes caídos: ${g.caidos.join(', ')}</p>
            </div>
        `).join('');
    } catch (e) {
        console.error('Error cargando cortes por PON:', e);
    }
}


// ---------- Ciclo de vida de la sesión ----------

function refrescarTodo() {
    cargarDatos();
    cargarInestables();
    cargarCortesPorPON();
}

supabaseClient.auth.onAuthStateChange((_event, session) => {
    const haySesion = !!session;
    document.getElementById('login-box').classList.toggle('hidden', haySesion);
    document.getElementById('dashboard').classList.toggle('hidden', !haySesion);

    if (haySesion && !intervaloActivo) {
        refrescarTodo();
        intervaloActivo = setInterval(refrescarTodo, INTERVALO_REFRESCO);
    } else if (!haySesion && intervaloActivo) {
        clearInterval(intervaloActivo);
        intervaloActivo = null;
    }
});

// ---------- PWA: aviso sin conexión + service worker ----------

function actualizarAvisoConexion() {
    document.getElementById('aviso-offline').classList.toggle('hidden', navigator.onLine);
}

window.addEventListener('online', () => {
    actualizarAvisoConexion();
    if (intervaloActivo) refrescarTodo();  // al volver el internet, refresca de inmediato
});
window.addEventListener('offline', actualizarAvisoConexion);
actualizarAvisoConexion();

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .catch(err => console.error('No se pudo registrar el service worker:', err));
    });
}
