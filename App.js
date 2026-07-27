import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Vibration,
  Alert, ScrollView, Modal, Animated, Easing, Image,
  TextInput, KeyboardAvoidingView, Platform, Share, PanResponder, Linking,
  ActivityIndicator
} from 'react-native';
import { Accelerometer } from 'expo-sensors';
import * as LocalAuthentication from 'expo-local-authentication';
import { Audio } from 'expo-av';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Slider from '@react-native-community/slider';
import * as Notifications from 'expo-notifications';
import * as Sharing from 'expo-sharing';
import * as Contacts from 'expo-contacts';
import * as Speech from 'expo-speech';
import * as Localization from 'expo-localization';

const SUPABASE_URL = 'https://fbhuswayipxafsvbvasz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_nmeJNjoW4VbQKchifKnEWQ_iUqAhz9B';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Les identifiants EmailJS (service_id, template_id, clés) ne vivent plus ici :
// l'envoi passe par la Supabase Edge Function `send-alert-email`, qui les
// garde côté serveur pour ne plus les exposer dans le bundle de l'app.

const SIRENS = [
  { id: 1, file: require('./assets/sounds/siren-piezo.wav') },
  { id: 2, file: require('./assets/sounds/siren-warning-loop.wav') },
  { id: 3, file: require('./assets/sounds/siren-facility.wav') },
  { id: 4, file: require('./assets/sounds/siren-reverb.wav') },
  { id: 5, file: require('./assets/sounds/siren-firetruck.wav') },
  { id: 6, file: require('./assets/sounds/siren-police.wav') },
  { id: 7, file: require('./assets/sounds/siren-police-us.wav') },
  { id: 8, file: require('./assets/sounds/siren-burglary.wav') },
  { id: 9, file: require('./assets/sounds/siren-scifi.wav') },
  { id: 10, file: require('./assets/sounds/siren-signal.wav') },
  { id: 11, file: require('./assets/sounds/siren-club.wav') },
  { id: 12, file: require('./assets/sounds/siren-police-ops.wav') },
];

// ─── Langues & traductions ─────────────────────────────────────────────────
const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'pt', label: 'Português', flag: '🇵🇹' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'nl', label: 'Nederlands', flag: '🇳🇱' },
];

