import { Component, AfterViewInit, ElementRef, ViewChild, inject, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { debounceTime } from 'rxjs/operators';

@Component({
  selector: 'app-convocatorias',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './convocatorias.html',
  styleUrls: ['./convocatorias.css']
})
export class ConvocatoriasComponent implements AfterViewInit, OnDestroy {
  private fb = inject(FormBuilder);
  private router = inject(Router);

  @ViewChild('cardsContainer', { static: true }) cardsContainer!: ElementRef<HTMLElement>;
  @ViewChild('feedbackBar', { static: true }) feedbackBar!: ElementRef<HTMLElement>;
  @ViewChild('emptyState', { static: true }) emptyState!: ElementRef<HTMLElement>;

  form = this.fb.group({
    q: [''],
    area: ['']
  });

  applying = false;
  private modalListeners: (() => void)[] = [];

  ngAfterViewInit() {
    this.form.valueChanges.pipe(debounceTime(220)).subscribe(() => this.filter());
    this.filter(); // primera pasada
    this.setupModalListeners();
  }

  ngOnDestroy() {
    this.modalListeners.forEach(cleanup => cleanup());
    this.modalListeners = [];
  }

  private setupModalListeners() {
    const modalIds = ['modalConv1', 'modalConv2', 'modalConv3'];
    
    modalIds.forEach(id => {
      const modalEl = document.getElementById(id);
      if (!modalEl) return;

      // Mover modal al body si no está ya ahí
      if (modalEl.parentElement !== document.body) {
        document.body.appendChild(modalEl);
      }

      // Listener para cuando se muestra el modal
      const showHandler = () => {
        // Asegurar que esté en el body
        if (modalEl.parentElement !== document.body) {
          document.body.appendChild(modalEl);
        }
        // Forzar z-index
        (modalEl as HTMLElement).style.zIndex = '1055';
        const backdrop = document.querySelector('.modal-backdrop');
        if (backdrop) {
          (backdrop as HTMLElement).style.zIndex = '1040';
        }
      };

      // Listener para cuando se oculta el modal
      const hideHandler = () => {
        // Limpiar estilos inline
        (modalEl as HTMLElement).style.zIndex = '';
      };

      modalEl.addEventListener('show.bs.modal', showHandler);
      modalEl.addEventListener('shown.bs.modal', showHandler);
      modalEl.addEventListener('hide.bs.modal', hideHandler);
      modalEl.addEventListener('hidden.bs.modal', hideHandler);

      this.modalListeners.push(() => {
        modalEl.removeEventListener('show.bs.modal', showHandler);
        modalEl.removeEventListener('shown.bs.modal', showHandler);
        modalEl.removeEventListener('hide.bs.modal', hideHandler);
        modalEl.removeEventListener('hidden.bs.modal', hideHandler);
      });
    });
  }

  private normalize(text: any) {
    return (text || '').toString().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  filter() {
    const q = this.normalize(this.form.value.q);
    const area = (this.form.value.area || '').toString();

    // feedback ON
    this.setDisplay(this.feedbackBar, '');

    // defer para UX suave
    setTimeout(() => {
      const container = this.cardsContainer?.nativeElement;
      const cols = Array.from(container?.children ?? []) as HTMLElement[];

      let visible = 0;
      for (const col of cols) {
        const keywords = this.normalize(col.dataset['keywords']);
        const cardArea = (col.dataset['area'] || '').toString();
        const textContent = this.normalize(col.textContent);

        const matchesQuery = !q || keywords.includes(q) || textContent.includes(q);
        const matchesArea = !area || cardArea === area;

        if (matchesQuery && matchesArea) {
          col.style.display = '';
          visible++;
        } else {
          col.style.display = 'none';
        }
      }

      // empty state
      this.setDisplay(this.emptyState, visible === 0 ? '' : 'none');
      // feedback OFF
      this.setDisplay(this.feedbackBar, 'none');
    }, 0);
  }

  private setDisplay(ref: ElementRef<HTMLElement>, value: '' | 'none') {
    if (ref?.nativeElement) ref.nativeElement.style.display = value;
  }

  // Confirmación UX y navegación Angular (si la quieres usar en algún botón)
  confirmAndGo(url: string) {
    const ok = globalThis.confirm?.('Vas a iniciar la postulación. ¿Deseas continuar?');
    if (ok) this.router.navigateByUrl(url);
  }

  // Bootstrap Modal (dinámico y SSR-safe)
  async showModalById(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    
    // Asegurar que el modal esté en el body
    if (el.parentElement !== document.body) {
      document.body.appendChild(el);
    }
    
    const { Modal } = await import('bootstrap');
    const modal = new Modal(el);
    
    // Forzar z-index antes de mostrar
    (el as HTMLElement).style.zIndex = '1055';
    
    modal.show();
    
    // Asegurar z-index después de mostrar
    setTimeout(() => {
      (el as HTMLElement).style.zIndex = '1055';
      const backdrop = document.querySelector('.modal-backdrop');
      if (backdrop) {
        (backdrop as HTMLElement).style.zIndex = '1040';
      }
    }, 100);
  }
}
