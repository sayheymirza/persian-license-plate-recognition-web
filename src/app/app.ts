import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import imageCompression from 'browser-image-compression';
import { lastValueFrom } from 'rxjs';

@Component({
  selector: 'app-root',
  imports: [FormsModule],
  template: `
    <div class="flex flex-col items-center justify-center gap-20 relative aspect-16/9 w-full"> 
      @if(error()) {
        <div class="absolute top-4 left-1/2 -translate-x-1/2 z-10">
          <div class="alert alert-error">
            <span>{{error()}}</span>
          </div>
        </div>
      }

      @if(diffing()) {
        <div class="flex flex-nowrap items-center gap-4 absolute -bottom-10 md:bottom-4 left-1/2 -translate-x-1/2 z-10">
          <button (click)="unsetPhoto()" class="btn btn-ghost btn-circle glass fill-base-content">
            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>
          </button>

          <button class="btn btn-ghost glass rounded-full text-base-content pointer-events-none">
            It tooks {{took()}} seconds
          </button>
        </div>

        <figure class="diff h-full" tabindex="0">  
          <div class="diff-item-1" role="img" tabindex="0">
            <img
              class="aspect-1/6 object-contain"
              src="{{original()}}" 
            />
          </div>
          <div class="diff-item-2" role="img">
            <img
            class="aspect-1/6 object-contain"
              src="{{filtered()}}" />
          </div>
          <div class="diff-resizer"></div>
        </figure>
      } @else {
        <h4 class="text-4xl text-center">
          <b>P</b>ersian <b>L</b>icense <b>P</b>late <b>R</b>ecognition 
        </h4>
        
        <div class="flex flex-col md:flex-wrap items-center gap-10">
          <div [class.tooltip-open]="!loading()" class="tooltip tooltip-top" data-tip="A photo of a car">
            <button [disabled]="loading()" (click)="uploadAPhoto()" class="btn btn-lg fill-base-content gap-4">
              @if(loading()) {
                <span class="loading loading-spinner loading-md"></span>
              } @else {
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M20 5h-3.2L15 3H9L7.2 5H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 14h-8v-1c-2.8 0-5-2.2-5-5s2.2-5 5-5V7h8v12zm-3-6c0-2.8-2.2-5-5-5v1.8c1.8 0 3.2 1.4 3.2 3.2s-1.4 3.2-3.2 3.2V18c2.8 0 5-2.2 5-5zm-8.2 0c0 1.8 1.4 3.2 3.2 3.2V9.8c-1.8 0-3.2 1.4-3.2 3.2z"/></svg>
              }
              <span class="text-sm">Upload a photo</span>
            </button>
          </div>

          <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" class="fill-base-content"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>

          <div [class.tooltip-open]="!loading()" class="tooltip tooltip-bottom md:tooltip-top" data-tip="Effect on plate">
            <select [disabled]="loading()" [(ngModel)]="effect" name="effect" class="btn btn-lg pl-1">
              <option value="blur">Blur</option>
              <option value="white">White</option>
            </select>
          </div>
        </div>
      }
    </div>
  `,
  host: {
    class: 'h-dvh w-screen flex items-center justify-center'
  }
})
export class App {
  private http = inject(HttpClient);

  public loading = signal<boolean>(false);
  public effect = signal<'blur' | 'white'>('blur');
  public original = signal<String | null>(null);
  public filtered = signal<String | null>(null);
  public error = signal<String | null>(null);
  public took = signal(0);

  public diffing = computed(() => {
    return this.original() != null && this.filtered() != null;
  });

  public unsetPhoto() {
    this.original.set(null);
    this.filtered.set(null);
    this.took.set(0);
  }

  public async uploadAPhoto() {
    try {
      this.loading.set(true);
      this.error.set(null);

      let photo = await this.chooseAPhoto();
      if (!photo) {
        this.loading.set(false);
        throw new Error('No photo selected');
      }

      photo = await this.compressPhoto(photo);

      const formData = new FormData();
      formData.append('file', photo);
      formData.append('effect', this.effect());

      const url = 'https://persian-license-plate-recognition.doting.ir/process-plate';

      const response = await lastValueFrom(this.http.post<any>(url, formData));

      this.loading.set(false);

      if (response.ok) {
        this.filtered.set(this.original());
        this.took.set(Math.floor(response.meta.took * 10));

        const filtered = `https://persian-license-plate-recognition.doting.ir/${response.url}`;

        const image = new Image();
        image.src = filtered;

        image.onload = () => {
          this.filtered.set(image.src);
        };
      }

    } catch (e) {
      console.error(e);
      this.loading.set(false);

      if (e instanceof HttpErrorResponse) {
        this.error.set(e.error.error);

        setTimeout(() => {
          this.error.set(null);
        }, 5000);
      }
    }
  }

  private chooseAPhoto() {
    // Logic to choose a photo
    return new Promise<any>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (event) => {
        const file = (event.target as HTMLInputElement).files?.[0];

        if (file) {
          // make blob url
          const blobUrl = URL.createObjectURL(file);
          this.original.set(blobUrl);
        }

        resolve(file);

      };
      input.click();
    });
  }

  private compressPhoto(file: File) {
    return imageCompression(file, {
      maxSizeMB: 1,
      maxWidthOrHeight: 1920,
      useWebWorker: true
    });
  }
}