const SPEECH_LOCALES = { en: 'en-US', pt: 'pt-PT', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', nl: 'nl-NL' };

// Voix retenues pour le message dissuasif, par langue. Certains noms (ex. "Eddy")
// existent sur plusieurs langues à la fois : on les distingue via le préfixe de
// langue de la voix (v.language), jamais par le nom seul.
const DETERRENT_VOICE_NAMES = {
  en: ['Karen', 'Moira', 'Samantha', 'Zarvox'],
  pt: ['Joana', 'Luciana'],
  es: ['Monica', 'Paulina', 'Eddy'],
  fr: ['Amélie', 'Thomas'],
  de: ['Anna', 'Eddy'],
  nl: ['Ellen', 'Xander'],
};

const normalizeVoiceName = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const TRANSLATIONS = {
  en: {
    activateLabel: 'Slide to ACTIVATE',
    disarmLabel: 'Slide to DISARM',
    authWelcomeTitle: 'Welcome to BeachGuard',
    authWelcomeSubtitle: 'Enter your phone number to continue',
    phonePlaceholder: 'Phone number (e.g. +32...)',
    sendCodeBtn: 'Send code',
    authCodeSubtitle: 'Enter the code sent to',
    codePlaceholder: '6-digit code',
    verifyBtn: 'Verify',
    resendBtn: 'Resend code',
    changeNumberBtn: 'Change number',
    authGenericError: 'Something went wrong. Please try again.',
    authInvalidPhone: 'Please enter a valid phone number with country code (e.g. +32470123456).',
    authInvalidCode: 'Incorrect code. Please try again.',
    sectionAccount: 'ACCOUNT',
    connectedAs: 'Connected as',
    signOutBtn: 'Sign out',
    alarmText: 'ALARM',
    armedText: 'ARMED',
    armedSub1: 'Your belongings are protected',
    armedSub2: 'Any movement will trigger the alarm',
    activeBadge: 'ACTIVE',
    warningTitle: 'Before activating:',
    warningText: 'Turn OFF silent mode — Set volume to MAXIMUM',
    howTo1: 'Slide to ACTIVATE — place phone on your bag',
    howTo2: 'Movement triggers a loud alarm',
    howTo3: 'Unlock with Face ID or passcode to stop it',
    noPasscodeTitle: 'Passcode required',
    noPasscodeText: 'Set a passcode or Face ID/Touch ID on this phone before using BeachGuard. Without it, the alarm could never be turned off.',
    photoConsentTitle: 'Before activating',
    photoConsentText: 'Once activated, this feature automatically takes a photo every 30 seconds for 5 minutes using the front camera, without notifying the person being photographed — including in public places. By activating this feature, you assume full responsibility for its use and for complying with the laws of your country. BeachGuard does not access any of these photos.',
    photoConsentBtn: 'I understand and agree',
    sectionPhotoConsent: 'PHOTO CONSENT',
    photoConsentAcceptedLabel: 'Accepted on',
    countdownLabel: 'seconds to unlock',
    settingsTitle: 'Settings',
    sectionContacts: 'ALERT CONTACTS',
    email1Placeholder: 'Email address 1',
    email2Placeholder: 'Email address 2 (optional)',
    phone1Placeholder: 'Phone 1 (optional)',
    phone2Placeholder: 'Phone 2 (optional)',
    addContactPlaceholder: 'Contact phone number (e.g. +32...)',
    addContactBtn: 'Add',
    pickContactLabel: 'Contacts',
    contactStatusActive: 'Active account',
    contactStatusPending: 'Waiting to sign up',
    removeContactBtn: 'Remove',
    contactAlreadyAdded: 'This number is already in your list.',
    contactCannotBeSelf: "You can't add your own number.",
    noContactsYet: 'No contacts added yet.',
    contactsHint: 'Email alert with GPS location sent on trigger. Push notifications require BeachGuard Free installed on contact phone.',
    shareAppBtn: 'Share BeachGuard Free with your contacts',
    bugReportBtn: 'Found a bug? Report it',
    bugSubject: 'BeachGuard - Bug Report',
    mailAlertTitle: 'Email',
    mailErrorMsg: 'Could not open the Mail app. Please make sure it is configured.',
    sectionSensitivity: 'SENSITIVITY',
    sensVeryHigh: 'Very High',
    sensMedium: 'Medium',
    sensLow: 'Low',
    sensCurrent: 'Current',
    sensMaximum: 'Maximum',
    sensMinimum: 'Minimum',
    sectionCountdown: 'COUNTDOWN BEFORE ALARM',
    sectionSound: 'CHOOSE ALARM SOUND',
    listenBtn: 'Listen',
    saveBtn: 'SAVE SETTINGS',
    savedBtn: '✓ SAVED',
    closeBtn: 'CLOSE',
    sectionLanguage: 'LANGUAGE',
    unlockPrompt: 'Unlock BeachGuard',
    enterPasscode: 'Enter passcode',
    shareAppMessage: `BeachGuard Free — Stay Alert!

I use BeachGuard to protect my belongings at the beach, pool, or gym.

If my phone is moved or stolen, YOU will instantly receive an alert with my GPS location and photos of the thief — but only if you have BeachGuard Free installed.

It is 100% free and takes 30 seconds to set up.

Download BeachGuard Free: https://beachguard.app

Stay safe!`,
    sirenNames: ['Piezo Alarm', 'Warning Loop', 'Facility Siren', 'Reverb Warning', 'Fire Truck', 'Police Siren', 'Police Siren US', 'Burglar Alarm', 'Sci-Fi Alert', 'Signal Alert', 'Club Alarm', 'Police Operation'],
    deterrentMessage: 'This phone is protected and being tracked. Put it down now.',
    sectionVoice: 'DETERRENT VOICE',
    noVoicesFound: 'No voices found for this language on this device.',
  },
  pt: {
    activateLabel: 'Deslize para ATIVAR',
    disarmLabel: 'Deslize para DESATIVAR',
    authWelcomeTitle: 'Bem-vindo ao BeachGuard',
    authWelcomeSubtitle: 'Introduza o seu número de telefone para continuar',
    phonePlaceholder: 'Número de telefone (ex: +351...)',
    sendCodeBtn: 'Enviar código',
    authCodeSubtitle: 'Introduza o código enviado para',
    codePlaceholder: 'Código de 6 dígitos',
    verifyBtn: 'Verificar',
    resendBtn: 'Reenviar código',
    changeNumberBtn: 'Alterar número',
    authGenericError: 'Ocorreu um erro. Tente novamente.',
    authInvalidPhone: 'Introduza um número de telefone válido com indicativo do país (ex: +351...).',
    authInvalidCode: 'Código incorreto. Tente novamente.',
    sectionAccount: 'CONTA',
    connectedAs: 'Ligado como',
    signOutBtn: 'Terminar sessão',
    alarmText: 'ALARME',
    armedText: 'ATIVO',
    armedSub1: 'Os seus pertences estão protegidos',
    armedSub2: 'Qualquer movimento irá acionar o alarme',
    activeBadge: 'ATIVO',
    warningTitle: 'Antes de ativar:',
    warningText: 'Desative o modo silencioso — Coloque o volume no MÁXIMO',
    howTo1: 'Deslize para ATIVAR — coloque o telemóvel no seu saco',
    howTo2: 'O movimento aciona um alarme alto',
    howTo3: 'Desbloqueie com Face ID ou código para o parar',
    noPasscodeTitle: 'Código necessário',
    noPasscodeText: 'Configure um código ou Face ID/Touch ID neste telemóvel antes de usar o BeachGuard. Sem isso, o alarme nunca poderia ser desativado.',
    photoConsentTitle: 'Antes de ativar',
    photoConsentText: 'Uma vez ativada, esta funcionalidade tira automaticamente uma fotografia a cada 30 segundos durante 5 minutos, através da câmara frontal, sem que a pessoa fotografada seja avisada — incluindo na via pública. Ao ativar esta funcionalidade, assume total responsabilidade pela sua utilização e pelo cumprimento da legislação do seu país. A BeachGuard não tem acesso a nenhuma destas fotografias.',
    photoConsentBtn: 'Compreendo e aceito',
    sectionPhotoConsent: 'CONSENTIMENTO DE FOTO',
    photoConsentAcceptedLabel: 'Aceite em',
    countdownLabel: 'segundos até desbloquear',
    settingsTitle: 'Definições',
    sectionContacts: 'CONTACTOS DE ALERTA',
    email1Placeholder: 'Endereço de email 1',
    email2Placeholder: 'Endereço de email 2 (opcional)',
    phone1Placeholder: 'Telefone 1 (opcional)',
    phone2Placeholder: 'Telefone 2 (opcional)',
    addContactPlaceholder: 'Número do contacto (ex: +351...)',
    addContactBtn: 'Adicionar',
    pickContactLabel: 'Contactos',
    contactStatusActive: 'Conta ativa',
    contactStatusPending: 'A aguardar inscrição',
    removeContactBtn: 'Remover',
    contactAlreadyAdded: 'Este número já está na sua lista.',
    contactCannotBeSelf: 'Não pode adicionar o seu próprio número.',
    noContactsYet: 'Ainda não adicionou nenhum contacto.',
    contactsHint: 'É enviado um alerta por email com a localização GPS quando ativado. As notificações push exigem que o BeachGuard Free esteja instalado no telefone do contacto.',
    shareAppBtn: 'Partilhar BeachGuard Free com os seus contactos',
    bugReportBtn: 'Encontrou um bug? Reporte',
    bugSubject: 'BeachGuard - Relatório de Bug',
    mailAlertTitle: 'Email',
    mailErrorMsg: 'Não foi possível abrir a aplicação de Email. Certifique-se de que está configurada.',
    sectionSensitivity: 'SENSIBILIDADE',
    sensVeryHigh: 'Muito alta',
    sensMedium: 'Média',
    sensLow: 'Baixa',
    sensCurrent: 'Atual',
    sensMaximum: 'Máxima',
    sensMinimum: 'Mínima',
    sectionCountdown: 'CONTAGEM DECRESCENTE ANTES DO ALARME',
    sectionSound: 'ESCOLHER SOM DO ALARME',
    listenBtn: 'Ouvir',
    saveBtn: 'GUARDAR DEFINIÇÕES',
    savedBtn: '✓ GUARDADO',
    closeBtn: 'FECHAR',
    sectionLanguage: 'IDIOMA',
    unlockPrompt: 'Desbloquear BeachGuard',
    enterPasscode: 'Introduzir código',
    shareAppMessage: `BeachGuard Free — Mantenha-se alerta!

Uso o BeachGuard para proteger os meus pertences na praia, na piscina ou no ginásio.

Se o meu telemóvel for deslocado ou roubado, VOCÊ receberá instantaneamente um alerta com a minha localização GPS e fotos do ladrão — mas apenas se tiver o BeachGuard Free instalado.

É 100% gratuito e demora 30 segundos a configurar.

Descarregue o BeachGuard Free: https://beachguard.app

Mantenha-se seguro!`,
    sirenNames: ['Alarme Piezo', 'Alarme em ciclo', 'Sirene de instalação', 'Alerta com reverberação', 'Camião de bombeiros', 'Sirene da polícia', 'Sirene da polícia EUA', 'Alarme antirroubo', 'Alerta de ficção científica', 'Sinal de alerta', 'Alarme de discoteca', 'Operação policial'],
    deterrentMessage: 'Este telemóvel está protegido e a ser localizado. Larga-o já.',
    sectionVoice: 'VOZ DE DISSUASÃO',
    noVoicesFound: 'Nenhuma voz encontrada para este idioma neste aparelho.',
  },
  es: {
    activateLabel: 'Desliza para ACTIVAR',
    disarmLabel: 'Desliza para DESACTIVAR',
    authWelcomeTitle: 'Bienvenido a BeachGuard',
    authWelcomeSubtitle: 'Introduce tu número de teléfono para continuar',
    phonePlaceholder: 'Número de teléfono (ej: +34...)',
    sendCodeBtn: 'Enviar código',
    authCodeSubtitle: 'Introduce el código enviado a',
    codePlaceholder: 'Código de 6 dígitos',
    verifyBtn: 'Verificar',
    resendBtn: 'Reenviar código',
    changeNumberBtn: 'Cambiar número',
    authGenericError: 'Algo salió mal. Inténtalo de nuevo.',
    authInvalidPhone: 'Introduce un número de teléfono válido con el prefijo del país (ej: +34...).',
    authInvalidCode: 'Código incorrecto. Inténtalo de nuevo.',
    sectionAccount: 'CUENTA',
    connectedAs: 'Conectado como',
    signOutBtn: 'Cerrar sesión',
    alarmText: 'ALARMA',
    armedText: 'ARMADO',
    armedSub1: 'Tus pertenencias están protegidas',
    armedSub2: 'Cualquier movimiento activará la alarma',
    activeBadge: 'ACTIVO',
    warningTitle: 'Antes de activar:',
    warningText: 'Desactiva el modo silencio — Sube el volumen al MÁXIMO',
    howTo1: 'Desliza para ACTIVAR — coloca el teléfono en tu bolso',
    howTo2: 'El movimiento activa una alarma potente',
    howTo3: 'Desbloquea con Face ID o código para detenerla',
    noPasscodeTitle: 'Código requerido',
    noPasscodeText: 'Configura un código o Face ID/Touch ID en este teléfono antes de usar BeachGuard. Sin ello, la alarma nunca podría desactivarse.',
    photoConsentTitle: 'Antes de activar',
    photoConsentText: 'Una vez activada, esta función toma automáticamente una fotografía cada 30 segundos durante 5 minutos mediante la cámara frontal, sin avisar a la persona fotografiada — incluso en la vía pública. Al activar esta función, asumes la responsabilidad total de su uso y del cumplimiento de la legislación de tu país. BeachGuard no accede a ninguna de estas fotografías.',
    photoConsentBtn: 'Entiendo y acepto',
    sectionPhotoConsent: 'CONSENTIMIENTO DE FOTO',
    photoConsentAcceptedLabel: 'Aceptado el',
    countdownLabel: 'segundos para desbloquear',
    settingsTitle: 'Ajustes',
    sectionContacts: 'CONTACTOS DE ALERTA',
    email1Placeholder: 'Correo electrónico 1',
    email2Placeholder: 'Correo electrónico 2 (opcional)',
    phone1Placeholder: 'Teléfono 1 (opcional)',
    phone2Placeholder: 'Teléfono 2 (opcional)',
    addContactPlaceholder: 'Número del contacto (ej: +34...)',
    addContactBtn: 'Añadir',
    pickContactLabel: 'Contactos',
    contactStatusActive: 'Cuenta activa',
    contactStatusPending: 'Esperando registro',
    removeContactBtn: 'Quitar',
    contactAlreadyAdded: 'Este número ya está en tu lista.',
    contactCannotBeSelf: 'No puedes añadir tu propio número.',
    noContactsYet: 'Aún no has añadido ningún contacto.',
    contactsHint: 'Se envía una alerta por correo con la ubicación GPS al activarse. Las notificaciones push requieren que BeachGuard Free esté instalado en el teléfono del contacto.',
    shareAppBtn: 'Comparte BeachGuard Free con tus contactos',
    bugReportBtn: '¿Encontraste un error? Repórtalo',
    bugSubject: 'BeachGuard - Informe de error',
    mailAlertTitle: 'Email',
    mailErrorMsg: 'No se pudo abrir la aplicación de Correo. Asegúrate de que esté configurada.',
    sectionSensitivity: 'SENSIBILIDAD',
    sensVeryHigh: 'Muy alta',
    sensMedium: 'Media',
    sensLow: 'Baja',
    sensCurrent: 'Actual',
    sensMaximum: 'Máxima',
    sensMinimum: 'Mínima',
    sectionCountdown: 'CUENTA ATRÁS ANTES DE LA ALARMA',
    sectionSound: 'ELEGIR SONIDO DE ALARMA',
    listenBtn: 'Escuchar',
    saveBtn: 'GUARDAR AJUSTES',
    savedBtn: '✓ GUARDADO',
    closeBtn: 'CERRAR',
    sectionLanguage: 'IDIOMA',
    unlockPrompt: 'Desbloquear BeachGuard',
    enterPasscode: 'Introducir código',
    shareAppMessage: `BeachGuard Free — ¡Mantente alerta!

Uso BeachGuard para proteger mis pertenencias en la playa, la piscina o el gimnasio.

Si mueven o roban mi teléfono, TÚ recibirás al instante una alerta con mi ubicación GPS y fotos del ladrón — pero solo si tienes instalado BeachGuard Free.

Es 100% gratis y toma 30 segundos configurarlo.

Descarga BeachGuard Free: https://beachguard.app

¡Mantente a salvo!`,
    sirenNames: ['Alarma Piezo', 'Alarma en bucle', 'Sirena de instalación', 'Alerta con reverberación', 'Camión de bomberos', 'Sirena de policía', 'Sirena de policía US', 'Alarma antirrobo', 'Alerta de ciencia ficción', 'Señal de alerta', 'Alarma de discoteca', 'Operación policial'],
    deterrentMessage: 'Este teléfono está protegido y localizado. Suéltalo ahora mismo.',
    sectionVoice: 'VOZ DISUASORIA',
    noVoicesFound: 'No se encontraron voces para este idioma en este dispositivo.',
  },
  fr: {
    activateLabel: 'Glissez pour ACTIVER',
    disarmLabel: 'Glissez pour DÉSACTIVER',
    authWelcomeTitle: 'Bienvenue sur BeachGuard',
    authWelcomeSubtitle: 'Entrez votre numéro de téléphone pour continuer',
    phonePlaceholder: 'Numéro de téléphone (ex : +32...)',
    sendCodeBtn: 'Envoyer le code',
    authCodeSubtitle: 'Entrez le code envoyé au',
    codePlaceholder: 'Code à 6 chiffres',
    verifyBtn: 'Vérifier',
    resendBtn: 'Renvoyer le code',
    changeNumberBtn: 'Changer de numéro',
    authGenericError: "Une erreur s'est produite. Réessayez.",
    authInvalidPhone: "Entrez un numéro de téléphone valide avec l'indicatif du pays (ex : +32470123456).",
    authInvalidCode: 'Code incorrect. Réessayez.',
    sectionAccount: 'COMPTE',
    connectedAs: 'Connecté en tant que',
    signOutBtn: 'Se déconnecter',
    alarmText: 'ALARME',
    armedText: 'ARMÉ',
    armedSub1: "Vos affaires sont protégées",
    armedSub2: "Tout mouvement déclenchera l'alarme",
    activeBadge: 'ACTIF',
    warningTitle: "Avant d'activer :",
    warningText: 'Désactivez le mode silencieux — Réglez le volume au MAXIMUM',
    howTo1: 'Glissez pour ACTIVER — posez le téléphone sur votre sac',
    howTo2: 'Un mouvement déclenche une alarme puissante',
    howTo3: "Déverrouillez avec Face ID ou le code pour l'arrêter",
    noPasscodeTitle: 'Code de verrouillage requis',
    noPasscodeText: "Configurez un code ou Face ID/Touch ID sur ce téléphone avant d'utiliser BeachGuard. Sans cela, l'alarme ne pourrait jamais être désactivée.",
    photoConsentTitle: "Avant d'activer",
    photoConsentText: "Une fois activée, cette fonction photographie automatiquement toutes les 30 secondes pendant 5 minutes via la caméra avant, sans que la personne photographiée en soit avertie — y compris sur la voie publique. En activant cette fonction, vous assumez l'entière responsabilité de son usage et de sa conformité avec la législation de votre pays. BeachGuard n'accède à aucune de ces photos.",
    photoConsentBtn: "J'ai compris et j'accepte",
    sectionPhotoConsent: 'CONSENTEMENT PHOTO',
    photoConsentAcceptedLabel: 'Accepté le',
    countdownLabel: 'secondes avant déverrouillage',
    settingsTitle: 'Réglages',
    sectionContacts: "CONTACTS D'ALERTE",
    email1Placeholder: 'Adresse e-mail 1',
    email2Placeholder: 'Adresse e-mail 2 (optionnel)',
    phone1Placeholder: 'Téléphone 1 (optionnel)',
    phone2Placeholder: 'Téléphone 2 (optionnel)',
    addContactPlaceholder: 'Numéro du proche (ex : +32...)',
    addContactBtn: 'Ajouter',
    pickContactLabel: 'Contacts',
    contactStatusActive: 'Compte actif',
    contactStatusPending: "En attente d'inscription",
    removeContactBtn: 'Retirer',
    contactAlreadyAdded: 'Ce numéro est déjà dans votre liste.',
    contactCannotBeSelf: 'Vous ne pouvez pas ajouter votre propre numéro.',
    noContactsYet: "Aucun proche ajouté pour l'instant.",
    contactsHint: "Une alerte e-mail avec la localisation GPS est envoyée lors du déclenchement. Les notifications push nécessitent que BeachGuard Free soit installé sur le téléphone du contact.",
    shareAppBtn: 'Partager BeachGuard Free avec vos contacts',
    bugReportBtn: 'Un bug ? Signalez-le',
    bugSubject: 'BeachGuard - Signalement de bug',
    mailAlertTitle: 'E-mail',
    mailErrorMsg: "Impossible d'ouvrir l'application Mail. Vérifiez qu'elle est bien configurée.",
    sectionSensitivity: 'SENSIBILITÉ',
    sensVeryHigh: 'Très élevée',
    sensMedium: 'Moyenne',
    sensLow: 'Faible',
    sensCurrent: 'Actuel',
    sensMaximum: 'Maximale',
    sensMinimum: 'Minimale',
    sectionCountdown: 'COMPTE À REBOURS AVANT ALARME',
    sectionSound: "CHOISIR LE SON D'ALARME",
    listenBtn: 'Écouter',
    saveBtn: 'ENREGISTRER',
    savedBtn: '✓ ENREGISTRÉ',
    closeBtn: 'FERMER',
    sectionLanguage: 'LANGUE',
    unlockPrompt: 'Déverrouiller BeachGuard',
    enterPasscode: 'Entrer le code',
    shareAppMessage: `BeachGuard Free — Restez alerte !

J'utilise BeachGuard pour protéger mes affaires à la plage, à la piscine ou à la salle de sport.

Si mon téléphone est déplacé ou volé, VOUS recevrez instantanément une alerte avec ma position GPS et des photos du voleur — mais seulement si vous avez installé BeachGuard Free.

C'est 100% gratuit et ça prend 30 secondes à configurer.

Téléchargez BeachGuard Free : https://beachguard.app

Restez en sécurité !`,
    sirenNames: ['Alarme Piezo', 'Alarme en boucle', "Sirène d'installation", 'Alerte avec réverbération', 'Camion de pompiers', 'Sirène de police', 'Sirène de police US', 'Alarme anti-effraction', 'Alerte science-fiction', "Signal d'alerte", 'Alarme de boîte de nuit', 'Opération de police'],
    deterrentMessage: 'Ce téléphone est protégé et localisé. Reposez-le immédiatement.',
    sectionVoice: 'VOIX DISSUASIVE',
    noVoicesFound: 'Aucune voix trouvée pour cette langue sur cet appareil.',
  },
  de: {
    activateLabel: 'Wischen zum AKTIVIEREN',
    disarmLabel: 'Wischen zum DEAKTIVIEREN',
    authWelcomeTitle: 'Willkommen bei BeachGuard',
    authWelcomeSubtitle: 'Geben Sie Ihre Telefonnummer ein, um fortzufahren',
    phonePlaceholder: 'Telefonnummer (z. B. +49...)',
    sendCodeBtn: 'Code senden',
    authCodeSubtitle: 'Geben Sie den Code ein, gesendet an',
    codePlaceholder: '6-stelliger Code',
    verifyBtn: 'Bestätigen',
    resendBtn: 'Code erneut senden',
    changeNumberBtn: 'Nummer ändern',
    authGenericError: 'Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.',
    authInvalidPhone: 'Bitte geben Sie eine gültige Telefonnummer mit Landesvorwahl ein (z. B. +49...).',
    authInvalidCode: 'Falscher Code. Bitte versuchen Sie es erneut.',
    sectionAccount: 'KONTO',
    connectedAs: 'Verbunden als',
    signOutBtn: 'Abmelden',
    alarmText: 'ALARM',
    armedText: 'AKTIVIERT',
    armedSub1: 'Ihre Sachen sind geschützt',
    armedSub2: 'Jede Bewegung löst den Alarm aus',
    activeBadge: 'AKTIV',
    warningTitle: 'Vor der Aktivierung:',
    warningText: 'Lautlos-Modus AUSSCHALTEN — Lautstärke auf MAXIMUM stellen',
    howTo1: 'Zum AKTIVIEREN wischen — Handy auf Ihre Tasche legen',
    howTo2: 'Bewegung löst einen lauten Alarm aus',
    howTo3: 'Mit Face ID oder Code entsperren, um ihn zu stoppen',
    noPasscodeTitle: 'Code erforderlich',
    noPasscodeText: 'Richten Sie einen Code oder Face ID/Touch ID auf diesem Telefon ein, bevor Sie BeachGuard verwenden. Andernfalls könnte der Alarm nie deaktiviert werden.',
    photoConsentTitle: 'Vor der Aktivierung',
    photoConsentText: 'Nach der Aktivierung nimmt diese Funktion automatisch alle 30 Sekunden für 5 Minuten ein Foto über die Frontkamera auf, ohne dass die fotografierte Person darüber informiert wird — auch im öffentlichen Raum. Mit der Aktivierung dieser Funktion übernehmen Sie die volle Verantwortung für deren Nutzung und für die Einhaltung der Gesetze Ihres Landes. BeachGuard hat keinen Zugriff auf diese Fotos.',
    photoConsentBtn: 'Verstanden und akzeptiert',
    sectionPhotoConsent: 'FOTO-EINWILLIGUNG',
    photoConsentAcceptedLabel: 'Akzeptiert am',
    countdownLabel: 'Sekunden bis zur Entsperrung',
    settingsTitle: 'Einstellungen',
    sectionContacts: 'ALARMKONTAKTE',
    email1Placeholder: 'E-Mail-Adresse 1',
    email2Placeholder: 'E-Mail-Adresse 2 (optional)',
    phone1Placeholder: 'Telefon 1 (optional)',
    phone2Placeholder: 'Telefon 2 (optional)',
    addContactPlaceholder: 'Telefonnummer des Kontakts (z. B. +49...)',
    addContactBtn: 'Hinzufügen',
    pickContactLabel: 'Kontakte',
    contactStatusActive: 'Konto aktiv',
    contactStatusPending: 'Wartet auf Anmeldung',
    removeContactBtn: 'Entfernen',
    contactAlreadyAdded: 'Diese Nummer ist bereits in Ihrer Liste.',
    contactCannotBeSelf: 'Sie können Ihre eigene Nummer nicht hinzufügen.',
    noContactsYet: 'Noch keine Kontakte hinzugefügt.',
    contactsHint: 'Bei Auslösung wird eine E-Mail-Warnung mit GPS-Standort gesendet. Push-Benachrichtigungen erfordern, dass BeachGuard Free auf dem Telefon des Kontakts installiert ist.',
    shareAppBtn: 'BeachGuard Free mit Ihren Kontakten teilen',
    bugReportBtn: 'Fehler gefunden? Melden',
    bugSubject: 'BeachGuard - Fehlerbericht',
    mailAlertTitle: 'E-Mail',
    mailErrorMsg: 'Die Mail-App konnte nicht geöffnet werden. Bitte stellen Sie sicher, dass sie eingerichtet ist.',
    sectionSensitivity: 'EMPFINDLICHKEIT',
    sensVeryHigh: 'Sehr hoch',
    sensMedium: 'Mittel',
    sensLow: 'Niedrig',
    sensCurrent: 'Aktuell',
    sensMaximum: 'Maximal',
    sensMinimum: 'Minimal',
    sectionCountdown: 'COUNTDOWN VOR ALARM',
    sectionSound: 'ALARMTON WÄHLEN',
    listenBtn: 'Anhören',
    saveBtn: 'EINSTELLUNGEN SPEICHERN',
    savedBtn: '✓ GESPEICHERT',
    closeBtn: 'SCHLIESSEN',
    sectionLanguage: 'SPRACHE',
    unlockPrompt: 'BeachGuard entsperren',
    enterPasscode: 'Code eingeben',
    shareAppMessage: `BeachGuard Free — Bleib wachsam!

Ich benutze BeachGuard, um meine Sachen am Strand, im Schwimmbad oder im Fitnessstudio zu schützen.

Wenn mein Handy bewegt oder gestohlen wird, erhältst DU sofort eine Warnung mit meinem GPS-Standort und Fotos des Diebes — aber nur, wenn du BeachGuard Free installiert hast.

Es ist 100% kostenlos und die Einrichtung dauert 30 Sekunden.

Lade BeachGuard Free herunter: https://beachguard.app

Bleib sicher!`,
    sirenNames: ['Piezo-Alarm', 'Warnschleife', 'Anlagensirene', 'Hall-Warnung', 'Feuerwehrsirene', 'Polizeisirene', 'US-Polizeisirene', 'Einbruchalarm', 'Sci-Fi-Alarm', 'Signalton', 'Club-Alarm', 'Polizeieinsatz'],
    deterrentMessage: 'Dieses Telefon ist geschützt und wird geortet. Leg es sofort zurück.',
    sectionVoice: 'ABSCHRECKUNGSSTIMME',
    noVoicesFound: 'Keine Stimmen für diese Sprache auf diesem Gerät gefunden.',
  },
  nl: {
    activateLabel: 'Schuif om te ACTIVEREN',
    disarmLabel: 'Schuif om te DEACTIVEREN',
    authWelcomeTitle: 'Welkom bij BeachGuard',
    authWelcomeSubtitle: 'Voer je telefoonnummer in om verder te gaan',
    phonePlaceholder: 'Telefoonnummer (bijv. +31...)',
    sendCodeBtn: 'Code versturen',
    authCodeSubtitle: 'Voer de code in die verstuurd is naar',
    codePlaceholder: '6-cijferige code',
    verifyBtn: 'Verifiëren',
    resendBtn: 'Code opnieuw versturen',
    changeNumberBtn: 'Nummer wijzigen',
    authGenericError: 'Er is iets misgegaan. Probeer het opnieuw.',
    authInvalidPhone: 'Voer een geldig telefoonnummer in met landcode (bijv. +31...).',
    authInvalidCode: 'Onjuiste code. Probeer het opnieuw.',
    sectionAccount: 'ACCOUNT',
    connectedAs: 'Verbonden als',
    signOutBtn: 'Uitloggen',
    alarmText: 'ALARM',
    armedText: 'GEACTIVEERD',
    armedSub1: 'Je spullen zijn beschermd',
    armedSub2: 'Elke beweging activeert het alarm',
    activeBadge: 'ACTIEF',
    warningTitle: 'Voordat je activeert:',
    warningText: 'Zet de stille modus UIT — Zet het volume op MAXIMAAL',
    howTo1: 'Schuif om te ACTIVEREN — leg de telefoon op je tas',
    howTo2: 'Beweging activeert een luid alarm',
    howTo3: 'Ontgrendel met Face ID of code om te stoppen',
    noPasscodeTitle: 'Toegangscode vereist',
    noPasscodeText: 'Stel een toegangscode of Face ID/Touch ID in op deze telefoon voordat je BeachGuard gebruikt. Anders kan het alarm nooit worden uitgeschakeld.',
    photoConsentTitle: 'Voor het activeren',
    photoConsentText: "Eenmaal geactiveerd, maakt deze functie automatisch elke 30 seconden gedurende 5 minuten een foto via de frontcamera, zonder dat de gefotografeerde persoon hiervan op de hoogte wordt gebracht — ook op de openbare weg. Door deze functie te activeren, aanvaardt u de volledige verantwoordelijkheid voor het gebruik ervan en voor de naleving van de wetgeving van uw land. BeachGuard heeft geen toegang tot deze foto's.",
    photoConsentBtn: 'Ik begrijp het en ga akkoord',
    sectionPhotoConsent: 'FOTOTOESTEMMING',
    photoConsentAcceptedLabel: 'Geaccepteerd op',
    countdownLabel: 'seconden tot ontgrendeling',
    settingsTitle: 'Instellingen',
    sectionContacts: 'ALARMCONTACTEN',
    email1Placeholder: 'E-mailadres 1',
    email2Placeholder: 'E-mailadres 2 (optioneel)',
    phone1Placeholder: 'Telefoon 1 (optioneel)',
    phone2Placeholder: 'Telefoon 2 (optioneel)',
    addContactPlaceholder: 'Telefoonnummer van contact (bijv. +31...)',
    addContactBtn: 'Toevoegen',
    pickContactLabel: 'Contacten',
    contactStatusActive: 'Account actief',
    contactStatusPending: 'Wacht op registratie',
    removeContactBtn: 'Verwijderen',
    contactAlreadyAdded: 'Dit nummer staat al in je lijst.',
    contactCannotBeSelf: 'Je kunt je eigen nummer niet toevoegen.',
    noContactsYet: 'Nog geen contacten toegevoegd.',
    contactsHint: 'Bij activering wordt een e-mailwaarschuwing met GPS-locatie verstuurd. Pushmeldingen vereisen dat BeachGuard Free op de telefoon van het contact is geïnstalleerd.',
    shareAppBtn: 'Deel BeachGuard Free met je contacten',
    bugReportBtn: 'Bug gevonden? Meld het',
    bugSubject: 'BeachGuard - Bugmelding',
    mailAlertTitle: 'E-mail',
    mailErrorMsg: 'Kon de Mail-app niet openen. Zorg ervoor dat deze is geconfigureerd.',
    sectionSensitivity: 'GEVOELIGHEID',
    sensVeryHigh: 'Zeer hoog',
    sensMedium: 'Gemiddeld',
    sensLow: 'Laag',
    sensCurrent: 'Huidig',
    sensMaximum: 'Maximaal',
    sensMinimum: 'Minimaal',
    sectionCountdown: 'AFTELLEN VOOR ALARM',
    sectionSound: 'KIES ALARMGELUID',
    listenBtn: 'Beluisteren',
    saveBtn: 'INSTELLINGEN OPSLAAN',
    savedBtn: '✓ OPGESLAGEN',
    closeBtn: 'SLUITEN',
    sectionLanguage: 'TAAL',
    unlockPrompt: 'BeachGuard ontgrendelen',
    enterPasscode: 'Code invoeren',
    shareAppMessage: `BeachGuard Free — Blijf alert!

Ik gebruik BeachGuard om mijn spullen te beschermen op het strand, bij het zwembad of in de sportschool.

Als mijn telefoon verplaatst of gestolen wordt, ontvang JIJ direct een melding met mijn GPS-locatie en foto's van de dief — maar alleen als je BeachGuard Free hebt geïnstalleerd.

Het is 100% gratis en de installatie duurt 30 seconden.

Download BeachGuard Free: https://beachguard.app

Blijf veilig!`,
    sirenNames: ['Piëzo-alarm', 'Waarschuwingslus', 'Faciliteitssirene', 'Galm-waarschuwing', 'Brandweersirene', 'Politiesirene', 'Politiesirene VS', 'Inbraakalarm', 'Sci-fi-alarm', 'Signaalalarm', 'Clubalarm', 'Politieoperatie'],
    deterrentMessage: 'Deze telefoon is beveiligd en wordt gevolgd. Leg hem nu meteen neer.',
    sectionVoice: 'AFSCHRIKSTEM',
    noVoicesFound: 'Geen stemmen gevonden voor deze taal op dit apparaat.',
  },
};

const COUNTDOWNS = [5, 10, 15, 30];
const SENSITIVITY_MIN = 1.0;
const SENSITIVITY_MAX = 3.0;
const PHOTO_INTERVAL = 30000;
const PHOTO_DURATION = 300000;
const BG_IMAGES = [
  require('./assets/beach-bg.jpg'),
  require('./assets/beach-bg-2.jpg'),
];



const sl = StyleSheet.create({
  outer: { alignItems: 'center', position: 'relative' },

  track: {
    height: 70, borderRadius: 35,
    backgroundColor: 'rgba(0,0,0,0.78)',
    borderWidth: 3,
    justifyContent: 'center', overflow: 'hidden',
  },
  textRight: {
    position: 'absolute', right: 20,
    color: '#ffffff', fontSize: 16, fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.9)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  knobSteel: {
    width: 62, height: 62, borderRadius: 31,
    backgroundColor: '#b8c0c8',
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 3,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 10,
    elevation: 8,
  },

  steelInner: {
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: '#c8d2da',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  steelHighlight: {
    position: 'absolute',
    top: 3, left: 5, right: 5, height: 20,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 12,
  },
  arrow: { color: '#1a1a1a', fontSize: 28, fontWeight: '900', marginTop: 2 },
});
// ─── Composant Slider générique ──────────────────────────────────────────────
function ActionSlider({ onAction, color, label }) {
  const slideX = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.5)).current;
  const completedRef = useRef(false);
  const TRACK_WIDTH = 300;
  const KNOB = 64;
  const MAX = TRACK_WIDTH - KNOB - 6;

  const neonColor = color === 'green' ? '#00ff64' : '#ff3232';
  const neonGlow = color === 'green' ? 'rgba(0,255,100,0.5)' : 'rgba(255,50,50,0.5)';
  const neonGlowFaint = color === 'green' ? 'rgba(0,255,100,0.15)' : 'rgba(255,50,50,0.15)';

  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(glowAnim, { toValue: 1, duration: 900, useNativeDriver: false }),
      Animated.timing(glowAnim, { toValue: 0.3, duration: 900, useNativeDriver: false }),
    ])).start();
  }, []);

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderGrant: () => { completedRef.current = false; },
    onPanResponderMove: (_, g) => {
      if (completedRef.current) return;
      const v = Math.max(0, Math.min(g.dx, MAX));
      slideX.setValue(v);
      if (v >= MAX - 5) {
        completedRef.current = true;
        Animated.timing(slideX, { toValue: MAX, duration: 80, useNativeDriver: false }).start(() => {
          onAction();
          setTimeout(() => {
            Animated.timing(slideX, { toValue: 0, duration: 400, useNativeDriver: false }).start();
            completedRef.current = false;
          }, 800);
        });
      }
    },
    onPanResponderRelease: () => {
      if (!completedRef.current) Animated.spring(slideX, { toValue: 0, useNativeDriver: false }).start();
    },
    onPanResponderTerminate: () => {
      Animated.spring(slideX, { toValue: 0, useNativeDriver: false }).start();
      completedRef.current = false;
    },
  })).current;

  const borderGlow = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [neonGlowFaint, neonGlow] });


  return (
    <View style={sl.outer}>
      <Animated.View style={[sl.track, { borderColor: neonColor, width: TRACK_WIDTH, shadowColor: neonColor, shadowOpacity: glowAnim, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } }]}>
        <Text style={sl.textRight}>{label}</Text>
        <Animated.View
          style={[sl.knobSteel, { transform: [{ translateX: slideX }], shadowColor: neonColor, shadowOpacity: glowAnim, shadowRadius: 18, shadowOffset: { width: 0, height: 0 } }]}
          {...pan.panHandlers}
        >
          <View style={sl.steelInner}>
            <View style={sl.steelHighlight} />
            <Text style={sl.arrow}>›</Text>
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

