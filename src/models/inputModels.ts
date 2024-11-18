import { BigNumber } from "bignumber.js";
import fs from "fs";
import path from "path";
import { MODE_DEBUG } from "../configs/constantes.js";
import { i18n } from "../i18n/index.js";
import * as modifiers from "../modifiers/index.js";
import { InputModel, NormalizeOptions } from "../types/inputModles.types.js";
import { SourceBalancesREG } from "../types/REG.types.js";

const __dirname = new URL(".", import.meta.url).pathname;

function applyModifiers(data: SourceBalancesREG[], options: NormalizeOptions = {}) {
  let modifiedData: SourceBalancesREG[] = data;

  for (const [key, value] of Object.entries(options)) {
    if (key in modifiers && typeof modifiers[key as keyof typeof modifiers] === "function") {
      console.info(i18n.t("models.normalize.infoApplyModifier", { modifier: key }));
      // console.debug(`Applying modifier: ${key}`);
      // console.debug(modifiers[key as keyof typeof modifiers]);
      // //console.debug(modifiedData);
      // console.debug(value);
      modifiedData = modifiers[key as keyof typeof modifiers](modifiedData, value);
    }
  }

  return modifiedData;
}

/**
 * InputModel
 * Fonction de normalisation des données d'entrée
 * Le nom du modèle doit correspondre au prefixe du fichier d'entrée pour etre détecté automatiquement
 * la fonction normalize doit renvoyer un tableau d'objets avec les propriétés address et balance ciblées
 */

// Modèle de normalisation des balances REG
export const balancesREGModel: InputModel = {
  normalize: (data, options) => {
    if (!options) console.info(i18n.t("models.normalize.infoNoOptions"));
    let datas = data.result.balances;
    if (options) {
      datas = applyModifiers(datas, options);
    }
    // Si en mode débug, création d'un fichier avec les balances modifier par les modifiers
    if (MODE_DEBUG) {
      const dirPath = path.join(__dirname, "..", "..", "outDatas");
      const outputPath = path.join(dirPath, `DEBUG-BalancesModifiedForPowerVotingREG.json`);
      fs.writeFileSync(outputPath, JSON.stringify(datas, null, 2));
    }

    return datas.map((user: any) => ({
      address: user.walletAddress,
      balance: new BigNumber(user.totalBalance),
    }));
  },
};

// Modèle de normalisation des classements REG
export const classementREGModel: InputModel = {
  normalize: (data, options) => {
    if (!options) console.info(i18n.t("models.normalize.infoNoOptions"));
    return data.result.classementREG.map((item: any) => ({
      address: item.address,
      balance: new BigNumber(item.balance),
    }));
  },
};

// Ajoutez d'autres modèles d'entrée si nécessaire
