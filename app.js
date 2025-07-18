// ¡PEGA AQUÍ EL CLIENT_ID OBTENIDO DEL NUEVO PROYECTO DE GOOGLE CLOUD!
// Debe ser exactamente el ID de cliente para "ClienteWebPrueba" de image_a0e49c.png
const CLIENT_ID = '683592283913-l722ocdd370okpjh8ta39qeq7lc61bmk.apps.googleusercontent.com';

// Scopes de autorización para Google Calendar.
// Necesitamos permiso para MANIPULAR (insertar y actualizar) eventos.
const SCOPES = ['https://www.googleapis.com/auth/calendar.events', 'https://www.googleapis.com/auth/calendar'];

let tokenClient;
let gapiInited = false;
let gisInited = false;
let currentEventId = null; // Almacena el ID del evento cargado para modificar.

// Declarar las variables de referencia a los elementos del DOM.
// Se inicializarán dentro del listener DOMContentLoaded.
let authorizeButton;
let signoutButton;
let statusMessage;
let messageDisplay;
let responseMessage;
let eventFormSection;
let eventForm;
let authSection; // Referencia al contenedor de estado y botones
let headerAuthContainer; // Referencia al contenedor principal de header y autenticación

let eventIdToModifyInput; // Campo para el ID del evento a modificar (para entrada manual)
let loadEventButton;      // Botón para cargar el evento (para entrada manual)
let createEventButton;    // Botón para crear evento
let updateEventButton;    // Botón para actualizar evento
let toggleEventListButton; // NUEVO: Botón para mostrar/ocultar la lista de eventos

// Nuevos elementos para la lista de eventos
let eventListSection;    // Sección que contiene la lista de eventos
let eventListContainer;  // Contenedor donde se renderizarán los eventos
let eventListLoading;    // Indicador de carga para la lista de eventos

// Campos del formulario
let eventSummary;
// let eventLocation; // Eliminado: Ya no se usa
let serviceType; // Campo para el tipo de servicio
let eventStartDate;
let eventStartTime;

/**
 * Se llama cuando la librería gapi.client ha cargado.
 * Carga el módulo 'client' y luego inicializa el cliente de la API.
 */
function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

/**
 * Inicializa el cliente de la API de Google.
 * Carga la documentación de descubrimiento para Google Calendar API v3.
 */
async function initializeGapiClient() {
    try {
        await gapi.client.init({
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
        });
        gapiInited = true;
        checkAuthStatus(); // Verificar estado de autenticación al cargar
    } catch (error) {
        console.error('Error al inicializar gapi.client:', error);
        showMessage('Error al cargar la API de Google. Revisa la consola.', 'error');
    }
}

/**
 * Se llama cuando la librería Google Identity Services (GIS) ha cargado.
 * Inicializa el cliente de token OAuth 2.0.
 */
function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES.join(' '),
        callback: async (resp) => {
            if (resp.error) {
                console.error('Error de autenticación GIS:', resp);
                showMessage(`Error de autenticación: ${resp.error_description || resp.error}. Revisa la configuración de tu CLIENT_ID y Orígenes.`, 'error');
                showAuthStatus('No autenticado');
            } else {
                showAuthStatus('Autenticado', true);
                showMessage('¡Conexión exitosa con Google Calendar API!', 'success');
                console.log('Token de acceso:', gapi.client.getToken().access_token);
                // Asegúrate de que el formulario se muestre después de una nueva autenticación
                if (eventFormSection) { // Comprueba si el elemento ya fue inicializado por DOMContentLoaded
                    eventFormSection.style.display = 'block';
                }
            }
        },
    });
    gisInited = true;
    checkAuthStatus(); // Verificar estado de autenticación al cargar
}

/**
 * Verifica el estado de autenticación inicial y habilita/deshabilita los botones.
 */