function ActivateSlider({ onArm, label }) {
  return <ActionSlider onAction={onArm} color="green" label={label} />;
}

function DisarmSlider({ onDisarm, label }) {
  return <ActionSlider onAction={onDisarm} color="red" label={label} />;
}

// ─── Gyrophare ────────────────────────────────────────────────────────────────
function Gyrophare({ t }) {
  const rot = useRef(new Animated.Value(0)).current;
  const pulse1 = useRef(new Animated.Value(1)).current;
  const pulse2 = useRef(new Animated.Value(1)).current;
  const pulse3 = useRef(new Animated.Value(1)).current;
  const redOpacity = useRef(new Animated.Value(1)).current;
  const blueOpacity = useRef(new Animated.Value(0.3)).current;
  const textOpacity = useRef(new Animated.Value(1)).current;
  const strobeOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(Animated.timing(rot, { toValue: 1, duration: 800, easing: Easing.linear, useNativeDriver: true })).start();
    Animated.loop(Animated.sequence([Animated.timing(pulse1, { toValue: 1.08, duration: 400, useNativeDriver: true }), Animated.timing(pulse1, { toValue: 1, duration: 400, useNativeDriver: true })])).start();
    Animated.loop(Animated.sequence([Animated.timing(pulse2, { toValue: 1.15, duration: 400, useNativeDriver: true }), Animated.timing(pulse2, { toValue: 1, duration: 400, useNativeDriver: true })])).start();
    Animated.loop(Animated.sequence([Animated.timing(pulse3, { toValue: 1.22, duration: 400, useNativeDriver: true }), Animated.timing(pulse3, { toValue: 1, duration: 400, useNativeDriver: true })])).start();
    Animated.loop(Animated.sequence([Animated.timing(redOpacity, { toValue: 0.3, duration: 400, useNativeDriver: true }), Animated.timing(redOpacity, { toValue: 1, duration: 400, useNativeDriver: true })])).start();
    Animated.loop(Animated.sequence([Animated.timing(blueOpacity, { toValue: 1, duration: 400, useNativeDriver: true }), Animated.timing(blueOpacity, { toValue: 0.3, duration: 400, useNativeDriver: true })])).start();
    Animated.loop(Animated.sequence([Animated.timing(textOpacity, { toValue: 0.2, duration: 400, useNativeDriver: true }), Animated.timing(textOpacity, { toValue: 1, duration: 400, useNativeDriver: true })])).start();
    Animated.loop(Animated.sequence([Animated.timing(strobeOpacity, { toValue: 0.85, duration: 80, useNativeDriver: true }), Animated.timing(strobeOpacity, { toValue: 0, duration: 80, useNativeDriver: true }), Animated.delay(160)])).start();
  }, []);

  const spin = rot.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#ffffff', opacity: strobeOpacity }]} />
      <View style={g.container}>
        <Animated.View style={[g.ring3, { transform: [{ scale: pulse3 }] }]} />
        <Animated.View style={[g.ring2, { transform: [{ scale: pulse2 }] }]} />
        <Animated.View style={[g.ring1, { transform: [{ scale: pulse1 }] }]} />
        <View style={g.base}>
          <Animated.View style={[g.domeRed, { opacity: redOpacity }]} />
          <Animated.View style={[g.domeBlue, { opacity: blueOpacity }]} />
          <Animated.View style={[g.beamContainer, { transform: [{ rotate: spin }] }]}>
            <View style={g.beamRed} />
            <View style={g.beamBlue} />
          </Animated.View>
        </View>
        <Animated.Text style={[g.alarmText, { opacity: textOpacity }]}>{t.alarmText}</Animated.Text>
        <Text style={g.subText}>BEACHGUARD</Text>
      </View>
    </View>
  );
}

