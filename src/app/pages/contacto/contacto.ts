import { Component, AfterViewInit, Inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-contacto',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './contacto.html',
  styleUrls: ['./contacto.css'],
})
export class ContactoComponent implements AfterViewInit {
  constructor(@Inject(PLATFORM_ID) private platformId: Object) {}

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const form = document.getElementById('contactForm') as HTMLFormElement | null;
    const submitBtn = document.getElementById('contactSubmitBtn') as HTMLButtonElement | null;
    const subjectSelect = document.getElementById('contactSubject') as HTMLSelectElement | null;
    const subjectHint = document.getElementById('subjectHint') as HTMLElement | null;
    const msg = document.getElementById('contactMessage') as HTMLTextAreaElement | null;
    const msgCounter = document.getElementById('msgCounter') as HTMLElement | null;
    const phone = document.getElementById('contactPhone') as HTMLInputElement | null;

    // ----- Chips de motivo -----
    const chips = Array.from(document.querySelectorAll<HTMLButtonElement>('.chip-group .chip'));
    const setActiveChip = (val: string) => {
      chips.forEach(c => {
        const isActive = (c.getAttribute('data-subject') || '') === val;
        c.classList.toggle('active', isActive);
      });
    };

    // Hints por asunto
    const hints: Record<string, string> = {
      general: 'Cuéntanos brevemente tu necesidad y el contexto.',
      colaboracion: 'Indica el tipo de colaboración, tiempos y institución.',
      publicacion: 'Incluye título, autores y enlace/archivo si aplica.',
      convocatoria: 'Especifica la convocatoria, fechas y dudas puntuales.',
      soporte: 'Describe el problema, sistema/versión y pasos para reproducir.',
      otro: 'Detalla tu solicitud para canalizarla mejor.',
    };
    const updateHint = (v: string) => {
      if (!subjectHint) return;
      subjectHint.textContent = hints[v] ?? 'Elige un motivo para ver recomendaciones.';
    };

    // Click en chip → selecciona el <select> + activa chip + scroll suave
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const val = chip.getAttribute('data-subject') || '';
        if (subjectSelect) {
          subjectSelect.value = val;
          subjectSelect.dispatchEvent(new Event('change'));
          subjectSelect.focus();
        }
        setActiveChip(val);
        document.getElementById('contactFormHeading')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });

    // Cambio en <select> → actualiza hint, autosave y chip activo
    subjectSelect?.addEventListener('change', () => {
      const v = subjectSelect.value || '';
      updateHint(v);
      setActiveChip(v);
      this.saveDraft();
    });

    // ----- Contador de caracteres -----
    const updateCounter = () => {
      if (!msg || !msgCounter) return;
      const max = Number(msg.getAttribute('maxlength') ?? 5000);
      msgCounter.textContent = `${msg.value.length} / ${max}`;
    };
    msg?.addEventListener('input', () => {
      updateCounter();
      this.saveDraft();
    });
    updateCounter();

    // ----- Máscara ligera de teléfono -----
    phone?.addEventListener('input', () => {
      let v = phone.value.replace(/[^\d]/g, '').slice(0, 12);
      const parts: string[] = [];
      if (v.length > 0) parts.push('(' + v.slice(0, 2) + ')');
      if (v.length > 2) parts.push(' ' + v.slice(2, 6));
      if (v.length > 6) parts.push(' ' + v.slice(6, 10));
      phone.value = parts.join('');
      this.saveDraft();
    });

    // ----- Autosave -----
    this.restoreDraft();
    ['contactName', 'contactEmail', 'contactPhone'].forEach((id) => {
      document.getElementById(id)?.addEventListener('input', () => this.saveDraft());
    });

    // Inicializa chips/hint con el valor actual del select
    setActiveChip(subjectSelect?.value || '');
    updateHint(subjectSelect?.value || '');

    // ----- Submit controlado -----
    form?.addEventListener('submit', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
    });

    if (submitBtn && form) {
      submitBtn.addEventListener('click', async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();

        if (!form.checkValidity()) {
          form.classList.add('was-validated');
          return;
        }

        // Aquí iría tu POST real (fetch/HttpClient)
        await this.showSuccessModal();

        // Limpieza
        form.reset();
        form.classList.remove('was-validated');
        localStorage.removeItem('contactDraft');
        updateCounter();
        updateHint('');
        setActiveChip('');
      });
    }

    // ----- Copiar teléfono / correo institucional -----
    const copy = async (text: string) => {
      try { await navigator.clipboard.writeText(text); } catch {}
    };
    document.getElementById('copyPhone')?.addEventListener('click', () => {
      const t = (document.getElementById('instPhone')?.textContent || '').trim();
      copy(t);
    });
    document.getElementById('copyEmail')?.addEventListener('click', () => {
      const t = (document.getElementById('instEmail')?.textContent || '').trim();
      copy(t);
    });

    // ----- Abierto ahora / Cerrado -----
    this.updateOpenStatus();
    setInterval(() => this.updateOpenStatus(), 60000);
  }

  private async showSuccessModal(): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;
    const modalEl = document.getElementById('contactSuccessModal');
    if (!modalEl) return;

    const { Modal } = await import('bootstrap');
    new Modal(modalEl).show();
  }

  // Horario: L–V 9:00–17:00 local
  private updateOpenStatus() {
    const el = document.getElementById('openStatus');
    const pill = document.getElementById('openNowPill');
    if (!el) return;

    const now = new Date();
    const day = now.getDay(); // 0 dom ... 6 sab
    const hour = now.getHours();
    const minute = now.getMinutes();
    const inRange = (h: number, m: number) =>
      (h > 9 && h < 17) || (h === 9 && m >= 0) || (h === 17 && m === 0);

    const abierto = day >= 1 && day <= 5 && inRange(hour, minute);
    el.textContent = abierto ? 'Abierto ahora' : 'Cerrado (L–V 9:00–17:00)';
    if (pill) {
      pill.textContent = abierto ? 'Abierto' : 'Cerrado';
      pill.classList.toggle('bg-open-now', abierto);
      pill.classList.toggle('bg-closed-now', !abierto);
    }
  }

  // ----- Draft simple en localStorage -----
  private saveDraft() {
    const get = (id: string) =>
      (document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? '';
    const draft = {
      name: get('contactName'),
      email: get('contactEmail'),
      phone: get('contactPhone'),
      subject: (document.getElementById('contactSubject') as HTMLSelectElement | null)?.value ?? '',
      message: (document.getElementById('contactMessage') as HTMLTextAreaElement | null)?.value ?? '',
    };
    try {
      localStorage.setItem('contactDraft', JSON.stringify(draft));
    } catch {}
  }

  private restoreDraft() {
    try {
      const raw = localStorage.getItem('contactDraft');
      if (!raw) return;
      const d = JSON.parse(raw) || {};
      const name = document.getElementById('contactName') as HTMLInputElement | null;
      const email = document.getElementById('contactEmail') as HTMLInputElement | null;
      const phone = document.getElementById('contactPhone') as HTMLInputElement | null;
      const sel = document.getElementById('contactSubject') as HTMLSelectElement | null;
      const ta = document.getElementById('contactMessage') as HTMLTextAreaElement | null;

      if (name) name.value = d.name ?? '';
      if (email) email.value = d.email ?? '';
      if (phone) phone.value = d.phone ?? '';
      if (sel && d.subject) sel.value = d.subject;
      if (ta) ta.value = d.message ?? '';
    } catch {}
  }
}
