// ¡PEGA AQUÍ EL CLIENT_ID OBTENIDO DEL NUEVO PROYECTO DE GOOGLE CLOUD!
// Debe ser exactamente el ID de cliente para "ClienteWebPrueba" de image_a0e49c.png
const CLIENT_ID = '796743494350-3urvqs06te5v0438js1c10d0eiukvp85.apps.googleusercontent.com';

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

let createEventButton;    // Botón para crear evento
let updateEventButton;    // Botón para actualizar evento
let toggleEventListButton; // Botón para mostrar/ocultar la lista de eventos

// Nuevos elementos para la lista de eventos
let eventListSection;    // Sección que contiene la lista de eventos
let eventListContainer;  // Contenedor donde se renderizarán los eventos
let eventListLoading;    // Indicador de carga para la lista de eventos

// Campos del formulario
let eventSummary;
let serviceType; // Campo para el tipo de servicio
let eventStartDate;
let eventStartTime;

/**
 * Se llama cuando la librería gapi.client ha cargado.
 * Carga el módulo 'client' y luego inicializa el cliente de la API.
 */
function gapiLoaded() {
    console.log('gapiLoaded: gapi client library loaded.');
    gapi.load('client', initializeGapiClient);
}

/**
 * Inicializa el cliente de la API de Google.
 * Carga la documentación de descubrimiento para Google Calendar API v3.
 */
async function initializeGapiClient() {
    try {
        console.log('initializeGapiClient: Initializing gapi.client...');
        await gapi.client.init({
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest'],
        });
        gapiInited = true;
        console.log('initializeGapiClient: gapi.client initialized successfully.');
        handleLibrariesLoaded(); // Llama a la función unificada de carga
    } catch (error) {
        console.error('initializeGapiClient: Error al inicializar gapi.client:', error);
        showMessage('Error al cargar la API de Google. Revisa la consola.', 'error');
    }
}

/**
 * Se llama cuando la librería Google Identity Services (GIS) ha cargado.
 * Inicializa el cliente de token OAuth 2.0.
 */
function gisLoaded() {
    console.log('gisLoaded: Google Identity Services library loaded.');
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES.join(' '),
        callback: async (resp) => {
            console.log('GIS Callback received:', resp);
            if (resp.error) {
                console.error('Error de autenticación GIS:', resp);
                // Si el error es 'popup_closed_by_user' o similar, no mostrar un mensaje de error agresivo
                if (resp.error === 'popup_closed_by_user' || resp.error === 'access_denied') {
                    showMessage('Autenticación cancelada. Puedes intentarlo de nuevo.', 'info');
                } else {
                    showMessage(`Error de autenticación: ${resp.error_description || resp.error}. Revisa la configuración de tu CLIENT_ID y Orígenes.`, 'error');
                }
                showAuthStatus('No autenticado');
            } else {
                showAuthStatus('Autenticado', true);
                showMessage('¡Conexión exitosa con Google Calendar API!', 'success');
                console.log('Token de acceso:', gapi.client.getToken().access_token);
                if (eventFormSection) {
                    eventFormSection.style.display = 'block';
                }
            }
        },
    });
    gisInited = true;
    console.log('gisLoaded: tokenClient initialized.');
    handleLibrariesLoaded(); // Llama a la función unificada de carga
}

/**
 * Función unificada para manejar la carga de ambas librerías.
 * Solo procede con la verificación de autenticación si ambas están listas.
 */
async function handleLibrariesLoaded() {
    console.log('handleLibrariesLoaded: gapiInited:', gapiInited, 'gisInited:', gisInited);
    if (gapiInited && gisInited) {
        console.log('handleLibrariesLoaded: Both GAPI and GIS are initialized. Performing initial auth check.');
        await performInitialAuthCheck();
    } else {
        console.log('handleLibrariesLoaded: Waiting for both GAPI and GIS to be initialized...');
    }
}

/**
 * Realiza la verificación de autenticación inicial, intentando la autenticación silenciosa.
 */
