type SupportedLocales = "fr" | "en";

class I18n {
  private locale: SupportedLocales = "fr";
  private translations: { [key: string]: any } = {};
  private isLoaded: boolean = false;
  private loadingPromise: Promise<void>;

  constructor() {
    this.loadingPromise = this.loadTranslations();
  }

  private async loadTranslations() {
    try {
      const { default: fr } = await import("./locales/fr.js");
      const { default: en } = await import("./locales/en.js");
      this.translations = { fr, en };
      this.isLoaded = true;
    } catch (error) {
      console.error("Erreur lors du chargement des traductions:", error);
    }
  }

  async waitForLoad() {
    await this.loadingPromise;
  }

  setLocale(locale: SupportedLocales) {
    this.locale = locale;
  }

  t(key: string, params: { [key: string]: any } = {}): string {
    if (!this.isLoaded) {
      console.warn("Traductions non chargées, retour de la clé:", key);
      return key;
    }

    const keys = key.split(".");
    let translation = this.translations[this.locale];

    for (const k of keys) {
      translation = translation?.[k];
      if (translation === undefined) {
        console.warn(`Clé de traduction non trouvée: ${key}`);
        return key;
      }
    }

    return this.interpolate(translation, params);
  }

  private interpolate(text: string, params: { [key: string]: any }): string {
    return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
      const value = params[key];
      return value !== undefined ? value.toString() : "";
    });
  }
}

export const i18n = new I18n();
