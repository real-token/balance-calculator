import { checkbox, confirm, input, select } from "@inquirer/prompts";
import { setTimeout } from "timers/promises";

export async function askGraphQLUrl(): Promise<string> {
  const extra = process.env.ENDPOINT_EXTRA ?? [];
  const answers = await select({
    message: "Que voulez-vous faire ?",
    choices: [
      { value: "https://api.realtoken.network/graphql" },
      ...(extra as string[]).map((url) => ({ value: url })),
      { value: "http://localhost:3000/graphql" },
    ],
  });
  return answers;
}

export async function askTokenAddresses(tokens: Array<[string, string]>): Promise<string[]> {
  const choices = tokens.map(([address, shortName]) => ({
    name: `${shortName} (${address.slice(0, 6)}...${address.slice(-4)})`,
    value: address,
    checked: true,
  }));

  const answers = await checkbox({
    message: "Quels tokens voulez-vous utiliser?",
    choices: choices,
  });

  return answers;
}

export async function askDateRange(
  options: {
    skipAsk?: boolean;
    startDate?: string;
    endDate?: string;
    snapshotTime?: string;
    currantTimestemp?: number;
  } = {}
): Promise<{
  startDate: string;
  endDate: string;
  snapshotTime: string;
}> {
  const today = new Date();
  const defaultDate = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(
    2,
    "0"
  )}-${String(today.getUTCDate()).padStart(2, "0")}`;
  const defaultTime = `${String(today.getUTCHours()).padStart(2, "0")}:00`;
  console.log("function askDateRange", { options }, options.skipAsk);
  if (options.skipAsk) {
    return {
      startDate: options.startDate ?? defaultDate,
      endDate: options.endDate ?? defaultDate,
      snapshotTime: options.snapshotTime ?? defaultTime,
    };
  }

  //Option par defaut si demande date
  const { startDate = defaultDate, endDate = defaultDate, snapshotTime = defaultTime } = options;

  console.log("askDateRange demande", { startDate, endDate, snapshotTime });

  const start = await input({
    message: "Entrez la date de début UTC (format YYYY-MM-DD) :",
    default: defaultDate,
    validate: (value: string) => {
      const pass = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (pass) {
        return true;
      }

      return "Veuillez entrer une date valide UTC au format YYYY-MM-DD";
    },
  });

  const end = await input({
    message: "Entrez la date de fin UTC (format YYYY-MM-DD) :",
    default: start,
    validate: (value: string) => {
      const pass = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (pass) {
        return true;
      }

      return "Veuillez entrer une date UTC valide au format YYYY-MM-DD";
    },
  });

  const time = await input({
    message: "Entrez l'heure du snapshot UTC (format HH:mm) :",
    default: defaultTime,
    validate: (value: string) => {
      const pass = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
      if (pass) {
        return true;
      }

      return "Veuillez entrer une heure UTC valide au format HH:mm";
    },
  });

  return { startDate: start, endDate: end, snapshotTime: time };
}

export async function askUseconfirm(message: string, defaultValue?: boolean): Promise<boolean> {
  const answers = await confirm({
    message: message, //`Voulez-vous utiliser le fichier temporaire "${filename}" ? (Y/n)`,
    default: defaultValue ?? true,
  });
  return answers;
}

export async function askUseTempFile(listFile: string[]): Promise<string> {
  const answers: string = await select({
    message: `Quelle fichier voulez vous utiliser ?`,
    choices: listFile.map((str) => ({ value: str })),
    pageSize: 5,
    loop: true,
  });

  return answers;
}

/**
 * Demande à l'utilisateur de choisir une option dans une liste.
 *
 * @param message - Le message à afficher à l'utilisateur.
 * @param list - La liste d'options parmi lesquelles choisir, où chaque option a un array string de valeur (value:string[]) et
 *                un array string de nom (name:string[]) qui peux etre un array vide.
 * @returns Une promesse qui se résout à la valeur de l'option sélectionnée.
 */
export async function askChoiseListe(message: string, list: { value: string[]; name: string[] }): Promise<string> {
  const answers: string = await select({
    message: message,
    choices: list.value.map((str, i) => ({ name: list.name[i], value: str })),
    pageSize: 5,
    loop: true,
  });

  return answers;
}

export async function askChoiseCheckbox(
  message: string,
  list: { value: string[]; name: string[] },
  defaultChecked?: boolean
): Promise<string[]> {
  if (list.value.length < 1) {
    return [];
  }
  const answers: string[] = await checkbox({
    message: message,
    choices: list.value.map((str, i) => {
      return { name: list.name[i], value: str, checked: !!defaultChecked };
    }),
    pageSize: 5,
    loop: true,
    validate: (value) => {
      if (value.length < 1) {
        return "Veuillez sélectionner au moins une option.";
      }
      return true;
    },
  });

  return answers;
}

export async function askInput(
  message: string,
  validate: { regex: RegExp; messageEchec: string },
  defaultValue?: string
): Promise<string> {
  const answers: string = await input({
    message: message,
    default: defaultValue,
    validate: (value: string) => {
      if (value.match(validate.regex)) {
        return true;
      }
      return validate.messageEchec;
    },
  });

  return answers;
}

export async function askUrls(
  urlsList: string[],
  multiSelect: boolean = true,
  message: string = "Quelle url graphQL utiliser ?"
): Promise<string[] | string> {
  console.log("askUrls", urlsList);
  urlsList.push("http://localhost:3000/graphql", "custom");
  const askGraphQLUrl = {
    value: urlsList,
    name: [],
  };

  let urls;
  const timer = setTimeout(10000).then(() => {
    return multiSelect ? [urlsList[0]] : urlsList[0];
  });

  if (multiSelect) {
    urls = await Promise.race([askChoiseCheckbox(message, askGraphQLUrl), timer]);
  } else {
    urls = await Promise.race([askChoiseListe(message, askGraphQLUrl), timer]);
  }

  return urls.includes("custom")
    ? [
        await askInput("Quelle es l'url custom ?", {
          regex: /^https?:\/\/[a-zA-Z0-9_-]*\.[a-z]{2,}/,
          messageEchec: "Veuillez entrer une url valide (http://... ou https://...)",
        }),
        ...urls,
      ]
    : urls;
}
