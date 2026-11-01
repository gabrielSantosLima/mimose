const STORAGE_KEY = "mimose.language";
const DEFAULT_LANGUAGE = "en";
const SUPPORTED_LANGUAGES = ["en", "pt-BR", "es"];

const messages = {
  en: {
    "meta.description":
      "Upload an image and watch its pixels reassemble into a reference portrait.",
    "masthead.note": "pixel morph study",
    "settings.label": "Language",
    "settings.aria": "Language settings",
    "intro.eyebrow": "Source in, portrait out",
    "intro.titleLine1": "Your image,",
    "intro.titleLine2": "reassembled.",
    "intro.lede":
      "Upload an image. Its pixels break apart, drift, and settle into one of the reference portraits.",
    "upload.title": "Source image",
    "upload.meta": "In-browser",
    "upload.dropTitle": "Drop an image here",
    "upload.dropHint": "or choose a file · JPEG, PNG, WebP",
    "upload.replace": "Replace",
    "upload.waiting": "Waiting for an image.",
    "upload.preparing": "Preparing the morph…",
    "footer.local": "Local only · nothing leaves your browser",
    "footer.referencesLoading": "References loading…",
    "footer.referencesReady": "{count} references ready",
    "footer.referencesUnavailable": "References unavailable",
    "stage.label": "Pixel morph",
    "stage.replay": "Replay",
    "stage.newImage": "New image",
    "stage.suspense": "your image became....",
    "stage.breaking": "Breaking the image apart…",
    "stage.drifting": "Drifting through the pixels…",
    "stage.reassembling": "Reassembling the portrait…",
    "stage.settled": "Settled.",
    "stage.fallback": "WebGL2 is unavailable — showing a simple crossfade.",
    "stage.contextLost": "The graphics context was lost. Try again.",
    "stage.contextLostStatus":
      "The graphics context was lost. Try another image.",
    "status.fileType": "Please choose an image file.",
    "status.tooLarge": "That image is too large. Try one under 25 MB.",
    "status.error": "Something went wrong. Try another image.",
  },
  "pt-BR": {
    "meta.description":
      "Envie uma imagem e veja seus pixels se reorganizarem em um retrato de referência.",
    "masthead.note": "estudo de morphing em pixels",
    "settings.label": "Idioma",
    "settings.aria": "Configurações de idioma",
    "intro.eyebrow": "Sua imagem, outro retrato",
    "intro.titleLine1": "Sua imagem,",
    "intro.titleLine2": "reconstruída.",
    "intro.lede":
      "Envie uma imagem. Seus pixels se desfazem, derivam e se acomodam em um dos retratos de referência.",
    "upload.title": "Imagem de origem",
    "upload.meta": "No navegador",
    "upload.dropTitle": "Solte uma imagem aqui",
    "upload.dropHint": "ou escolha um arquivo · JPEG, PNG, WebP",
    "upload.replace": "Substituir",
    "upload.waiting": "Aguardando uma imagem.",
    "upload.preparing": "Preparando o morph…",
    "footer.local": "Local · nada sai do seu navegador",
    "footer.referencesLoading": "Carregando referências…",
    "footer.referencesReady": "{count} referências prontas",
    "footer.referencesUnavailable": "Referências indisponíveis",
    "stage.label": "Morph de pixels",
    "stage.replay": "Repetir",
    "stage.newImage": "Nova imagem",
    "stage.suspense": "sua imagem virou....",
    "stage.breaking": "Desfazendo a imagem…",
    "stage.drifting": "Derivando entre os pixels…",
    "stage.reassembling": "Remontando o retrato…",
    "stage.settled": "Pronto.",
    "stage.fallback": "WebGL2 indisponível — mostrando um crossfade simples.",
    "stage.contextLost": "O contexto gráfico foi perdido. Tente novamente.",
    "stage.contextLostStatus":
      "O contexto gráfico foi perdido. Tente outra imagem.",
    "status.fileType": "Escolha um arquivo de imagem.",
    "status.tooLarge": "Essa imagem é muito grande. Tente uma com menos de 25 MB.",
    "status.error": "Algo deu errado. Tente outra imagem.",
  },
  es: {
    "meta.description":
      "Sube una imagen y observa cómo sus píxeles se reensamblan en un retrato de referencia.",
    "masthead.note": "estudio de morphing de píxeles",
    "settings.label": "Idioma",
    "settings.aria": "Configuración de idioma",
    "intro.eyebrow": "Imagen de entrada, retrato de salida",
    "intro.titleLine1": "Tu imagen,",
    "intro.titleLine2": "reconstruida.",
    "intro.lede":
      "Sube una imagen. Sus píxeles se separan, derivan y se asientan en uno de los retratos de referencia.",
    "upload.title": "Imagen de origen",
    "upload.meta": "En el navegador",
    "upload.dropTitle": "Suelta una imagen aquí",
    "upload.dropHint": "o elige un archivo · JPEG, PNG, WebP",
    "upload.replace": "Reemplazar",
    "upload.waiting": "Esperando una imagen.",
    "upload.preparing": "Preparando el morph…",
    "footer.local": "Local · nada sale de tu navegador",
    "footer.referencesLoading": "Cargando referencias…",
    "footer.referencesReady": "{count} referencias listas",
    "footer.referencesUnavailable": "Referencias no disponibles",
    "stage.label": "Morph de píxeles",
    "stage.replay": "Repetir",
    "stage.newImage": "Nueva imagen",
    "stage.suspense": "tu imagen se convirtió en....",
    "stage.breaking": "Deshaciendo la imagen…",
    "stage.drifting": "Derivando entre los píxeles…",
    "stage.reassembling": "Reensamblando el retrato…",
    "stage.settled": "Listo.",
    "stage.fallback":
      "WebGL2 no está disponible — mostrando un fundido simple.",
    "stage.contextLost": "Se perdió el contexto gráfico. Inténtalo de nuevo.",
    "stage.contextLostStatus":
      "Se perdió el contexto gráfico. Prueba con otra imagen.",
    "status.fileType": "Elige un archivo de imagen.",
    "status.tooLarge":
      "Esa imagen es demasiado grande. Prueba con una de menos de 25 MB.",
    "status.error": "Algo salió mal. Prueba con otra imagen.",
  },
};

let language = DEFAULT_LANGUAGE;

export function initI18n() {
  language = readLanguage();
  document.documentElement.lang = language;
  return language;
}

export function getLanguage() {
  return language;
}

export function setLanguage(nextLanguage) {
  language = SUPPORTED_LANGUAGES.includes(nextLanguage)
    ? nextLanguage
    : DEFAULT_LANGUAGE;
  document.documentElement.lang = language;

  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Storage can be unavailable in private or restricted contexts.
  }

  return language;
}

export function t(key, params = {}) {
  const template =
    messages[language]?.[key] ?? messages[DEFAULT_LANGUAGE]?.[key] ?? key;

  return template.replace(/\{(\w+)\}/g, (match, name) =>
    params[name] !== undefined ? String(params[name]) : match
  );
}

export function applyTranslations(root = document) {
  for (const element of root.querySelectorAll("[data-i18n]")) {
    element.textContent = t(element.dataset.i18n);
  }

  for (const element of root.querySelectorAll("[data-i18n-aria-label]")) {
    element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
  }

  const description = document.querySelector("#meta-description");
  if (description) {
    description.setAttribute("content", t("meta.description"));
  }
}

function readLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return SUPPORTED_LANGUAGES.includes(stored) ? stored : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}