function checkAuthStatus() {
    if (gapiInited && gisInited) {
        if (gapi.client.getToken()) {
            showAuthStatus('Autenticado', true);
            if (eventFormSection) { // Comprueba si el elemento ya fue inicializado
                eventFormSection.style.display = 'block';
            }
            showMessage('Ya autenticado. Puedes crear o modificar eventos.', 'success');
        } else {
            showAuthStatus('Listo para autenticar');
            if (eventFormSection) { // Comprueba si el elemento ya fue inicializado
                eventFormSection.style.display = 'none';
            }
        }
    }
}

/**
 * Actualiza el mensaje de estado de autenticación en la interfaz.
 */
function showAuthStatus(message, isAuthenticated = false) {
    if (statusMessage) statusMessage.textContent = message;
    if (authorizeButton) authorizeButton.style.display = isAuthenticated ? 'none' : 'inline-block';
    if (signoutButton) signoutButton.style.display = isAuthenticated ? 'inline-block' : 'none';
    if (eventFormSection) eventFormSection.style.display = isAuthenticated ? 'block' : 'none';

    // Controla la visibilidad de TODO el header y la sección de autenticación
    if (headerAuthContainer) {
        headerAuthContainer.style.display = isAuthenticated ? 'none' : 'block';
    }

    // Controla la visibilidad del botón para la lista de eventos
    if (toggleEventListButton) {
        toggleEventListButton.style.display = isAuthenticated ? 'inline-block' : 'none';
    }
    // Asegura que la lista de eventos esté oculta por defecto al autenticar
    if (eventListSection) {
        eventListSection.style.display = 'none';
    }
}

/**
 * Muestra un mensaje temporal en la interfaz.
 */
function showMessage(msg, type) {
    if (messageDisplay) {
        messageDisplay.textContent = msg;
        messageDisplay.className = `info-message ${type}`;
        setTimeout(() => {
            messageDisplay.textContent = '';
            messageDisplay.className = 'info-message';
        }, 5000);
    }
}

/**
 * Muestra una respuesta de la API.
 */
function showResponse(msg, type) {
    if (responseMessage) {
        responseMessage.textContent = msg;
        responseMessage.className = `info-message ${type}`;
        setTimeout(() => {
            responseMessage.textContent = '';
            responseMessage.className = 'info-message';
        }, 5000);
    }
}

/**
 * Inicia el flujo de autenticación cuando se hace clic en el botón Autorizar.
 */
function handleAuthClick() {
    tokenClient.requestAccessToken({ prompt: 'consent' });
}

/**
 * Cierra la sesión del usuario.
 */
function handleSignoutClick() {
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
        showAuthStatus('No autenticado');
        showMessage('Sesión cerrada.', 'success');
        showResponse(''); // Limpiar mensajes de respuesta
    }
}

/**
 * Resetea el formulario y los botones de acción (Crear/Actualizar).
 * También refresca la lista de eventos.
 */
function resetFormAndButtons() {
    if (eventForm) eventForm.reset();
    currentEventId = null; // Limpiar el ID del evento actual
    if (createEventButton) createEventButton.style.display = 'inline-block';
    if (updateEventButton) updateEventButton.style.display = 'none';
    if (eventIdToModifyInput) eventIdToModifyInput.value = ''; // Limpiar el campo de ID

    // Asegurarse de que la lista de eventos esté oculta después de un reset
    if (eventListSection) eventListSection.style.display = 'none';
    // listUpcomingEvents(); // Ya no se llama automáticamente aquí, se activa con el botón
}

/**
 * Carga los datos de un evento existente en el formulario.
 * Esta función es llamada por los botones de la lista.
 */
