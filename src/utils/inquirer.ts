import { checkbox, confirm, input, select } from "@inquirer/prompts";
import { setTimeout } from "timers/promises";
import { i18n } from "../i18n/index.js";

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
    message: i18n.t("utils.inquirer.askTokenAddresses"),
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
  //console.log("function askDateRange", { options }, options.skipAsk);
  if (options.skipAsk) {
    return {
      startDate: options.startDate ?? defaultDate,
      endDate: options.endDate ?? defaultDate,
      snapshotTime: options.snapshotTime ?? defaultTime,
    };
  }

  //Option par defaut si demande date
  const { startDate = defaultDate, endDate = defaultDate, snapshotTime = defaultTime } = options;

  //console.log("askDateRange demande", { startDate, endDate, snapshotTime });

  const start = await input({
    message: i18n.t("utils.inquirer.askDateRange"),
    default: defaultDate,
    validate: (value: string) => {
      const pass = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (pass) {
        return true;
      }

      return i18n.t("utils.inquirer.askMessageValidateRange");
    },
  });

  const end = await input({
    message: i18n.t("utils.inquirer.askDateRangeEnd"),
    default: start,
    validate: (value: string) => {
      const pass = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (pass) {
        return true;
      }

      return i18n.t("utils.inquirer.askMessageValidateRange");
    },
  });

  const time = await input({
    message: i18n.t("utils.inquirer.askSnapshotTime"),
    default: defaultTime,
    validate: (value: string) => {
      const pass = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
      if (pass) {
        return true;
      }

      return i18n.t("utils.inquirer.askMessageValidateTime");
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
    message: i18n.t("utils.inquirer.askUseTempFile"),
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
        return i18n.t("utils.inquirer.askMessageValidateCheckbox");
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
  //console.log("askUrls", urlsList);
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
        await askInput(i18n.t("utils.inquirer.askCustomUrl"), {
          regex: /^https?:\/\/[a-zA-Z0-9_-]*\.[a-z]{2,}/,
          messageEchec: i18n.t("utils.inquirer.askMessageValidateCustomUrl"),
        }),
        ...urls,
      ]
    : urls;
}