async function performInitialAuthCheck() {
    if (gapi.client.getToken()) {
        console.log('performInitialAuthCheck: User is already authenticated (token exists).');
        showAuthStatus('Autenticado', true);
        if (eventFormSection) {
            eventFormSection.style.display = 'block';
        }
        showMessage('Ya autenticado. Puedes crear o modificar eventos.', 'success');
    } else {
        console.log('performInitialAuthCheck: No token found, attempting silent authentication...');
        try {
            // Intenta obtener un token sin mostrar la ventana de consentimiento
            await tokenClient.requestAccessToken({ prompt: 'none' });
            // Si llega aquí, la autenticación silenciosa fue exitosa
            console.log('performInitialAuthCheck: Silent authentication successful.');
            showAuthStatus('Autenticado', true);
            showMessage('¡Conexión exitosa con Google Calendar API!', 'success');
            if (eventFormSection) {
                eventFormSection.style.display = 'block';
            }
        } catch (error) {
            // Falló la autenticación silenciosa, el usuario necesita interactuar
            console.warn('performInitialAuthCheck: Silent authentication failed, user interaction required:', error);
            showAuthStatus('Listo para autenticar');
            showMessage('Necesitas autorizar con Google para usar la aplicación.', 'info');
            if (eventFormSection) {
                eventFormSection.style.display = 'none';
            }
        }
    }
}


/**
 * Actualiza el mensaje de estado de autenticación en la interfaz.
 */
function showAuthStatus(message, isAuthenticated = false) {
    console.log('showAuthStatus:', message, 'isAuthenticated:', isAuthenticated);
    if (statusMessage) statusMessage.textContent = message;
    if (authorizeButton) authorizeButton.style.display = isAuthenticated ? 'none' : 'inline-block';
    if (signoutButton) signoutButton.style.display = isAuthenticated ? 'inline-block' : 'none';
    if (eventFormSection) eventFormSection.style.display = isAuthenticated ? 'block' : 'none';

    if (headerAuthContainer) {
        headerAuthContainer.style.display = isAuthenticated ? 'none' : 'block';
    }

    if (toggleEventListButton) {
        toggleEventListButton.style.display = isAuthenticated ? 'inline-block' : 'none';
    }
    if (eventListSection) {
        eventListSection.style.display = 'none'; // Siempre oculta la lista al cambiar estado de auth
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
    console.log('handleAuthClick: Requesting access token explicitly (prompt: consent)...');
    tokenClient.requestAccessToken({ prompt: 'consent' }); // Esto siempre mostrará la ventana de consentimiento
}

/**
 * Cierra la sesión del usuario.
 */
function handleSignoutClick() {
    console.log('handleSignoutClick: Signing out...');
    const token = gapi.client.getToken();
    if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token);
        gapi.client.setToken('');
        showAuthStatus('No autenticado');
        showMessage('Sesión cerrada.', 'success');
        showResponse(''); // Limpiar mensajes de respuesta
        console.log('handleSignoutClick: User signed out.');
    }
}

/**
 * Resetea el formulario y los botones de acción (Crear/Actualizar).
 */
function resetFormAndButtons() {
    console.log('resetFormAndButtons: Resetting form and buttons.');
    if (eventForm) eventForm.reset();
    currentEventId = null; // Limpiar el ID del evento actual
    if (createEventButton) createEventButton.style.display = 'inline-block';
    if (updateEventButton) updateEventButton.style.display = 'none';

    if (eventListSection) eventListSection.style.display = 'none'; // Asegurarse de que la lista esté oculta
}

/**
 * Carga los datos de un evento existente en el formulario.
 * Esta función es llamada por los botones de la lista.
 */