async function populateFormWithEvent(eventId) {
    if (!gapi.client.getToken()) {
        showMessage('No autenticado. Por favor, autoriza con Google.', 'error');
        return;
    }

    try {
        console.log(`Cargando evento con ID: ${eventId}`);
        const response = await gapi.client.calendar.events.get({
            'calendarId': 'primary',
            'eventId': eventId
        });

        const event = response.result;
        console.log('Evento cargado:', event);

        // Rellenar el formulario con los datos del evento
        eventSummary.value = event.summary || '';
        // Intentar rellenar el serviceType si la descripción lo contiene
        if (event.description && event.description.startsWith('Servicio: ')) {
            const service = event.description.replace('Servicio: ', '');
            if (serviceType.querySelector(`option[value="${service}"]`)) {
                serviceType.value = service;
            } else {
                serviceType.value = ''; // Si no coincide, dejar en blanco
            }
        } else {
            serviceType.value = ''; // Si no hay descripción o no tiene el formato, dejar en blanco
        }


        // Formatear fechas y horas para los campos input
        if (event.start && event.start.dateTime) {
            const startDateTime = new Date(event.start.dateTime);
            eventStartDate.value = startDateTime.toISOString().split('T')[0];
            eventStartTime.value = startDateTime.toTimeString().substring(0, 5);
        } else if (event.start && event.start.date) { // Eventos de día completo
            eventStartDate.value = event.start.date;
            eventStartTime.value = '00:00'; // Establecer hora por defecto
        }

        currentEventId = event.id; // Almacenar el ID del evento que se está modificando
        createEventButton.style.display = 'none'; // Ocultar botón de Crear
        updateEventButton.style.display = 'inline-block'; // Mostrar botón de Actualizar
        eventIdToModifyInput.value = event.id; // También setear el campo de entrada manual

        showMessage(`Evento "${event.summary}" cargado para modificación.`, 'success');

        // Ocultar la lista de eventos después de seleccionar uno
        if (eventListSection) eventListSection.style.display = 'none';

    } catch (error) {
        console.error('Error al cargar el evento:', error);
        if (error.result && error.result.error && error.result.error.message) {
            showResponse(`Error al cargar el evento: ${error.result.error.message}`, 'error');
        } else {
            showResponse('Error desconocido al cargar el evento. Revisa la consola.', 'error');
        }
        resetFormAndButtons(); // Resetear el formulario si hay error al cargar
    }
}

/**
 * Lista los próximos eventos del calendario principal del usuario.
 */
async function listUpcomingEvents() {
    if (!gapi.client.getToken()) {
        if (eventListContainer) eventListContainer.innerHTML = '<p>Por favor, autentícate para ver tus eventos.</p>';
        return;
    }

    if (eventListLoading) eventListLoading.style.display = 'block';
    if (eventListContainer) eventListContainer.innerHTML = ''; // Limpiar lista anterior

    try {
        const response = await gapi.client.calendar.events.list({
            'calendarId': 'primary',
            'timeMin': (new Date()).toISOString(), // Eventos desde ahora en adelante
            'showDeleted': false,
            'singleEvents': true,
            'maxResults': 10, // Mostrar los próximos 10 eventos
            'orderBy': 'startTime'
        });

        const events = response.result.items;
        if (events.length > 0) {
            events.forEach(event => {
                const when = event.start.dateTime || event.start.date;
                const eventItem = document.createElement('div');
                eventItem.className = 'event-item';
                eventItem.innerHTML = `
                    <p><strong>${event.summary}</strong></p>
                    <p>${new Date(when).toLocaleString()}</p>
                    <button class="load-event-button" data-event-id="${event.id}">Cargar para Modificar</button>
                `;
                if (eventListContainer) eventListContainer.appendChild(eventItem);
            });
            // Añadir event listeners a los nuevos botones
            if (eventListContainer) {
                eventListContainer.querySelectorAll('.load-event-button').forEach(button => {
                    button.addEventListener('click', (e) => {
                        const eventId = e.target.dataset.eventId;
                        populateFormWithEvent(eventId);
                    });
                });
            }
        } else {
            if (eventListContainer) eventListContainer.innerHTML = '<p>No hay eventos próximos.</p>';
        }
    } catch (error) {
        console.error('Error al listar eventos:', error);
        if (eventListContainer) eventListContainer.innerHTML = '<p>Error al cargar eventos. Revisa la consola.</p>';
    } finally {
        if (eventListLoading) eventListLoading.style.display = 'none';
    }
}