// ─── Écran ARMED ─────────────────────────────────────────────────────────────
function ArmedScreen({ onUnlock, t }) {
  const scale = useRef(new Animated.Value(1)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.loop(Animated.sequence([Animated.timing(scale, { toValue: 1.18, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }), Animated.timing(scale, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true })])).start();
    Animated.loop(Animated.sequence([Animated.timing(rotate, { toValue: 1, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }), Animated.timing(rotate, { toValue: -1, duration: 2500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }), Animated.timing(rotate, { toValue: 0, duration: 800, useNativeDriver: true })])).start();
    Animated.loop(Animated.sequence([Animated.timing(glow, { toValue: 1, duration: 700, useNativeDriver: true }), Animated.timing(glow, { toValue: 0, duration: 700, useNativeDriver: true })])).start();
    Animated.loop(Animated.sequence([Animated.timing(textOpacity, { toValue: 0.5, duration: 900, useNativeDriver: true }), Animated.timing(textOpacity, { toValue: 1, duration: 900, useNativeDriver: true })])).start();
  }, []);

  const spin = rotate.interpolate({ inputRange: [-1, 1], outputRange: ['-14deg', '14deg'] });
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.7] });

  return (
    <View style={a.screen}>
      <Animated.View style={[a.glowRing, { opacity: glowOpacity, transform: [{ scale }] }]} />
      <View style={a.shieldContainer}>
        <Animated.View style={[a.shieldGlow, { opacity: glowOpacity, transform: [{ scale }] }]} />
        <Animated.Image
          source={require('./assets/Bouclier.png')}
          style={[a.shieldImage, { transform: [{ scale }, { rotate: spin }] }]}
          resizeMode="contain"
        />
      </View>
      <Animated.Text style={[a.armedText, { opacity: textOpacity }]}>{t.armedText}</Animated.Text>
      <Text style={a.subText}>{t.armedSub1}</Text>
      <Text style={a.subText}>{t.armedSub2}</Text>
      <View style={a.badge}>
        <Text style={a.badgeText}>● {t.activeBadge}</Text>
      </View>
      <DisarmSlider onDisarm={onUnlock} label={t.disarmLabel} />
    </View>
  );
}