async function populateFormWithEvent(eventId) {
    console.log('populateFormWithEvent: Attempting to load event with ID:', eventId);
    if (!gapi.client.getToken()) {
        showMessage('No autenticado. Por favor, autoriza con Google.', 'error');
        console.error('populateFormWithEvent: Not authenticated.');
        return;
    }

    if (!eventId) {
        showMessage('Error: ID de evento no proporcionado.', 'error');
        console.error('populateFormWithEvent: Event ID is null or empty.');
        return;
    }

    try {
        console.log(`populateFormWithEvent: Calling gapi.client.calendar.events.get for eventId: ${eventId}`);
        const response = await gapi.client.calendar.events.get({
            'calendarId': 'primary',
            'eventId': eventId
        });

        const event = response.result;
        console.log('populateFormWithEvent: Event loaded successfully:', event);

        // Rellenar el formulario con los datos del evento
        if (eventSummary) eventSummary.value = event.summary || '';
        if (serviceType) {
            if (event.description && event.description.startsWith('Servicio: ')) {
                const service = event.description.replace('Servicio: ', '');
                if (serviceType.querySelector(`option[value="${service}"]`)) {
                    serviceType.value = service;
                } else {
                    serviceType.value = '';
                }
            } else {
                serviceType.value = '';
            }
        }

        if (event.start && (event.start.dateTime || event.start.date)) {
            const startDateTime = new Date(event.start.dateTime || event.start.date);
            if (eventStartDate) eventStartDate.value = startDateTime.toISOString().split('T')[0];
            if (eventStartTime) eventStartTime.value = startDateTime.toTimeString().substring(0, 5);
        } else {
            console.warn('populateFormWithEvent: Event start date/time not found or invalid for event:', event);
            if (eventStartDate) eventStartDate.value = '';
            if (eventStartTime) eventStartTime.value = '';
        }

        currentEventId = event.id; // Almacenar el ID del evento que se está modificando
        if (createEventButton) createEventButton.style.display = 'none';
        if (updateEventButton) updateEventButton.style.display = 'inline-block';

        showMessage(`Evento "${event.summary}" cargado para modificación.`, 'success');

        if (eventListSection) eventListSection.style.display = 'none'; // Ocultar la lista después de seleccionar uno

    } catch (error) {
        console.error('populateFormWithEvent: Error al cargar el evento:', error);
        if (error.result && error.result.error && error.result.error.message) {
            showResponse(`Error al cargar el evento: ${error.result.error.message}`, 'error');
            console.error('populateFormWithEvent: API Error details:', error.result.error);
        } else {
            showResponse('Error desconocido al cargar el evento. Revisa la consola para más detalles.', 'error');
        }
        resetFormAndButtons(); // Resetear el formulario si hay error al cargar
    }
}

/**
 * Lista los próximos eventos del calendario principal del usuario.
 */
async function listUpcomingEvents() {
    console.log('listUpcomingEvents: Attempting to list upcoming events.');
    if (!gapi.client.getToken()) {
        if (eventListContainer) eventListContainer.innerHTML = '<p>Por favor, autentícate para ver tus eventos.</p>';
        console.warn('listUpcomingEvents: Not authenticated, cannot list events.');
        return;
    }

    if (eventListLoading) eventListLoading.style.display = 'block';
    if (eventListContainer) eventListContainer.innerHTML = ''; // Limpiar lista anterior

    try {
        console.log('listUpcomingEvents: Calling gapi.client.calendar.events.list...');
        const response = await gapi.client.calendar.events.list({
            'calendarId': 'primary',
            'timeMin': (new Date()).toISOString(), // Eventos desde ahora en adelante
            'showDeleted': false,
            'singleEvents': true,
            'maxResults': 10, // Mostrar los próximos 10 eventos
            'orderBy': 'startTime'
        });

        const events = response.result.items;
        console.log('listUpcomingEvents: Events received:', events);

        if (events.length > 0) {
            events.forEach(event => {
                const when = event.start.dateTime || event.start.date;
                const eventItem = document.createElement('div');
                eventItem.className = 'event-item';
                eventItem.innerHTML = `
                    <p><strong>${event.summary || 'Sin título'}</strong></p>
                    <p>${when ? new Date(when).toLocaleString() : 'Fecha/Hora no disponible'}</p>
                    <button class="load-event-button" data-event-id="${event.id}">Cargar para Modificar</button>
                `;
                if (eventListContainer) eventListContainer.appendChild(eventItem);
            });
            // Añadir event listeners a los nuevos botones
            if (eventListContainer) {
                eventListContainer.querySelectorAll('.load-event-button').forEach(button => {
                    button.addEventListener('click', (e) => {
                        const eventId = e.target.dataset.eventId;
                        console.log('listUpcomingEvents: Load button clicked for event ID:', eventId);
                        populateFormWithEvent(eventId);
                    });
                });
            }
        } else {
            if (eventListContainer) eventListContainer.innerHTML = '<p>No hay eventos próximos.</p>';
            console.log('listUpcomingEvents: No upcoming events found.');
        }
    } catch (error) {
        console.error('listUpcomingEvents: Error al listar eventos:', error);
        if (eventListContainer) eventListContainer.innerHTML = '<p>Error al cargar eventos. Revisa la consola.</p>';
        if (error.result && error.result.error) {
            console.error('listUpcomingEvents: API Error details:', error.result.error);
        }
    } finally {
        if (eventListLoading) eventListLoading.style.display = 'none';
        console.log('listUpcomingEvents: Event listing finished.');
    }
}

/**
 * Crea o Actualiza un evento en Google Calendar.
 * El comportamiento depende de si currentEventId tiene un valor.
 */