/**
 * Crea o Actualiza un evento en Google Calendar.
 * El comportamiento depende de si currentEventId tiene un valor.
 */
async function submitEvent(isUpdate = false) {
    try {
        if (!gapi.client.getToken()) {
            showMessage('No autenticado. Por favor, autoriza con Google para crear/modificar eventos.', 'error');
            return;
        }

        const summary = eventSummary.value;
        // const location = eventLocation.value; // Eliminado: Ya no se usa
        const selectedServiceType = serviceType.value; // Obtener el valor del tipo de servicio
        const startDate = eventStartDate.value;
        const startTime = eventStartTime.value;

        // Validación básica de campos requeridos
        if (!summary || !startDate || !startTime || !selectedServiceType) {
            showMessage('Por favor, completa todos los campos requeridos (Título, Fecha de Inicio, Hora de Inicio, Tipo de Servicio).', 'error');
            return;
        }

        // Calcular la fecha y hora de fin automáticamente
        const startDateTimeStr = `${startDate}T${startTime}`; // Formato "YYYY-MM-DDTHH:mm"
        const startMoment = new Date(startDateTimeStr); // Crear un objeto Date para manipular la hora

        // Aumentar 5 minutos para la hora de fin
        startMoment.setMinutes(startMoment.getMinutes() + 5);

        // Formatear la fecha y hora de fin
        const endDate = startMoment.getFullYear() + '-' +
                        String(startMoment.getMonth() + 1).padStart(2, '0') + '-' +
                        String(startMoment.getDate()).padStart(2, '0');
        const endTime = String(startMoment.getHours()).padStart(2, '0') + ':' +
                        String(startMoment.getMinutes()).padStart(2, '0');

        // Construir los objetos de fecha y hora ISO 8601
        const finalStartDateTime = `${startDate}T${startTime}:00`;
        const finalEndDateTime = `${endDate}T${endTime}:00`; // Usar la hora y fecha calculadas
        const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        // Determinar el color del evento según el tipo de servicio
        let eventColorId = undefined; // Por defecto, sin color específico (color predeterminado de Google Calendar)
        if (selectedServiceType === 'FACIAL') {
            eventColorId = '3'; // ID para el color "Grape" (Uva) en Google Calendar
        }
        // Si es 'PESTAÑAS', eventColorId se mantiene como undefined, usando el color predeterminado.

        const event = {
            'summary': summary,
            'location': '', // Se deja vacío ya que el campo fue eliminado
            'description': `Servicio: ${selectedServiceType}`, // Puedes personalizar la descripción
            'start': {
                'dateTime': finalStartDateTime,
                'timeZone': userTimeZone,
            },
            'end': {
                'dateTime': finalEndDateTime, // Usar la fecha y hora de fin calculadas
                'timeZone': userTimeZone,
            },
            'colorId': eventColorId // Añadir la propiedad colorId al evento
        };

        let request;
        if (isUpdate && currentEventId) {
            console.log(`Actualizando evento con ID: ${currentEventId}`, event);
            request = gapi.client.calendar.events.update({
                'calendarId': 'primary',
                'eventId': currentEventId,
                'resource': event
            });
        } else {
            console.log('Creando nuevo evento:', event);
            request = gapi.client.calendar.events.insert({
                'calendarId': 'primary',
                'resource': event
            });
        }

        const response = await request;
        console.log(`Respuesta de la API - Evento ${isUpdate ? 'actualizado' : 'creado'}:`, response.result);
        showResponse(`¡Evento ${isUpdate ? 'actualizado' : 'creado'} exitosamente! Revisa tu Google Calendar.`, 'success');

        resetFormAndButtons(); // Limpiar y resetear el formulario después del éxito
        // listUpcomingEvents(); // Ya no se llama automáticamente aquí, se activa con el botón

    } catch (error) {
        console.error(`Error al ${isUpdate ? 'actualizar' : 'crear'} el evento:`, error);
        if (error.result && error.result.error && error.result.error.message) {
            showResponse(`Error al ${isUpdate ? 'actualizar' : 'crear'} el evento: ${error.result.error.message}`, 'error');
        } else {
            showResponse(`Error desconocido al ${isUpdate ? 'actualizar' : 'crear'} el evento. Revisa la consola para más detalles.`, 'error');
        }
    }
}