// ─── Écran de connexion par téléphone ────────────────────────────────────────
function PhoneAuthScreen({ t }) {
  const [step, setStep] = useState('phone'); // 'phone' | 'code'
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const sendCode = async () => {
    setErrorMsg('');
    const trimmed = phone.trim();
    if (!/^\+[1-9]\d{6,14}$/.test(trimmed)) {
      setErrorMsg(t.authInvalidPhone);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone: trimmed });
      if (error) throw error;
      setStep('code');
    } catch (e) {
      setErrorMsg(t.authGenericError);
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    setErrorMsg('');
    const trimmedCode = code.trim();
    if (!/^\d{4,8}$/.test(trimmedCode)) {
      setErrorMsg(t.authInvalidCode);
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ phone: phone.trim(), token: trimmedCode, type: 'sms' });
      if (error) throw error;
      // Succès : onAuthStateChange (dans App principale) met à jour la session
      // automatiquement, ce qui fait basculer l'écran vers l'app.
    } catch (e) {
      setErrorMsg(t.authInvalidCode);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={au.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Text style={au.title}>{t.authWelcomeTitle}</Text>

      {step === 'phone' ? (
        <>
          <Text style={au.subtitle}>{t.authWelcomeSubtitle}</Text>
          <TextInput
            style={au.input}
            placeholder={t.phonePlaceholder}
            placeholderTextColor="#7a8aa8"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoCapitalize="none"
            autoFocus
          />
          {!!errorMsg && <Text style={au.error}>{errorMsg}</Text>}
          <TouchableOpacity style={[au.btn, loading && au.btnDisabled]} onPress={sendCode} disabled={loading}>
            {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={au.btnText}>{t.sendCodeBtn}</Text>}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={au.subtitle}>{t.authCodeSubtitle} {phone.trim()}</Text>
          <TextInput
            style={au.input}
            placeholder={t.codePlaceholder}
            placeholderTextColor="#7a8aa8"
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoFocus
            maxLength={8}
          />
          {!!errorMsg && <Text style={au.error}>{errorMsg}</Text>}
          <TouchableOpacity style={[au.btn, loading && au.btnDisabled]} onPress={verifyCode} disabled={loading}>
            {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={au.btnText}>{t.verifyBtn}</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={au.linkBtn} onPress={() => { setStep('phone'); setCode(''); setErrorMsg(''); }} disabled={loading}>
            <Text style={au.linkText}>{t.changeNumberBtn}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={au.linkBtn} onPress={sendCode} disabled={loading}>
            <Text style={au.linkText}>{t.resendBtn}</Text>
          </TouchableOpacity>
        </>
      )}
    </KeyboardAvoidingView>
  );
}

// Écran plein écran, non fermable, affiché une seule fois avant la toute
// première activation (même principe que PhoneAuthScreen : tant qu'il est
// retourné ici, aucun autre écran de l'app n'est atteignable).
function PhotoConsentScreen({ t, onAccept }) {
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    setLoading(true);
    await onAccept();
    setLoading(false);
  };

  return (
    <View style={pc.screen}>
      <ScrollView contentContainerStyle={pc.scrollContent}>
        <Text style={au.title}>{t.photoConsentTitle}</Text>
        <Text style={pc.text}>{t.photoConsentText}</Text>
      </ScrollView>
      <TouchableOpacity style={[au.btn, pc.btn, loading && au.btnDisabled]} onPress={handleAccept} disabled={loading}>
        {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={au.btnText}>{t.photoConsentBtn}</Text>}
      </TouchableOpacity>
    </View>
  );
}

const pc = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0a1628', paddingTop: 80, paddingBottom: 28, paddingHorizontal: 28 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', gap: 14 },
  text: { fontSize: 15, color: '#dbe3f0', lineHeight: 22, textAlign: 'left' },
  btn: { marginTop: 20 },
});

const au = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0a1628', alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14 },
  title: { fontSize: 26, fontWeight: '700', color: '#ffffff', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#aabbcc', textAlign: 'center', marginBottom: 8, paddingHorizontal: 12 },
  input: { width: '100%', backgroundColor: '#1e2e50', borderRadius: 14, padding: 16, color: '#ffffff', fontSize: 17, borderWidth: 1.5, borderColor: '#3a5080', textAlign: 'center' },
  error: { color: '#ff6b6b', fontSize: 13, textAlign: 'center', marginTop: 4 },
  btn: { width: '100%', backgroundColor: '#1a73e8', borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#ffffff', fontSize: 17, fontWeight: '700' },
  linkBtn: { marginTop: 6, padding: 8 },
  linkText: { color: '#7ab8ff', fontSize: 14, fontWeight: '600' },
});