async function submitEvent(isUpdate = false) {
    console.log('submitEvent: Attempting to submit event. Is update:', isUpdate, 'currentEventId:', currentEventId);
    try {
        if (!gapi.client.getToken()) {
            showMessage('No autenticado. Por favor, autoriza con Google para crear/modificar eventos.', 'error');
            console.error('submitEvent: Not authenticated.');
            return;
        }

        const summary = eventSummary.value;
        const selectedServiceType = serviceType.value;
        const startDate = eventStartDate.value;
        const startTime = eventStartTime.value;

        if (!summary || !startDate || !startTime || !selectedServiceType) {
            showMessage('Por favor, completa todos los campos requeridos (Título, Fecha de Inicio, Hora de Inicio, Tipo de Servicio).', 'error');
            console.warn('submitEvent: Missing required fields.');
            return;
        }

        const startDateTimeStr = `${startDate}T${startTime}`;
        const startMoment = new Date(startDateTimeStr);

        startMoment.setMinutes(startMoment.getMinutes() + 5);

        const endDate = startMoment.getFullYear() + '-' +
                        String(startMoment.getMonth() + 1).padStart(2, '0') + '-' +
                        String(startMoment.getDate()).padStart(2, '0');
        const endTime = String(startMoment.getHours()).padStart(2, '0') + ':' +
                        String(startMoment.getMinutes()).padStart(2, '0');

        const finalStartDateTime = `${startDate}T${startTime}:00`;
        const finalEndDateTime = `${endDate}T${endTime}:00`;
        const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        let eventColorId = undefined;
        if (selectedServiceType === 'FACIAL') {
            eventColorId = '3'; // Grape color ID
        }

        const event = {
            'summary': summary,
            'location': '',
            'description': `Servicio: ${selectedServiceType}`,
            'start': {
                'dateTime': finalStartDateTime,
                'timeZone': userTimeZone,
            },
            'end': {
                'dateTime': finalEndDateTime,
                'timeZone': userTimeZone,
            },
            'colorId': eventColorId
        };

        let request;
        if (isUpdate && currentEventId) {
            console.log(`submitEvent: Updating event with ID: ${currentEventId}`, event);
            request = gapi.client.calendar.events.update({
                'calendarId': 'primary',
                'eventId': currentEventId,
                'resource': event
            });
        } else {
            console.log('submitEvent: Creating new event:', event);
            request = gapi.client.calendar.events.insert({
                'calendarId': 'primary',
                'resource': event
            });
        }

        const response = await request;
        console.log(`submitEvent: API Response - Event ${isUpdate ? 'updated' : 'created'}:`, response.result);
        showResponse(`¡Evento ${isUpdate ? 'actualizado' : 'creado'} exitosamente! Revisa tu Google Calendar.`, 'success');

        resetFormAndButtons(); // Limpiar y resetear el formulario
        // listUpcomingEvents(); // No se llama automáticamente, se activa con el botón

    } catch (error) {
        console.error(`submitEvent: Error al ${isUpdate ? 'actualizar' : 'crear'} el evento:`, error);
        if (error.result && error.result.error && error.result.error.message) {
            showResponse(`Error al ${isUpdate ? 'actualizar' : 'crear'} el evento: ${error.result.error.message}`, 'error');
            console.error('submitEvent: API Error details:', error.result.error);
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
    headerAuthContainer = document.getElementById('header_auth_container');

    createEventButton = document.getElementById('create_event_button');
    updateEventButton = document.getElementById('update_event_button');
    toggleEventListButton = document.getElementById('toggle_event_list_button');

    eventListSection = document.getElementById('event_list_section');
    eventListContainer = document.getElementById('event_list_container');
    eventListLoading = document.getElementById('event_list_loading');

    // Campos del formulario
    eventSummary = document.getElementById('event_summary');
    serviceType = document.getElementById('service_type');
    eventStartDate = document.getElementById('event_start_date');
    eventStartTime = document.getElementById('event_start_time');

    // Asignar listeners a los botones
    if (authorizeButton) authorizeButton.addEventListener('click', handleAuthClick);
    if (signoutButton) signoutButton.addEventListener('click', handleSignoutClick);

    // Listener para el envío del formulario de eventos
    if (eventForm) {
        eventForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await submitEvent(currentEventId !== null);
        });
    }

    if (updateEventButton) {
        updateEventButton.addEventListener('click', async () => {
            await submitEvent(true);
        });
    }

    if (toggleEventListButton) {
        toggleEventListButton.addEventListener('click', () => {
            console.log('Toggle event list button clicked.');
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