// ========================================================================
// IMPORTANTE: Envuelve todo el código que interactúa con el DOM en DOMContentLoaded
// ========================================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM completamente cargado y parseado. Inicializando elementos y listeners.');

    // Inicializar las variables de referencia a los elementos del DOM
    authorizeButton = document.getElementById('authorize_button');
    signoutButton = document.getElementById('signout_button');
    statusMessage = document.getElementById('status-message');
    messageDisplay = document.getElementById('message');
    responseMessage = document.getElementById('response_message');
    eventFormSection = document.getElementById('event_form_section');
    eventForm = document.getElementById('event_form');
    authSection = document.getElementById('auth_section');
    headerAuthContainer = document.getElementById('header_auth_container'); // Inicialización del contenedor principal

    // Elementos para la modificación (entrada manual de ID)
    eventIdToModifyInput = document.getElementById('event_id_to_modify');
    loadEventButton = document.getElementById('load_event_button');
    createEventButton = document.getElementById('create_event_button');
    updateEventButton = document.getElementById('update_event_button');
    toggleEventListButton = document.getElementById('toggle_event_list_button'); // NUEVO: Inicializar el botón de la lista

    // Nuevos elementos para la lista de eventos
    eventListSection = document.getElementById('event_list_section');
    eventListContainer = document.getElementById('event_list_container');
    eventListLoading = document.getElementById('event_list_loading');


    // Campos del formulario
    eventSummary = document.getElementById('event_summary');
    // eventLocation = document.getElementById('event_location'); // Eliminado: Ya no se inicializa
    serviceType = document.getElementById('service_type'); // Inicializar el campo de tipo de servicio
    eventStartDate = document.getElementById('event_start_date');
    eventStartTime = document.getElementById('event_start_time');

    // Asignar listeners a los botones
    if (authorizeButton) authorizeButton.addEventListener('click', handleAuthClick);
    if (signoutButton) signoutButton.addEventListener('click', handleSignoutClick);

    // Listener para el botón de cargar evento (entrada manual de ID)
    if (loadEventButton) loadEventButton.addEventListener('click', populateFormWithEvent);

    // Listener para el envío del formulario de eventos
    if (eventForm) {
        eventForm.addEventListener('submit', async (e) => {
            e.preventDefault(); // Prevenir el envío por defecto del formulario

            // Determinar si es una creación o actualización
            await submitEvent(currentEventId !== null);
        });
    }

    // Listener para el botón de actualizar (que es un botón "type=button" no submit)
    if (updateEventButton) {
        updateEventButton.addEventListener('click', async () => {
            await submitEvent(true); // Siempre es una actualización cuando se hace clic aquí
        });
    }

    // NUEVO: Listener para el botón de mostrar/ocultar la lista de eventos
    if (toggleEventListButton) {
        toggleEventListButton.addEventListener('click', () => {
            if (eventListSection) {
                if (eventListSection.style.display === 'none' || eventListSection.style.display === '') {
                    eventListSection.style.display = 'block';
                    listUpcomingEvents(); // Cargar eventos solo cuando se muestra la lista
                } else {
                    eventListSection.style.display = 'none';
                }
            }
        });
    }

    // Al cargar el DOM, verifica el estado de autenticación inicial
    checkAuthStatus();
});
