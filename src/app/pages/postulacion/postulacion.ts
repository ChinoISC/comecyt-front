import { Component, AfterViewInit, Inject, ViewEncapsulation } from '@angular/core';
import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';

@Component({
  selector: 'app-postulacion',
  standalone: true,
  imports: [],
  templateUrl: './postulacion.html',
  styleUrls: ['./postulacion.css'],     // <- plural
  encapsulation: ViewEncapsulation.None // para que :root/body apliquen sin pelea
})
export class PostulacionComponent implements AfterViewInit {

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    @Inject(DOCUMENT) private doc: Document
  ) {}

  ngAfterViewInit(): void {

// 3.a) Contadores
const t = document.getElementById('pubTitle') as HTMLInputElement | null;
const tc = document.getElementById('titleCounter');
t?.addEventListener('input', () => { if (tc) tc.textContent = `${t.value.length}/300`; });

const a = document.getElementById('pubAbstract') as HTMLTextAreaElement | null;
const ac = document.getElementById('absCounter');
a?.addEventListener('input', () => { if (ac) ac.textContent = `${a.value.length}/5000`; });

// 3.b) Dropzone visual (principal y suplementarios)
function wireDrop(id: string){
  const dz = document.getElementById(id);
  if (!dz) return;
  ['dragenter','dragover'].forEach(ev =>
    dz.addEventListener(ev, (e)=>{ e.preventDefault(); dz.classList.add('dragover'); })
  );
  ['dragleave','drop'].forEach(ev =>
    dz.addEventListener(ev, (e)=>{ e.preventDefault(); dz.classList.remove('dragover'); })
  );
}
wireDrop('fileDrop'); // principal
// La de suplentes reutiliza la misma clase, no necesita id propio

// 3.c) Campos dinámicos según tipo
const typeSel = document.getElementById('pubType') as HTMLSelectElement | null;
const fieldISBN = document.getElementById('fieldISBN');
const fieldJournal = document.getElementById('fieldJournal');
const fieldProject = document.getElementById('fieldProject');

function toggleByType(v: string){
  // Regla simple: libro/capítulo → ISBN; artículo/reporte → journal; todos → proyecto opcional visible
  const showISBN = v === 'libro' || v === 'capitulo';
  const showJournal = v === 'articulo' || v === 'reporte';

  fieldISBN?.classList.toggle('hidden', !showISBN);
  fieldJournal?.classList.toggle('hidden', !showJournal);
  fieldProject?.classList.remove('hidden');
}
typeSel?.addEventListener('change', () => toggleByType(typeSel.value));
if (typeSel) toggleByType(typeSel.value || '');



    // Ejecuta DOM-only solo en navegador (evita "document is not defined")
    if (!isPlatformBrowser(this.platformId)) return;

    const form = this.doc.getElementById('postulacionForm') as HTMLFormElement | null;
    if (!form) return;

    const submitBtn   = this.doc.getElementById('submitBtn') as HTMLButtonElement | null;
    const cvInput     = this.doc.getElementById('cv') as HTMLInputElement | null;
    const cvAlert     = this.doc.getElementById('cvAlert') as HTMLElement | null;
    const formMessage = this.doc.getElementById('formMessage') as HTMLElement | null;

    // CURP en mayúsculas y sin espacios
    const curp = this.doc.getElementById('curp') as HTMLInputElement | null;
    curp?.addEventListener('input', () => {
      curp.value = curp.value.toUpperCase().replace(/\s+/g,'');
    });

    // Teléfono: limpia caracteres no permitidos
    const tel = this.doc.getElementById('telefono') as HTMLInputElement | null;
    tel?.addEventListener('input', () => {
      tel.value = tel.value.replace(/[^\d()+\-\s]/g,'').replace(/\s{2,}/g,' ');
    });

    // Archivo: 5MB + nombre sin caracteres raros
    cvInput?.addEventListener('change', () => {
      if (!cvInput.files?.length) return;
      const f = cvInput.files[0];
      const nameOk = /^[\w\-. ]+$/.test(f.name);
      const sizeOk = f.size <= 5 * 1024 * 1024;

      let msg = '';
      if (!sizeOk) msg += 'El archivo supera 5 MB. ';
      if (!nameOk) msg += 'Evita caracteres especiales en el nombre.';

      if (cvAlert){
        cvAlert.style.display = msg ? 'block' : 'none';
        cvAlert.textContent = msg;
      }
      if (!sizeOk || !nameOk){
        cvInput.value = '';
        cvInput.classList.add('is-invalid');
      } else {
        cvInput.classList.remove('is-invalid');
      }
    });

    // Validación de correos coincidentes
    const correo = this.doc.getElementById('correo') as HTMLInputElement | null;
    const correoConfirm = this.doc.getElementById('correoConfirm') as HTMLInputElement | null;
    
    const validateEmailMatch = () => {
      if (correo && correoConfirm && correo.value && correoConfirm.value) {
        if (correo.value !== correoConfirm.value) {
          correoConfirm.setCustomValidity('Los correos no coinciden');
          correoConfirm.classList.add('is-invalid');
        } else {
          correoConfirm.setCustomValidity('');
          correoConfirm.classList.remove('is-invalid');
        }
      }
    };

    correo?.addEventListener('input', validateEmailMatch);
    correoConfirm?.addEventListener('input', validateEmailMatch);

    // Submit UX
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      event.stopPropagation();

      // Validar correos antes de submit
      validateEmailMatch();

      form.classList.add('was-validated');

      if (!form.checkValidity()){
        const firstInvalid = form.querySelector('.form-control:invalid') as HTMLElement | null;
        firstInvalid?.scrollIntoView({ behavior:'smooth', block:'center' });
        firstInvalid?.focus({ preventScroll:true });
        this.showMessage(formMessage, 'Revisa los campos marcados en rojo.', false);
        return;
      }

      if (submitBtn){
        const original = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>Enviando...';

        // aquí iría tu POST real
        setTimeout(() => {
          submitBtn.disabled = false;
          submitBtn.innerHTML = original;
          form.reset();
          form.classList.remove('was-validated');
          this.showMessage(formMessage, '¡Postulación enviada! Te contactaremos por correo.', true);
          formMessage?.scrollIntoView({ behavior:'smooth', block:'center' });
        }, 900);
      }
    }, { passive:false });
  }

  private showMessage(el: HTMLElement | null, msg: string, ok: boolean){
    if (!el) return;
    el.style.display = 'block';
    el.textContent = msg;
    el.className = ok ? 'form-message success' : 'form-message error';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    setTimeout(() => { el.style.display = 'none'; }, 6000);
  }
}
