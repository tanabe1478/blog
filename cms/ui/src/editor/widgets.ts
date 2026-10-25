import { WidgetType } from "@codemirror/view";

export class ImageWidget extends WidgetType {
  constructor(
    readonly src: string,
    readonly alt: string,
  ) {
    super();
  }

  eq(other: ImageWidget): boolean {
    return other.src === this.src && other.alt === this.alt;
  }

  toDOM(): HTMLElement {
    const wrapper = document.createElement("span");
    wrapper.className = "cm-md-image-wrap";
    const image = document.createElement("img");
    image.className = "cm-md-image";
    image.src = this.src;
    image.alt = this.alt;
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";
    wrapper.appendChild(image);
    return wrapper;
  }

  ignoreEvent(): boolean {
    return false;
  }
}

export class BadgeWidget extends WidgetType {
  constructor(
    readonly text: string,
    readonly className: string,
  ) {
    super();
  }

  eq(other: BadgeWidget): boolean {
    return other.text === this.text && other.className === this.className;
  }

  toDOM(): HTMLElement {
    const badge = document.createElement("span");
    badge.className = this.className;
    badge.textContent = this.text;
    return badge;
  }
}