// ─── App principale ───────────────────────────────────────────────────────────
export default function App() {
  const [armed, setArmed] = useState(false);
  const [countdown, setCountdown] = useState(10);
  const [countdownDuration, setCountdownDuration] = useState(10);
  const [alarmActive, setAlarmActive] = useState(false);
  const [counting, setCounting] = useState(false);
  const [selectedSiren, setSelectedSiren] = useState(SIRENS[0]);
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState(null);
  const [sirenPickerOpen, setSirenPickerOpen] = useState(false);
  const [voicePickerOpen, setVoicePickerOpen] = useState(false);
  const [sensitivityValue, setSensitivityValue] = useState(2.0);
  const [showSettings, setShowSettings] = useState(false);
  const [bgIndex, setBgIndex] = useState(0);
  const [alertEmail, setAlertEmail] = useState('');
  const [alertEmail2, setAlertEmail2] = useState('');
  const [contacts, setContacts] = useState([]);
  const [newContactPhone, setNewContactPhone] = useState('');
  const [contactError, setContactError] = useState('');
  const [contactLoading, setContactLoading] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [language, setLanguage] = useState('en');
  const t = TRANSLATIONS[language];
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [noPasscode, setNoPasscode] = useState(false);
  // null = pas encore vérifié, false = refusé/non répondu, true = accepté
  const [photoConsentGiven, setPhotoConsentGiven] = useState(null);
  const [photoConsentDate, setPhotoConsentDate] = useState(null);
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef(null);
  const countdownRef = useRef(null);
  const soundRef = useRef(null);
  const beepSoundRef = useRef(null);
  const photoIntervalRef = useRef(null);
  const photoTimeoutRef = useRef(null);
  const locationWatchRef = useRef(null);
  const facingRef = useRef('front');

  useEffect(() => {
    Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true, shouldDuckAndroid: false });
    requestPermission();
    Location.requestForegroundPermissionsAsync();
    loadSettings();
    (async () => {
      try {
        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const isEnrolled = await LocalAuthentication.isEnrolledAsync();
        setNoPasscode(!hasHardware || !isEnrolled);
      } catch (e) { setNoPasscode(true); }
    })();
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setBgIndex(i => (i + 1) % BG_IMAGES.length), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (session?.user?.id) loadContacts();
  }, [session]);

  useEffect(() => {
    if (!session?.user?.id) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('photo_consent_accepted_at')
          .eq('id', session.user.id)
          .maybeSingle();
        setPhotoConsentGiven(!!data?.photo_consent_accepted_at);
        setPhotoConsentDate(data?.photo_consent_accepted_at || null);
      } catch (e) {
        setPhotoConsentGiven(false);
      }
    })();
  }, [session]);

  const acceptPhotoConsent = async () => {
    try {
      const now = new Date().toISOString();
      await supabase
        .from('profiles')
        .update({ photo_consent_accepted_at: now })
        .eq('id', session.user.id);
      setPhotoConsentDate(now);
      setPhotoConsentGiven(true);
    } catch (e) {}
  };

  useEffect(() => {
    loadVoicesForLanguage(language);
  }, [language]);

  useEffect(() => {
    if (!armed) return;
    const sub = Accelerometer.addListener(({ x, y, z }) => {
      const total = Math.sqrt(x * x + y * y + z * z);
      if (total > sensitivityValue && !counting && !alarmActive) startCountdown();
    });
    Accelerometer.setUpdateInterval(400);
    return () => sub.remove();
  }, [armed, counting, alarmActive, sensitivityValue]);

  const loadSettings = async () => {
    try {
      const email = await AsyncStorage.getItem('alertEmail');
      const email2 = await AsyncStorage.getItem('alertEmail2');
      const sens = await AsyncStorage.getItem('sensitivityValue');
      const sirenId = await AsyncStorage.getItem('selectedSirenId');
      const lang = await AsyncStorage.getItem('appLanguage');
      const voiceId = await AsyncStorage.getItem('selectedVoiceId');
      if (email) setAlertEmail(email);
      if (email2) setAlertEmail2(email2);
      if (sens) setSensitivityValue(parseFloat(sens));
      if (sirenId) { const found = SIRENS.find(s => s.id === parseInt(sirenId)); if (found) setSelectedSiren(found); }
      if (lang && TRANSLATIONS[lang]) {
        setLanguage(lang);
      } else {
        // Première ouverture : pas de langue choisie manuellement encore,
        // on part de la langue de l'appareil si elle est supportée.
        const deviceLang = Localization.getLocales()[0]?.languageCode;
        if (deviceLang && TRANSLATIONS[deviceLang]) setLanguage(deviceLang);
      }
      if (voiceId) setSelectedVoiceId(voiceId);
    } catch (e) {}
  };

  const loadVoicesForLanguage = async (lang) => {
    try {
      const all = await Speech.getAvailableVoicesAsync();
      const localePrefix = (SPEECH_LOCALES[lang] || 'en-US').split('-')[0];
      const allowedNames = (DETERRENT_VOICE_NAMES[lang] || []).map(normalizeVoiceName);
      const filtered = all.filter(v =>
        v.language && v.language.toLowerCase().startsWith(localePrefix) &&
        v.name && allowedNames.includes(normalizeVoiceName(v.name))
      );
      setAvailableVoices(filtered);
    } catch (e) {
      setAvailableVoices([]);
    }
  };

  const loadContacts = async () => {
    if (!session?.user?.id) return;
    try {
      const { data, error } = await supabase
        .from('relations')
        .select('id, contact_phone, contact_user_id, created_at')
        .eq('payer_id', session.user.id)
        .order('created_at', { ascending: false });
      if (!error) setContacts(data || []);
    } catch (e) {}
  };

  const addContact = async () => {
    setContactError('');
    const trimmed = newContactPhone.trim();
    if (!/^\+[1-9]\d{6,14}$/.test(trimmed)) {
      setContactError(t.authInvalidPhone);
      return;
    }
    if (trimmed === `+${session?.user?.phone}`) {
      setContactError(t.contactCannotBeSelf);
      return;
    }
    setContactLoading(true);
    try {
      const { error } = await supabase
        .from('relations')
        .insert({ payer_id: session.user.id, contact_phone: trimmed });
      if (error) {
        setContactError(error.code === '23505' ? t.contactAlreadyAdded : t.authGenericError);
      } else {
        setNewContactPhone('');
        loadContacts();
      }
    } catch (e) {
      setContactError(t.authGenericError);
    } finally {
      setContactLoading(false);
    }
  };

  const removeContact = async (relationId) => {
    try {
      await supabase.from('relations').delete().eq('id', relationId);
      loadContacts();
    } catch (e) {}
  };

  const pickContact = async () => {
    try {
      const contact = await Contacts.presentContactPickerAsync();
      if (!contact || !contact.phoneNumbers || contact.phoneNumbers.length === 0) return;
      const raw = contact.phoneNumbers[0].number || contact.phoneNumbers[0].digits || '';
      const cleaned = raw.replace(/[^\d+]/g, '');
      setNewContactPhone(cleaned);
      setContactError('');
    } catch (e) {
      // On affiche une vraie erreur visible plutôt que d'échouer en silence
      setContactError(t.authGenericError);
    }
  };

  const saveSettings = async () => {
    try {
      await AsyncStorage.setItem('alertEmail', alertEmail);
      await AsyncStorage.setItem('alertEmail2', alertEmail2);
      await AsyncStorage.setItem('sensitivityValue', String(sensitivityValue));
      await AsyncStorage.setItem('selectedSirenId', String(selectedSiren.id));
      await AsyncStorage.setItem('appLanguage', language);
      await AsyncStorage.setItem('selectedVoiceId', selectedVoiceId || '');
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    } catch (e) {}
  };

  const playSound = async (sirenOverride, loop) => {
    try {
      if (soundRef.current) { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); soundRef.current = null; }
      const siren = sirenOverride || selectedSiren;
      const { sound } = await Audio.Sound.createAsync(siren.file, { shouldPlay: true, isLooping: loop, volume: 1.0 });
      soundRef.current = sound;
      return sound;
    } catch (e) {}
  };

  const stopSound = async () => {
    try {
      if (soundRef.current) { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); soundRef.current = null; }
    } catch (e) {}
  };

  const playBeep = async () => {
    try {
      if (beepSoundRef.current) { await beepSoundRef.current.stopAsync(); await beepSoundRef.current.unloadAsync(); beepSoundRef.current = null; }
      const { sound } = await Audio.Sound.createAsync(require('./assets/sounds/siren-signal.wav'), { shouldPlay: true, isLooping: false, volume: 0.8 });
      beepSoundRef.current = sound;
    } catch (e) {}
  };

  const speakDeterrentMessage = () => {
    try {
      const voiceForLang = selectedVoiceId && availableVoices.some(v => v.identifier === selectedVoiceId)
        ? selectedVoiceId
        : undefined;
      Speech.speak(t.deterrentMessage, {
        language: SPEECH_LOCALES[language] || 'en-US',
        voice: voiceForLang,
        rate: 0.95,
      });
    } catch (e) {}
  };

  const previewVoice = (voice) => {
    try {
      Speech.stop();
      Speech.speak(t.deterrentMessage, { language: voice.language, voice: voice.identifier, rate: 0.95 });
    } catch (e) {}
  };

  const sendSingleEmail = async (toEmail, mapsLink, time, incidentId) => {
    const { error } = await supabase.functions.invoke('send-alert-email', {
      body: {
        to_email: toEmail,
        maps_link: mapsLink,
        time,
        incident_id: incidentId,
      },
    });
    if (error) console.log('Email error for', toEmail, ':', error.message);
  };

  const sendEmailAlert = async (mapsLink, incidentId) => {
    const time = new Date().toLocaleString('en-GB');
    try {
      if (alertEmail) await sendSingleEmail(alertEmail, mapsLink, time, incidentId);
      if (alertEmail2) await sendSingleEmail(alertEmail2, mapsLink, time, incidentId);
    } catch (e) { console.log('Email error:', e); }
  };

  const shareApp = async () => {
    try {
      await Share.share({ message: t.shareAppMessage });
    } catch (e) {}
  };

  const reportBug = async () => {
    const subject = encodeURIComponent(t.bugSubject);
    const url = `mailto:beachguard.app@gmail.com?subject=${subject}`;
    try {
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert(t.mailAlertTitle, t.mailErrorMsg);
    }
  };

  const uploadPhoto = async (uri, type, id) => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const filename = `${id}/${type}_${Date.now()}.jpg`;
      // Pas d'URL signée générée ici : le rapport d'incident (incident-report)
      // regénère ses propres URLs signées à la demande, à partir du dossier
      // de stockage `${id}/` — voir supabase/functions/incident-report.
      const { error } = await supabase.storage.from('beachguard-photos').upload(filename, blob, { contentType: 'image/jpeg', upsert: false });
      if (error) console.log('uploadPhoto error:', error.message);
      else console.log('uploadPhoto OK:', filename);
    } catch (e) { console.log('uploadPhoto exception:', String(e)); }
  };

  const takePhotos = async (id) => {
    if (!cameraRef.current) { console.log('takePhotos: cameraRef not ready'); return; }
    try {
      const front = await cameraRef.current.takePictureAsync({ quality: 0.5 });
      await uploadPhoto(front.uri, 'front', id);
    } catch (e) { console.log('takePhotos exception:', String(e)); }
  };

  const startPhotoSession = (id) => {
    takePhotos(id);
    photoIntervalRef.current = setInterval(() => takePhotos(id), PHOTO_INTERVAL);
    photoTimeoutRef.current = setTimeout(() => clearInterval(photoIntervalRef.current), PHOTO_DURATION);
  };

  const startLocationTracking = async (id) => {
    try {
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude: lat, longitude: lng } = current.coords;
      const mapsLink = `https://maps.google.com/?q=${lat},${lng}`;
      await supabase.from('incidents').upsert({ id, lat, lng, user_id: session.user.id, updated_at: new Date().toISOString() });
      sendEmailAlert(mapsLink, id);
      locationWatchRef.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 30000, distanceInterval: 10 },
        async (loc) => {
          const { latitude: lat2, longitude: lng2 } = loc.coords;
          await supabase.from('incidents').upsert({ id, lat: lat2, lng: lng2, user_id: session.user.id, updated_at: new Date().toISOString() });
        }
      );
    } catch (e) { sendEmailAlert(null, id); }
  };

  const stopTracking = () => {
    if (photoIntervalRef.current) clearInterval(photoIntervalRef.current);
    if (photoTimeoutRef.current) clearTimeout(photoTimeoutRef.current);
    if (locationWatchRef.current) locationWatchRef.current.remove();
  };

  const startCountdown = () => {
    setCounting(true);
    setCountdown(countdownDuration);
    Vibration.vibrate([0, 200, 100, 200], true);
    speakDeterrentMessage();
    playBeep();
    let count = countdownDuration;
    countdownRef.current = setInterval(() => {
      count -= 1;
      setCountdown(count);
      Vibration.vibrate([0, 150], false);
      playBeep();
      if (count <= 0) { clearInterval(countdownRef.current); setCounting(false); triggerAlarm(); }
    }, 1000);
  };

  const triggerAlarm = async () => {
    setAlarmActive(true);
    Vibration.vibrate([0, 500, 200, 500], true);
    playSound(null, true);
    const id = `incident_${Date.now()}`;
    startPhotoSession(id);
    startLocationTracking(id);
  };

  const unlock = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: t.unlockPrompt,
        fallbackLabel: t.enterPasscode,
        disableDeviceFallback: false,
      });
      if (result.success) disarm();
      // Si result.success est false (échec, annulation, appareil sans
      // authentification configurée) : on ne fait RIEN. L'alarme reste
      // active. C'est volontaire — une app anti-vol doit échouer fermée,
      // jamais ouverte.
    } catch (e) {
      // Idem en cas d'erreur technique : on ne désarme jamais par défaut.
    }
  };

  const disarm = async () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    Vibration.cancel();
    await stopSound();
    stopTracking();
    setAlarmActive(false);
    setCounting(false);
    setArmed(false);
    setCountdown(countdownDuration);
  };

  const arm = () => {
    if (noPasscode || photoConsentGiven !== true) return; // Sécurité : jamais armer sans désarmement possible ni consentement photo
    setTimeout(() => setArmed(true), 3000);
  };

  const previewSiren = async (siren) => {
    try {
      if (soundRef.current) { await soundRef.current.stopAsync(); await soundRef.current.unloadAsync(); soundRef.current = null; }
      const { sound } = await Audio.Sound.createAsync(siren.file, { shouldPlay: true, isLooping: false, volume: 1.0 });
      soundRef.current = sound;
      let playCount = 0;
      sound.setOnPlaybackStatusUpdate(async (status) => {
        if (status.didJustFinish) {
          playCount += 1;
          if (playCount < 3) {
            try { await sound.replayAsync(); } catch (e) {}
          } else {
            try { await sound.stopAsync(); await sound.unloadAsync(); } catch (e) {}
            if (soundRef.current === sound) soundRef.current = null;
          }
        }
      });
    } catch (e) {}
  };

  const signOut = async () => {
    try { await supabase.auth.signOut(); } catch (e) {}
  };

  if (authLoading) {
    return (
      <View style={[s.darkScreen, { gap: 0 }]}>
        <ActivityIndicator size="large" color="#7ab8ff" />
      </View>
    );
  }

  if (!session) {
    return <PhoneAuthScreen t={t} />;
  }

  if (photoConsentGiven === null) {
    return (
      <View style={[s.darkScreen, { gap: 0 }]}>
        <ActivityIndicator size="large" color="#7ab8ff" />
      </View>
    );
  }

  if (photoConsentGiven === false) {
    return <PhotoConsentScreen t={t} onAccept={acceptPhotoConsent} />;
  }

  if (alarmActive) {
    return (
      <View style={s.darkScreen}>
        <CameraView style={{ width: 0, height: 0 }} ref={cameraRef} facing={facingRef.current} />
        <Gyrophare t={t} />
        <DisarmSlider onDisarm={unlock} label={t.disarmLabel} />
      </View>
    );
  }

  if (counting) {
    return (
      <View style={s.darkScreen}>
        {/* Caméra déjà montée ici (et non seulement sur l'écran alarmActive suivant)
            pour que cameraRef.current soit prêt avant le tout premier takePhotos(),
            déclenché dès la fin du compte à rebours. */}
        <CameraView style={{ width: 0, height: 0 }} ref={cameraRef} facing={facingRef.current} />
        <Text style={s.countdownNum}>{countdown}</Text>
        <Text style={s.countdownLabel}>{t.countdownLabel}</Text>
        <DisarmSlider onDisarm={unlock} label={t.disarmLabel} />
      </View>
    );
  }

  if (armed) {
    return (
      <>
        <CameraView style={{ width: 0, height: 0 }} ref={cameraRef} facing={facingRef.current} />
        <ArmedScreen onUnlock={unlock} t={t} />
      </>
    );
  }

  return (
    <View style={s.homeScreen}>
      <CameraView style={{ width: 0, height: 0 }} ref={cameraRef} facing={facingRef.current} />
      <Image source={BG_IMAGES[bgIndex]} style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, width: '100%', height: '100%' }} resizeMode="cover" />

      <View style={s.topWarning}>
        <Text style={s.warningTitle}>⚠ {t.warningTitle}</Text>
        <Text style={s.warningText}>{t.warningText}</Text>
      </View>

      <View style={s.bottomArea}>
        <View style={s.sliderRow}>
          {noPasscode ? (
            <View style={s.lockWarningBox}>
              <Text style={s.lockWarningTitle}>⚠ {t.noPasscodeTitle}</Text>
              <Text style={s.lockWarningText}>{t.noPasscodeText}</Text>
            </View>
          ) : (
            <ActivateSlider onArm={arm} label={t.activateLabel} />
          )}
          <TouchableOpacity onPress={() => setShowSettings(true)} style={s.gearBtn}>
            <Text style={s.gearIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>
        <View style={s.footerBg}>
          <Text style={s.howToText}>{t.howTo1} · {t.howTo2} · {t.howTo3}</Text>
        </View>
      </View>

      <Modal visible={showSettings} animationType="slide">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView style={s.modal} contentContainerStyle={{ paddingBottom: 60 }}>
            <Text style={s.modalTitle}>{t.settingsTitle}</Text>
            <View style={s.modalTitleAccent} />

            <Text style={s.sectionTitle}>{t.sectionAccount}</Text>
            <View style={s.sliderContainer}>
              <Text style={s.inputHint}>{t.connectedAs} +{session?.user?.phone}</Text>
              <TouchableOpacity style={s.bugBtn} onPress={signOut}>
                <Text style={s.bugText}>{t.signOutBtn}</Text>
              </TouchableOpacity>
            </View>

            <Text style={s.sectionTitle}>{t.sectionLanguage}</Text>
            <View style={s.row}>
              {LANGUAGES.map(l => (
                <TouchableOpacity key={l.code} style={[s.langChip, language === l.code && s.langChipActive]} onPress={() => setLanguage(l.code)}>
                  <Text style={s.langFlag}>{l.flag}</Text>
                  <Text style={[s.langCode, language === l.code && s.langCodeActive]}>{l.code.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.sectionTitle}>{t.sectionContacts}</Text>
            <TextInput style={s.input} placeholder={t.email1Placeholder} placeholderTextColor="#555" value={alertEmail} onChangeText={setAlertEmail} keyboardType="email-address" autoCapitalize="none" />
            <TextInput style={s.input} placeholder={t.email2Placeholder} placeholderTextColor="#555" value={alertEmail2} onChangeText={setAlertEmail2} keyboardType="email-address" autoCapitalize="none" />
            <Text style={s.inputHint}>{t.contactsHint}</Text>

            <View style={s.addContactRow}>
              <TouchableOpacity style={s.pickContactBtn} onPress={pickContact}>
                <Text style={s.pickContactIcon}>👤</Text>
                <Text style={s.pickContactLabel}>{t.pickContactLabel}</Text>
              </TouchableOpacity>
              <TextInput
                style={[s.input, { flex: 1, marginBottom: 0 }]}
                placeholder={t.addContactPlaceholder}
                placeholderTextColor="#555"
                value={newContactPhone}
                onChangeText={setNewContactPhone}
                keyboardType="phone-pad"
                autoCapitalize="none"
              />
              <TouchableOpacity style={[s.addContactBtn, contactLoading && { opacity: 0.6 }]} onPress={addContact} disabled={contactLoading}>
                <Text style={s.addContactBtnText}>{t.addContactBtn}</Text>
              </TouchableOpacity>
            </View>
            {!!contactError && <Text style={[s.inputHint, { color: '#ff6b6b' }]}>{contactError}</Text>}

            {contacts.length === 0 ? (
              <Text style={s.inputHint}>{t.noContactsYet}</Text>
            ) : (
              contacts.map(c => (
                <View key={c.id} style={s.contactRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.contactPhone}>{c.contact_phone}</Text>
                    <Text style={s.contactStatus}>{c.contact_user_id ? t.contactStatusActive : t.contactStatusPending}</Text>
                  </View>
                  <TouchableOpacity style={s.removeContactBtn} onPress={() => removeContact(c.id)}>
                    <Text style={s.removeContactText}>{t.removeContactBtn}</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}

            <TouchableOpacity style={s.shareBtn} onPress={shareApp}>
              <Text style={s.shareText}>{t.shareAppBtn}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.bugBtn} onPress={reportBug}>
              <Text style={s.bugText}>{t.bugReportBtn}</Text>
            </TouchableOpacity>

            <Text style={s.sectionTitle}>{t.sectionSensitivity}</Text>
            <View style={s.sliderContainer}>
              <View style={s.sliderLabels}>
                <Text style={s.sliderLabel}>{t.sensVeryHigh}</Text>
                <Text style={s.sliderLabelCenter}>{t.sensMedium}</Text>
                <Text style={s.sliderLabel}>{t.sensLow}</Text>
              </View>
              <Slider
                style={{ width: '100%', height: 50 }}
                minimumValue={SENSITIVITY_MIN}
                maximumValue={SENSITIVITY_MAX}
                value={sensitivityValue}
                onValueChange={setSensitivityValue}
                minimumTrackTintColor="#ff4444"
                maximumTrackTintColor="#4caf50"
                thumbTintColor="#ffffff"
                step={0.05}
              />
              <Text style={s.sliderValue}>
                {t.sensCurrent}: {sensitivityValue <= 1.3 ? t.sensMaximum : sensitivityValue <= 1.7 ? t.sensVeryHigh : sensitivityValue <= 2.2 ? t.sensMedium : sensitivityValue <= 2.6 ? t.sensLow : t.sensMinimum}
              </Text>
            </View>

            <Text style={s.sectionTitle}>{t.sectionCountdown}</Text>
            <View style={s.row}>
              {COUNTDOWNS.map(d => (
                <TouchableOpacity key={d} style={[s.chip, countdownDuration === d && s.chipActive]} onPress={() => { setCountdownDuration(d); setCountdown(d); }}>
                  <Text style={[s.chipText, countdownDuration === d && s.chipTextActive]}>{d}s</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={s.sectionTitle}>{t.sectionSound}</Text>
            <View style={s.sirenRow}>
              <TouchableOpacity style={[s.sirenItem, s.sirenActive]} onPress={() => setSirenPickerOpen(v => !v)}>
                <Text style={s.sirenCheck}>{sirenPickerOpen ? '▲' : '▼'}</Text>
                <Text style={s.sirenText}>{t.sirenNames[selectedSiren.id - 1]}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.previewBtn} onPress={() => previewSiren(selectedSiren)}>
                <Text style={s.previewText}>{t.listenBtn}</Text>
              </TouchableOpacity>
            </View>
            {sirenPickerOpen && SIRENS.map(siren => {
              const selected = selectedSiren.id === siren.id;
              return (
                <View key={siren.id} style={s.sirenRow}>
                  <TouchableOpacity style={[s.sirenItem, selected && s.sirenActive]} onPress={() => { setSelectedSiren(siren); setSirenPickerOpen(false); }}>
                    <Text style={[s.sirenCheck, { opacity: selected ? 1 : 0 }]}>✓</Text>
                    <Text style={s.sirenText}>{t.sirenNames[siren.id - 1]}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.previewBtn} onPress={() => previewSiren(siren)}>
                    <Text style={s.previewText}>{t.listenBtn}</Text>
                  </TouchableOpacity>
                </View>
              );
            })}

            <Text style={s.sectionTitle}>{t.sectionVoice}</Text>
            {availableVoices.length === 0 && <Text style={s.inputHint}>{t.noVoicesFound}</Text>}
            {availableVoices.length > 0 && (() => {
              const currentVoice = availableVoices.find(v => v.identifier === selectedVoiceId) || availableVoices[0];
              return (
                <>
                  <View style={s.sirenRow}>
                    <TouchableOpacity style={[s.sirenItem, s.sirenActive]} onPress={() => setVoicePickerOpen(v => !v)}>
                      <Text style={s.sirenCheck}>{voicePickerOpen ? '▲' : '▼'}</Text>
                      <Text style={s.sirenText}>{currentVoice.name}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.previewBtn} onPress={() => previewVoice(currentVoice)}>
                      <Text style={s.previewText}>{t.listenBtn}</Text>
                    </TouchableOpacity>
                  </View>
                  {voicePickerOpen && availableVoices.map(voice => {
                    const selected = currentVoice.identifier === voice.identifier;
                    return (
                      <View key={voice.identifier} style={s.sirenRow}>
                        <TouchableOpacity style={[s.sirenItem, selected && s.sirenActive]} onPress={() => { setSelectedVoiceId(voice.identifier); setVoicePickerOpen(false); }}>
                          <Text style={[s.sirenCheck, { opacity: selected ? 1 : 0 }]}>✓</Text>
                          <Text style={s.sirenText}>{voice.name}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.previewBtn} onPress={() => previewVoice(voice)}>
                          <Text style={s.previewText}>{t.listenBtn}</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </>
              );
            })()}

            {photoConsentDate && (
              <>
                <Text style={s.sectionTitle}>{t.sectionPhotoConsent}</Text>
                <Text style={s.inputHint}>
                  {t.photoConsentAcceptedLabel} {new Date(photoConsentDate).toLocaleString()}
                </Text>
                <Text style={[s.inputHint, { marginTop: 6 }]}>{t.photoConsentText}</Text>
              </>
            )}

            <TouchableOpacity style={s.saveBtn} onPress={saveSettings}>
              <Text style={s.saveText}>{settingsSaved ? t.savedBtn : t.saveBtn}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.closeBtn} onPress={() => setShowSettings(false)}>
              <Text style={s.closeText}>{t.closeBtn}</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const g = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  ring3: { position: 'absolute', width: 290, height: 290, borderRadius: 145, backgroundColor: '#ff2222', opacity: 0.08 },
  ring2: { position: 'absolute', width: 240, height: 240, borderRadius: 120, backgroundColor: '#ff2222', opacity: 0.15 },
  ring1: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: '#ff2222', opacity: 0.25 },
  base: { width: 140, height: 140, borderRadius: 70, backgroundColor: '#1a2540', borderWidth: 4, borderColor: '#2a3a60', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  domeRed: { position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: '#ff2222' },
  domeBlue: { position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: '#1a73e8', left: 70 },
  beamContainer: { position: 'absolute', width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
  beamRed: { position: 'absolute', left: 40, top: 34, width: 100, height: 12, backgroundColor: 'rgba(255,60,60,0.7)', borderRadius: 6 },
  beamBlue: { position: 'absolute', right: 40, top: 34, width: 100, height: 12, backgroundColor: 'rgba(30,120,255,0.7)', borderRadius: 6 },
  alarmText: { marginTop: 32, fontSize: 32, fontWeight: '700', color: '#ff4444', letterSpacing: 6 },
  subText: { marginTop: 8, fontSize: 13, color: '#4a6080', letterSpacing: 3 },
});

const a = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#3d0000', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, paddingTop: 60 },

  glowRing: { position: 'absolute', width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(255,50,50,0.15)', borderWidth: 2, borderColor: 'rgba(255,80,80,0.4)' },
  shieldContainer: { position: 'relative', alignItems: 'center', justifyContent: 'center', width: 330, height: 330 },
  shieldImage: { width: 300, height: 300 },
  shieldGlow: {
    position: 'absolute',
    width: 360, height: 360,
    borderRadius: 180,
    backgroundColor: 'rgba(100,180,255,0.15)',
    shadowColor: '#60aaff',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 30,
    shadowOpacity: 1,
  },
  armedText: { fontSize: 36, fontWeight: '700', color: '#ffffff', letterSpacing: 6 },
  subText: { fontSize: 15, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
  badge: { backgroundColor: 'rgba(76,175,80,0.25)', borderWidth: 1, borderColor: '#4caf50', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 24 },
  badgeText: { color: '#4caf50', fontSize: 14, fontWeight: '700', letterSpacing: 2 },
});

const s = StyleSheet.create({
  homeScreen: { flex: 1 },
  darkScreen: { flex: 1, backgroundColor: '#0a1628', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 24 },
  topWarning: { position: 'absolute', top: 55, left: 16, right: 16, backgroundColor: 'rgba(0,0,0,0.82)', borderWidth: 1.5, borderColor: '#f0b429', borderRadius: 14, padding: 14, alignItems: 'center', zIndex: 10 },
  warningTitle: { color: '#f0b429', fontSize: 15, fontWeight: '700', letterSpacing: 1, marginBottom: 5, textAlign: 'center' },
  warningText: { color: '#ffffff', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  bottomArea: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' },
  sliderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, marginTop: -34 },
  lockWarningBox: { flex: 1, backgroundColor: 'rgba(255,56,96,0.12)', borderWidth: 1.5, borderColor: '#ff3860', borderRadius: 16, padding: 14 },
  lockWarningTitle: { color: '#ff3860', fontSize: 14, fontWeight: '800', marginBottom: 4 },
  lockWarningText: { color: '#ffffff', fontSize: 12.5, lineHeight: 17 },
  gearBtn: { marginLeft: 12, padding: 8 },
  gearIcon: { fontSize: 26, color: '#ffffff' },
  footerBg: { width: '100%', backgroundColor: 'rgba(0,0,0,0.78)', paddingTop: 8, paddingBottom: 16, paddingHorizontal: 24, alignItems: 'center', gap: 4 },
  howToText: { fontSize: 13, color: '#ffffff', textAlign: 'center', lineHeight: 22, fontWeight: '500' },
  countdownNum: { fontSize: 120, fontWeight: '700', color: '#f28b30' },
  countdownLabel: { fontSize: 18, color: '#ffffff' },
  modal: { flex: 1, backgroundColor: '#050a14', padding: 24, paddingTop: 60 },
  modalTitle: { fontSize: 26, fontWeight: '800', color: '#eaf4ff', marginBottom: 8, letterSpacing: 1 },
  modalTitleAccent: { width: 46, height: 3, backgroundColor: '#33e0ff', borderRadius: 2, marginBottom: 24, shadowColor: '#33e0ff', shadowOpacity: 0.7, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  sectionTitle: { fontSize: 11, color: '#33e0ff', marginBottom: 14, marginTop: 30, letterSpacing: 3, fontWeight: '800' },
  input: { backgroundColor: 'rgba(51,224,255,0.05)', borderRadius: 12, padding: 16, color: '#eaf4ff', fontSize: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(122,184,255,0.22)' },
  inputHint: { fontSize: 12.5, color: '#7f93b8', marginBottom: 8, lineHeight: 19 },
  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  sliderContainer: { width: '100%', backgroundColor: 'rgba(51,224,255,0.04)', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: 'rgba(51,224,255,0.18)' },
  sliderLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  sliderLabel: { color: '#7f93b8', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  sliderLabelCenter: { color: '#7f93b8', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  sliderValue: { color: '#33e0ff', fontSize: 13, fontWeight: '800', textAlign: 'center', marginTop: 4, letterSpacing: 1 },
  chip: { borderWidth: 1, borderColor: 'rgba(122,184,255,0.28)', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18, backgroundColor: 'rgba(255,255,255,0.02)' },
  chipThird: { flexGrow: 1, flexBasis: '28%', alignItems: 'center' },
  langChip: { flexGrow: 1, flexBasis: '13%', minWidth: 46, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(122,184,255,0.28)', borderRadius: 10, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.02)' },
  langChipActive: { backgroundColor: 'rgba(51,224,255,0.14)', borderColor: '#33e0ff', shadowColor: '#33e0ff', shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  langFlag: { fontSize: 20, marginBottom: 3 },
  langCode: { color: '#7f93b8', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  langCodeActive: { color: '#33e0ff' },
  chipActive: { backgroundColor: 'rgba(51,224,255,0.14)', borderColor: '#33e0ff', shadowColor: '#33e0ff', shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  chipText: { color: '#7f93b8', fontSize: 14, fontWeight: '700' },
  chipTextActive: { color: '#33e0ff', fontWeight: '800', fontSize: 14 },
  sirenRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  sirenItem: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(122,184,255,0.18)', backgroundColor: 'rgba(255,255,255,0.02)' },
  sirenActive: { borderColor: '#33e0ff', backgroundColor: 'rgba(51,224,255,0.10)', shadowColor: '#33e0ff', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 0 } },
  sirenCheck: { width: 22, textAlign: 'center', color: '#33e0ff', fontSize: 16, fontWeight: '800' },
  addContactRow: { flexDirection: 'row', gap: 8, marginTop: 6, marginBottom: 4, alignItems: 'center' },
  pickContactBtn: { backgroundColor: 'rgba(51,224,255,0.06)', borderRadius: 12, paddingVertical: 8, minWidth: 62, height: 52, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(51,224,255,0.3)' },
  pickContactIcon: { fontSize: 15 },
  pickContactLabel: { fontSize: 8.5, color: '#33e0ff', fontWeight: '800', marginTop: 1, letterSpacing: 0.3 },
  addContactBtn: { backgroundColor: '#33e0ff', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 16, justifyContent: 'center', alignItems: 'center', shadowColor: '#33e0ff', shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 0 } },
  addContactBtnText: { color: '#050a14', fontSize: 14, fontWeight: '800' },
  contactRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 12, padding: 14, marginTop: 8, borderWidth: 1, borderColor: 'rgba(122,184,255,0.18)' },
  contactPhone: { color: '#eaf4ff', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
  contactStatus: { color: '#33e0ff', fontSize: 11, marginTop: 2, fontWeight: '600', letterSpacing: 0.3 },
  removeContactBtn: { paddingVertical: 8, paddingHorizontal: 12, marginLeft: 10 },
  removeContactText: { color: '#ff3860', fontSize: 13, fontWeight: '800' },
  sirenText: { flex: 1, color: '#eaf4ff', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  previewBtn: { marginLeft: 10, paddingVertical: 16, paddingHorizontal: 16, backgroundColor: 'rgba(51,224,255,0.10)', borderRadius: 12, borderWidth: 1, borderColor: 'rgba(51,224,255,0.25)' },
  previewText: { color: '#33e0ff', fontSize: 13, fontWeight: '800' },
  shareBtn: { marginTop: 16, backgroundColor: 'rgba(51,224,255,0.08)', borderRadius: 14, paddingVertical: 18, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(51,224,255,0.35)' },
  bugBtn: { marginTop: 10, backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 14, paddingVertical: 18, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(122,184,255,0.18)' },
  bugText: { color: '#7f93b8', fontSize: 14, fontWeight: '700', textAlign: 'center', letterSpacing: 0.5 },
  shareText: { color: '#33e0ff', fontSize: 15, fontWeight: '800', textAlign: 'center', letterSpacing: 0.3 },
  saveBtn: { marginTop: 30, backgroundColor: '#00ff88', borderRadius: 14, paddingVertical: 20, alignItems: 'center', shadowColor: '#00ff88', shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } },
  saveText: { color: '#050a14', fontSize: 16, fontWeight: '800', letterSpacing: 1 },
  closeBtn: { marginTop: 12, backgroundColor: 'transparent', borderRadius: 14, paddingVertical: 18, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(122,184,255,0.25)' },
  closeText: { color: '#7f93b8', fontSize: 14, fontWeight: '700', letterSpacing: 1 },
});
