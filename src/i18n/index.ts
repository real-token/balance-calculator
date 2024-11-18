type SupportedLocales = "fr" | "en";

class I18n {
  private locale: SupportedLocales = "fr";
  private translations: { [key: string]: any } = {};

  constructor() {
    this.loadTranslations();
  }

  private async loadTranslations() {
    const { default: fr } = await import("./locales/fr.js");
    const { default: en } = await import("./locales/en.js");
    this.translations = { fr, en };
  }

  setLocale(locale: SupportedLocales) {
    this.locale = locale;
  }

  t(key: string, params: { [key: string]: any } = {}): string {
    const keys = key.split(".");
    let translation = this.translations[this.locale];

    for (const k of keys) {
      translation = translation?.[k];
    }

    if (!translation) return key;

    return this.interpolate(translation, params);
  }

  private interpolate(text: string, params: { [key: string]: any }): string {
    return text.replace(/\{\{(\w+)\}\}/g, (_, key) => params[key]?.toString() || "");
  }
}

export const i18n = new I18n();
