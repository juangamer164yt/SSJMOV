/* =====================================================================
   VÍA — INTERACCIONES DE LA INTERFAZ Y FORMULARIO DE LA ENCUESTA
   1. Menú móvil   2. Tema claro/oscuro   3. Formulario generado desde el
   catálogo (preguntas.js)   4. Progreso, validación y envío.
   Todo va dentro de una función anónima para no crear variables globales.
   ===================================================================== */
(() => {
"use strict";

const root = document.documentElement;
const body = document.body;
const menuToggle = document.querySelector("#menuToggle");
const closeMenuButton = document.querySelector("#closeMenu");
const sidebar = document.querySelector("#sidebar");
const scrim = document.querySelector("#scrim");
const themeToggle = document.querySelector("#themeToggle");
const themeIcon = document.querySelector("#themeIcon");
const form = document.querySelector("#mobilityForm");
const questionsBox = document.querySelector("#preguntas");
const progressBar = document.querySelector("#progressBar");
const progressFill = document.querySelector("#progressFill");
const progressLabel = document.querySelector("#progressLabel");
const formError = document.querySelector("#formError");
const successState = document.querySelector("#successState");
const resetFormButton = document.querySelector("#resetForm");
const submitButton = form.querySelector(".submit-button");

/** Abre o cierra la navegación móvil y mantiene el estado accesible. */
const setMenuOpen = (isOpen) => {
  body.classList.toggle("menu-open", isOpen);
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  if (isOpen) closeMenuButton.focus();
  else menuToggle.focus();
};

menuToggle.addEventListener("click", () => setMenuOpen(true));
closeMenuButton.addEventListener("click", () => setMenuOpen(false));
scrim.addEventListener("click", () => setMenuOpen(false));

sidebar.querySelectorAll("a").forEach((link) => {
  link.addEventListener("click", () => {
    if (window.matchMedia("(max-width: 760px)").matches) {
      body.classList.remove("menu-open");
      menuToggle.setAttribute("aria-expanded", "false");
    }
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && body.classList.contains("menu-open")) {
    setMenuOpen(false);
  }
});

/** Cambia entre tema oscuro (predeterminado) y claro. El CSS reacciona al atributo data-theme de <html>. */
themeToggle.addEventListener("click", () => {
  const isLight = root.dataset.theme !== "light";
  if (isLight) root.dataset.theme = "light";
  else delete root.dataset.theme;
  // Que la barra del navegador en móvil también combine con el tema.
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", isLight ? "#f1eef4" : "#242326");

  themeIcon.textContent = isLight ? "☾" : "☼";
  themeToggle.setAttribute("aria-label", isLight ? "Activar tema oscuro" : "Activar tema claro");
});

/* ---------- Formulario generado desde el catálogo (preguntas.js) ---------- */

/** Dibuja datos personales + las 12 preguntas con los identificadores del catálogo.
    Cada bloque es una <section> con su título; cada pregunta, un <fieldset> con <legend>. */
const renderForm = () => {
  const pad = (n) => String(n).padStart(2, "0");
  const letter = (i) => String.fromCharCode(65 + i);
  // La opción que queda "fuera" del Venn es excluyente: no se puede combinar con las demás.
  const exclusive = (p, value) => (p.venn && p.venn.fuera === value ? ' data-exclusive="true"' : "");

  const question = (p) => {
    const type = p.tipo === "multiple" ? "checkbox" : "radio";
    const options = p.opciones.map(([value, label], i) =>
      `<li><label class="choice"><input type="${type}" name="${p.id}" value="${value}"${exclusive(p, value)} required>` +
      `<span class="choice-icon" aria-hidden="true">${letter(i)}</span><span>${label}</span></label></li>`).join("");
    return `<fieldset class="form-fieldset"><legend><span class="question-number">${pad(p.n)}</span> ${p.texto}</legend>` +
      (p.ayuda ? `<p class="field-hint">${p.ayuda}</p>` : "") + `<ul class="choice-grid">${options}</ul></fieldset>`;
  };

  const section = (id, label, title, content) =>
    `<section class="form-block" aria-labelledby="${id}"><h3 class="block-title" id="${id}"><strong>${label}</strong> ${title}</h3>${content}</section>`;

  let html = section("bloque-datos", "DATOS", "Participante", `<div class="field-row">
      <div class="text-field"><label for="codigo">Código de invitación</label>
        <input class="text-input" type="text" id="codigo" name="codigo" maxlength="29" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" required>
        <span class="field-hint">Cada código permite enviar una sola respuesta.</span></div>
      <div class="text-field"><label for="nombres">Nombres</label>
        <input class="text-input" type="text" id="nombres" name="nombres" maxlength="100" autocomplete="given-name" placeholder="Tus nombres" required></div>
      <div class="text-field"><label for="apellidos">Apellidos</label>
        <input class="text-input" type="text" id="apellidos" name="apellidos" maxlength="100" autocomplete="family-name" placeholder="Tus apellidos" required></div>
    </div>`);

  BLOQUES.forEach((title, index) => {
    const block = index + 1;
    html += section(`bloque-${block}`, `BLOQUE ${block}`, title, PREGUNTAS.filter((p) => p.bloque === block).map(question).join(""));
  });
  questionsBox.innerHTML = html;
};

/** Selección múltiple: con una opción marcada deja de ser obligatorio marcar las demás. */
const syncMultiple = () => {
  PREGUNTAS.filter((p) => p.tipo === "multiple").forEach((p) => {
    const inputs = [...form.querySelectorAll(`input[name="${p.id}"]`)];
    const anyChecked = inputs.some((input) => input.checked);
    inputs.forEach((input) => { input.required = !anyChecked; });
  });
};

/** La opción excluyente (data-exclusive) no se combina: al marcarla se desmarcan las demás y viceversa. */
form.addEventListener("change", (event) => {
  const input = event.target;
  if (input.type !== "checkbox") return;
  if (input.checked) {
    form.querySelectorAll(`input[name="${input.name}"]`).forEach((other) => {
      const involvesExclusive = input.dataset.exclusive === "true" || other.dataset.exclusive === "true";
      if (other !== input && involvesExclusive) other.checked = false;
    });
  }
  syncMultiple();
});

form.addEventListener("input", (event) => {
  const input = event.target;
  if (input.name === "nombres" || input.name === "apellidos") {
    input.value = input.value.replace(/\p{N}/gu, "");
  }
});

/** Progreso = campos obligatorios respondidos (datos + 12 preguntas + autorización). */
const requiredFieldNames = ["codigo", "nombres", "apellidos", ...PREGUNTAS.map((p) => p.id)];

const isAnswered = (name) => {
  if (form.querySelector(`input[name="${name}"]:checked`)) return true;
  const field = form.elements[name];
  return Boolean(field && field.type === "text" && field.value.trim());
};

const updateProgress = () => {
  const completed = requiredFieldNames.filter(isAnswered).length + (form.elements.consentimiento.checked ? 1 : 0);
  const percentage = Math.round((completed / (requiredFieldNames.length + 1)) * 100);
  progressFill.style.width = `${percentage}%`;
  progressLabel.textContent = `${percentage}% completado`;
  progressBar.setAttribute("aria-valuenow", String(percentage));
};

form.addEventListener("input", updateProgress);
form.addEventListener("change", updateProgress);

/** Arma el objeto con los identificadores de la base de datos. */
const collectData = () => {
  const data = {
    codigo: form.elements.codigo.value.trim(),
    nombres: form.elements.nombres.value.trim(),
    apellidos: form.elements.apellidos.value.trim(),
    consentimiento: form.elements.consentimiento.checked,
  };
  PREGUNTAS.forEach((p) => {
    const checked = [...form.querySelectorAll(`input[name="${p.id}"]:checked`)].map((input) => input.value);
    data[p.id] = p.tipo === "multiple" ? checked : checked[0];
  });
  return data;
};

/** Envía al servidor (o al modo demo) y devuelve un error legible si algo falla. */
const sendAnswers = async (data) => {
  if (USAR_DEMO) return demoEnviar(data);
  let response;
  try {
    response = await fetch("/api/respuestas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  } catch {
    throw new Error("No hay conexión con el servidor. Inténtalo de nuevo en un momento.");
  }
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.error || "No se pudo enviar tu respuesta. Inténtalo de nuevo.");
  }
};

const showError = (message) => {
  formError.textContent = message;
  formError.hidden = false;
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  formError.hidden = true;
  formError.textContent = "";

  if (!form.checkValidity()) {
    showError("Revisa las preguntas obligatorias y acepta la autorización para continuar.");
    form.reportValidity();
    return;
  }

  submitButton.disabled = true;
  try {
    await sendAnswers(collectData());
    document.dispatchEvent(new Event("respuesta-enviada")); // la sección de estadísticas se actualiza al instante
    form.hidden = true;
    successState.hidden = false;
    successState.focus();
  } catch (error) {
    showError(error.message);
  } finally {
    submitButton.disabled = false;
  }
});

resetFormButton.addEventListener("click", () => {
  form.reset();
  form.elements.codigo.value = "";
  form.hidden = false;
  successState.hidden = true;
  formError.hidden = true;
  syncMultiple();
  updateProgress();
  form.elements.nombres.focus();
});

renderForm();
syncMultiple();
updateProgress();
})();
