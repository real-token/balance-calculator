import { BigNumber } from "bignumber.js";
import fs from "fs";
import path from "path";
import { i18n } from "../i18n/index.js";
import { createGraphQLClient, getHoldersOwnRealToken, getListTokensUUID } from "../utils/graphql.js";
import { askDateRange, askTokenAddresses, askUrls } from "../utils/inquirer.js";

const __dirname = new URL(".", import.meta.url).pathname;

// TODO : voir pour constuir la liste dynamiquement
// Liste des adresses à exclure (par exemple, les pools Levinswap)
const addressExclude = [
  "0x474f8f008f07cd42200bc6dabc1db2206827ee6e",
  "0xc215ebfe68c15fcafcb848105ef5f5b1158313cb",
  "0x7671f9c37bfcee829f54d4bdd2a226930c91df7b",
  "0x9016aa99b98128ba990097ea3f3d60b5e40775e4",
  "0x0620e472ea092adaffd70e928d706b4a53adf6c8",
  "0x1bdc18d53ca882b97196828e131548700ea81a88",
  "0x2e66ed26258c186e931a7dd2aedbf944c9a0d2ff",
  "0x5709591aa2769f07a94d65dfb141c620a7c857c8",
  "0x762bf419272edf68e1e146e704f07e2640d37471",
  "0xa632fe8d996ca5bf80e20f8d4ef38a156c619df1",
  "0xea0f9e03138efcc7c98adbc4e698d0c158f99a0b",
  "0x8d5835c767626f42f1971e3f06a2c283c881d431",
  "0x5b47510222df764efb0fabf1a7fbf4da163c8a5b",
  "0x40a24eca4bbc224acde928230d14cd729f81f3cf",
  "0x287a653a41a67018ee97442c820bcdf40d114da2",
  "0x98042ec99c9a6f28ee8e95a9c2bbc62ddcbe7884",
  "0xa55b4fbf4c3f343f373c5aac1ce17883c3868b7c",
  "0xca9b1692dd16ebab3d4b48c056bb11f84597c193",
  "0xc3d5c88f947d8c3c82437ce9c9a9c3768270f762",
  "0x3605c59a1f44d63c27583a935a0a7c0676f06d30",
  "0x1c64b9abddc87f4192cb183cb8b52b01bbb7e9d6",
  "0xbe08c16ca25e4d0f610cc0e6c9fe27f1dfbd5dd9",
  "0xf01a0cc34a665945739f33a951fbac2bb65639f3",
  "0x1e92ba7755ee84f9ca0bee932330f79d7fb1c67a",
  "0xf9b721143043ad43c0029b2c7fab10761ad22b31",
  "0xc5850f434f129f8ce681b2bbb2e25e5036d8da15",
  "0xf76f973ad18c401888e44987699d1b585772eab2",
  "0x9b9b6d35c203835ab118d495c6e44c24c2a3c887",
  "0x6d14dc1e49e47b1dfea5b9e55143e1c1d0c4afb7",
  "0x80ee90ec477ed8d7a577a378cea143f579c005f8",
  "0x9a8c7280e0c1e35c1790f012fb41437deed8e9ad",
  "0x893116be249d099a69e9fc2cfcff8cf110c39dd6",
  "0x5ae7b6aef6ad086f2e36f4bd9eaac6023d5bac61",
  "0xd4f08007cd9231482696855bf4ea68e6a36d70ee",
  "0xce81ce572caf8d04345035327b949303c4191f40",
  "0x9a188ddefc56b7f05afaa2623d9d503f40aab9ee",
  "0x1bdb8692bb9a6076f1d5c2b947f96230d0141f4a",
  "0x076d0947f6d715ecdcdd2c54ea8b21995b7ccd65",
  "0x2b7d65a0d5732de0d90fea733c573784f1fa25cd",
  "0xb2233d7536bf40eb94cb2f74b7e2b3eec291a7a0",
  "0xf8fc0dc84b702f43d0e4cbc3f34a119159bb4a29",
  "0x75afd656f22b3a9584dafc23b89aafe94fdcbc57",
  "0x1abff927c1436d81eeaf74fc8efe5e6e774a803d",
  "0x7ba85fce1a4bc77540d38aa7f57b6d0fc709e845",
  "0x70ee52348edc032a3b111edcbf529680133f4b4a",
  "0x2b3529a686b08ab52ab5f7462a925101e8518eba",
  "0x4a1b8b79842a3832e5f458ffbebc43fca44e15cd",
  "0x904d20c351928abdf781be69075f867b64ec611d",
  "0xbe3c173cddfbcd01586fb21682189d9294831284",
  "0xdd301a491225aa4a6e0d6826a62f1f6b1af535c0",
  "0x86facee8d61dead2925cad7d20299967d20852ad",
  "0x2b0bbd275675337d0873f881141859fc98bad80b",
  "0xf8d3ff55cc44b920bf5b4b7017de8a786631f763",
  "0x830e926c36bfe8099e3817dd4390697ec9a30d16",
  "0x12072732a1f26c6a053e8e40fc6655153011fbaa",
  "0xca6917e4dba1ddfd6cc26ae9c7740fd7754f6ddd",
  "0xbd0dd0c34f0cbe88d7c070ef4db195d84c6f10fa",
  "0x2a71cfe12396ba8ec47d810866d90584ba1f70d7",
  "0x95c79a53adefcdf61acdafba6562f53a40ffeaf2",
  "0x34cf138f9c814bacf7c7add6127a392d1c9bad92",
  "0x42beaecb4ec59f174f1f9f973dacfc00ef72b96a",
  "0xe496ef492e05dca421691be2a296c41318d7c275",
  "0x772a78a340d266abda1328c1c8892c86ccf8514e",
  "0xa03ff0d5e0f6a37a8151dbbb3dc772f16fd7832f",
  "0xc26c6b93bb0f9911068dad482723232f276b8efd",
  "0x611f05f8b09809f74ecfcb02a74743c21df5e26e",
  "0x645422e5c3eea914a4228e6f966e709ed3a12aef",
  "0x133fc637e090a0243f69f78f06eb89d4509daefd",
  "0xd6447aef6f0e98665e60f48b33e0b9e85b97a800",
  "0x74611135e42e914efd43ff4c095d4408dbf31e8c",
  "0x735d7d10da39b5c9b8810b16c6eaddbce81f7807",
  "0xf7b9fd45d511c3bce94d1c65ab54069bc12df75a",
  "0xe7c240012be8dd57d73a4542a76b9a7e78a5f009",
  "0x22dedaec9c1cd22d26f9c74a23df4e1d30bc232a",
  "0xfbcbba1fdb42472d4ae62ace0839a2cdd13e0eeb",
  "0xdf1d017de1743c879fc3941c27d5e31c30ca5582",
  "0x67f3a9bc5a9fe9a59da57c85b7da1ca3bb2fceee",
  "0x44ec8664444bfef6d834bbb4bb0fbf69224e8c07",
  "0x9e3d03ba60a3c9c7b2521fe7865e17bc4e44835b",
  "0xaa581d53ef44beb24e94e59f349ad0d43f3f87fa",
  "0x81cac136924fed1c98574f6a5ef016010bc162c6",
  "0x0eef8c25e780f2ce8c78354ee9408d11d070e365",
  "0xc9e1542e387000f9610809b0020589c833f561f3",
  "0x27983d7e6245ab109b0a6bf07960dda71b1098c0",
  "0xbb84403579e1958e3f9c271349b3eea5b6a8248e",
  "0x001c7a3f78205e3ef9e4285c66a998c4b1252102",
  "0x42f1ae5087e8b85c6b578856049ee9e4c987ec78",
  "0xed0ccc441bac47b5f62c74e5fdd27f8cae2d57d1",
  "0x87419b410164c89e844a0eb9079b3e68f51d0137",
  "0x8c8ede5298ceb76a6f5c6ef18d6945499f6b9eed",
  "0xb9862f1d8358b5f65153da75875ddd452bc9876e",
  "0xac2563b4d19ae0018207424f524a5d8539b6c228",
  "0x8e68484a85785ea74805d6788b0e06792f270d32",
  "0x052c2e19e083fda5758d1d74936ff307f9448af5",
  "0x6e6ca443bc983ada9844e10e78db81582ba452d2",
  "0xf391e4211fa10fdde58bf1f35b4132c04e589634",
  "0x289940c83ad4b60ab250eb8c01bdfb2fa9ccd71e",
  "0x69c14eff8a60b1b05e813536f0a201a56ec5e1ed",
  "0x0b683f70993abc28a7bd31261b6b8af4f24f38b2",
  "0x2cbad2860379b949f201502ebcc3fbbf99f09876",
  "0x9c572aece17ebd55a73a857b4dfbf8072fd4f868",
  "0x346cf80b1f981cfeda33e1cfd90b7c11e6213e49",
  "0xfe8419f09aa81f06264760f93759c5442e687313",
  "0xa11359319080a7884d4f815e8cf6a1850419ef37",
  "0xd41de8863ff67ffe1bd2ed1c0a36f32fc222a430",
  "0xe6b0722ded97a2f580a7bfd49c57481df487c3d1",
  "0x5a4c6150d0281e68bfd77d372081832102db1a71",
  "0x8e25e0d2b042a80507578132d45fe65f9147c882",
  "0x83d0bc4e253a3e9631b0987187ba8c646f0ef1e5",
  "0xd024224a5370e210e287840b68f2da544d2d9884",
  "0x4d6365d0a255969cc214153fe92bc8d17b1ec614",
  "0x83a7c8b6b3824ac02cf79d8219d1bc779e8086d7",
  "0x7926395ccfc4a7ba5b6bd6ee0a1e7b1bdfdbc959",
  "0x7ea762b19494def770ca1bf310db7e0297036d3a",
  "0x6a8d2c98b08b5d1079bfb3388eb6fc779f784b8a",
  "0x1088ec73716e82bb1ebde2b2966a2d8ace7a3f52",
  "0x6e5f9bd90e3ca508f9c3bda23f25838e37c0a3ac",
  "0xd2352879a3dc0ae82acb80d3fa15704e3a8c137b",
  "0xfdcd027fae9ecc1af2b67fd440f2caf144c32fab",
  "0xd98af64795abe0bbc0f9123b5d4733156a592f19",
  "0x05d1885bae8482604bfa4e2018b98bb1cb67639e",
  "0xd53f18169c8074a7fc0291ff60315db09bc26e5c",
  "0xbc7cc7d3e3b71d5e97e032197ee026bed2a1ce64",
  "0x28ec500847137300245b3fe29c70b64f59e6e694",
  "0x98743f1c155688f895c16cae7967c3d2cf684453",
  "0xd8c25945293457ca3b3029d5741dc7968d943279",
  "0xfd20e89bd8c62f1812d40badb929b28df803716c",
  "0x107820a8488a49bc676d30515a896cc2b9dfc98d",
  "0x0dd2c929696e496192e89dece2162d84bd9bbcdc",
  "0xcf7132aa327d1841ecc601b4d28262c392fa0f8c",
  "0x71510174b5212b38dcd7eff54aa456e30fec3efd",
  "0x9602589804a904ef79bd4ef3c4921a69d5a8ecc0",
  "0xcf028439c26f8521b4fa48c9d8a1ee8ec6c36136",
  "0xe20c320b8394fd44c739f81f6a6747c4d52a037b",
  "0x3279b6cc9cd44d2953ff4a15d5a431a6b308a0b2",
  "0x4bbafd8adc042a4754db7e0b5099797dbd0f86b3",
  "0x09d66740394c16b2e6b62f86f1bf4e782caadda3",
  "0x5b4939430b4418e58f0a94739c5209fafc990480",
  "0x56cceea01ac12817bbc600a6cc67acb34b52b000",
  "0x0711190cda7b4276eda0855f9127856fe9bacc56",
  "0xa4ed9fcb4b8cea9d87db9b2c8dc0b4db22380175",
  "0xbebc30e6d4e52eec3abc6b1147df9773fe0f4434",
  "0x25698f3b9bf4fed7ef8d585cfcc5aeee320b1d29",
  "0xeb4b58dd4d5fc53bafbff923ecbf97a8cfaceef4",
  "0x3f3b7b8d577ffb47afa0801b80acd35d6c528ef1",
  "0x6e8e50f6574760f01ed34a0e79f030623f5d1839",
  "0xc6c2dfb21d2d9beea48e1105ca1958410e4d63ba",
  "0xe939a7dc86b8b75350f3c8e0f01bf1f2ba8c1ef3",
  "0x94c1bfa7826c4ef28969a0eb49e82a614a723f8c",
  "0x10b09379cf5d7530af598b7e4334338ba0a51d15",
  "0xca2fe4ffa796c710eb452df30693157015592708",
  "0x9079300ee3f544c0b7aacac04f1bed141ce2cf4b",
  "0x12f206f4f1e8c7d3db8e36cb8ec1cf8487670aef",
  "0x91087c3e1d0d5676df0d8d7f6bf4f2cac85e91bb",
  "0x7e89dd6ff14f82c03e455b33b018c27802c73e6b",
  "0xb69cb75d63dd9fe93c596febe49e2aaf7e1138fc",
  "0x4baed5adfcfc4c4242e0f36e8e5dda6ef47f4437",
  "0x28cbbb9fa225ca70b674e972aad1572cdd8acecc",
  "0xaea0004a06c76b19d6738da35ad90007def5cd16",
  "0x33c393f9e4694f953f4c3ea6ef2d1b57448073af",
  "0x415699dbe064b6e378aae283bd05744bcb5f6728",
  "0xb091228535fd9113e67767ad260858ad64cd89ca",
  "0x5819e22a7fc7aecab7fce051ae4e85847bfb0161",
  "0xdd12523d9efa549d7886e6ef8b4a8ac60f87de0a",
  "0x52dba3496645ccb226d7fc90c17bdfa8cc6f82ca",
  "0x1c446e7db5c5d44888ae6e3c01858ed7dee6551e",
  "0xf346167c201d6761b86b6ab306e5aaf2996a6cbe",
  "0x686f09aa140253202e5f418651e8488ef437b0ad",
  "0xad501ecefc94c55dd02946d9892517932c67cdb1",
  "0x7fda07ed4f47c885967425e1aff3cb508804f412",
  "0x6c2d91edc8a5091c104a85f17cdc306c5840f87c",
  "0x1f432f09765680cbac994e8fda1f672a602e4014",
  "0x124932b6f96b280d0dde89a910d61bd061269790",
  "0xaf02b2f71ac6b42fb263313bd5e51e4aabf6b807",
  "0x7b980d2d79d2bc8a118d470f21c67843503c4d40",
  "0x6865998c9b0402127af38a7178bfa78857a41a21",
  "0xc9004f1bfd1b6acc83dd74bc53b1c89b02bab11b",
  "0x270ed7b93998a24a347ea62d41177e9eda9a6542",
  "0xe838fd80a8c4d19263f636144e88c5aed9101438",
  "0x299b961474138c53b22bb1bac11b0f9b8b4e1e6a",
  "0xb54866881bec7e6e25eace52a4b10463611c5bd5",
  "0x22d942c8481cdceba7a1ec2ce78b4f1bd1e0ee17",
  "0xcdd067fd45845f7cdf0427df09cc7bfc623a0bba",
  "0x32f35673fbef7a8e49db0b040551e4a55f1c08e5",
  "0x6128564bca9870911a1c0df97c5da70a83855c03",
  "0xd80b33db81436b66b4c256d416ae2a17c97526b5",
  "0xea55df6f96652a65f7f7f7ce7e65eb4d2dc047cf",
  "0x11229e9358c09897ceb7842ad7b1e24e5deb16af",
  "0x2a3726544acca9777a47bd50a05b64b663a4f6a5",
  "0x5c1b324eb3d14a73ee6e16023941b991e311c2e1",
  "0x713d8dd85ebdba53ee7251018fb61f16f3e0fa83",
  "0x4bc88bd3c6e4f8cad49dff22296a4985ed0a2bf8",
  "0x9c94769a69b060bdb0b38b7b27e6374626a41e75",
  "0xe1028fe49df359710e86d43f7545f7c5a19cf287",
  "0x68f68e90f5e2d09c35b9a99b6927452b2e43d900",
  "0x8ef7f81c4c06e25b7ac8ba845de1314faa3fd0c5",
  "0x6b205f1affd0f77e2746c163292e8d20442f42d6",
  "0x6e909fa229a7469be5cc529413bc19d37b76c79c",
  "0x6db3fdcac550294042f6df183701741905229de3",
  "0xf6631c3bf911a0c4fe70d0639538f9a665de6afe",
  "0xb2d3e4d8de1a944dacdd9d045aa7cf963611ee38",
  "0x66cb6ac20496578249a9dd064a234fea20909913",
  "0x8ff49c1fd2a8ea5f8b65f98bdc7cfe372c2959ea",
  "0xba64ceff66464c24c0f277155febea92764f59eb",
  "0x4677cc2739052e1bf47cccd7b2bd893912b2b8a0",
  "0x86081d56d7fba7e38d1e0175e79562c092759df1",
  "0x025c383af9f7fe3288377cd3f0c2fb4f28148eaa",
  "0x3036d7c7f330a4a5eef5c8c959f2d7931248ac0c",
  "0xa776aafb5ed71c2da0c3b85b92ef44bdae7a8a11",
  "0x7b8515a849c8b7ae5da5809d1a30db5a6c834202",
  "0xd4edb9c07f81a00c176c28f6e60009c012e76cee",
  "0x2853958a29d4c4de20052df9727bd06728a0d842",
  "0x0ab05decf91899da0a4037a0e50ad9a132888adb",
  "0x2b317ba38624fc1adfb6256c292262a5d9fc2755",
  "0xbe1bc03b25f5fedfc9edcd36cbe7f1444e26a8b8",
  "0x03c4413365c7376a0ab90288c142bed8c05d2e97",
  "0x00f2e23cdc450a3c35e55495cff31dcf84428acb",
  "0xd61a1fbb282c37fd47e087b01f3276e2a0838abc",
  "0xd09241000e9947b8fdbf8b6143a737a5e1c52a82",
  "0xf46606e539ac74728577b9d48af110e1d75c7d55",
  "0x899826209622c59b7215df32e5b2a6f4e0b848d2",
  "0x1cf2fc76128a0b3ee2f1093ba11f534998e72ff1",
  "0x9a497d2bd398cedeefdbdc4a456fa2989414ad16",
  "0x360de0358583abaedc189e8346f01be00d992865",
  "0x4441cd59bf9e245bc45e9b02a4737aacbcbcf1e7",
  "0xb5fca80baaef5e97ee1a9bf831f1e20cc3ac026c",
  "0xb07c985e03d778d9de8148a7e1de888561a6a2d3",
  "0x55da3f96cd11d2ef423de1adefc30d5bfe6da5e5",
  "0xbc2517950c17f5c3a2576af0cbedfc15a6a5018f",
  "0x2fdb770d0097a65d8f4695711c20ca8b3a0d4b32",
  "0x126c34e6bba10abc8d13d9c3f42c655dd8b7e007",
  "0xf1aa7a5461a7e05118ba161596819ff99dbf1bc3",
  "0x7bd5e015c1a4fb21046d517997c065a0b0d2f4c6",
  "0xb60067db99991bdb3fa282741a08fa54187a464d",
  "0xa97786eb2fc9b06f38c8e324e2eb617a166868d4",
  "0xa25924f2a3ccb6ff36bce794b9073b93c806f238",
  "0x7a4b62075d788a0d63d49275f856e59789ce8e6e",
  "0x33fddb0e8075e9c10617c082d8033e32157e17d2",
  "0x74cace873842d91b2e7b0bf909206c606d493e15",
  "0x78467cb6673a59bc47d344022e500ef81e800a0c",
  "0xf2cd8969794a75c6e2aad3c74282cf782abf9dff",
  "0x682e27232f14313542dfa5b88a688cf683f6c3a7",
  "0x20d66160dc0306c60b97726a0b79ff44997279c1",
  "0x7c79b64274fdd685f063da7afc77a0487267e765",
  "0x9bd44add0c84f92dc6b6bc8aa93ddcad2bd6e0b2",
  "0xb40d3fee4a25cf79f8edad47c38c6e646f2c6deb",
  "0xc45959915af289b1a7d05800a81fc67f24e9490f",
  "0x30f801ffe1ede65623b122ed3f12b940f8533764",
  "0xc2d14c5fba6858b017e0db65744f82abbb63f4ef",
  "0x2ae90487d34afe9fa93eb9835a524fbfc0a044f5",
  "0xe7306d98f44c1f0554f4de60b8326ff7d6eefb56",
  "0x87d7bfd30eaf692782ddc777d19e7872fef3ab52",
  "0x3c1f3efb36d5605d805c8c32ca377b3a8aafac1a",
  "0x2751a56a9f5c0fd7ddd9fd410402774aa181701a",
  "0xd7735a09e4d920ba4aa8baff680992f33cd79483",
  "0xa63185148efb8f612aadd09e787ad7f8bcc68af4",
  "0xe570f92bdb23714a8674e323fdf862def30f457f",
  "0xf05fac21e623a89162bbf0df349e905138683c85",
  "0x0b88b4fa87adb428ce71d9687cb06cbb671b36e5",
  "0x79f90623b4da1e0fc7146f79777d20a6c0f2508b",
  "0x49b5135e0ecc1f3a01d2cc8e6d0d8a78b254303d",
  "0xa9a1067ad45712b61a3517adc26332d396bf2075",
  "0x4d514ab577b9d9face4075f49918ad0b5187b123",
  "0x8abc7fee29ca06d503cd5fe780f401e448d9895b",
  "0xbfc5f118e97b6e3e7d4429c99139085aca1258d3",
  "0x5a805885bea806c154e16d7ac73e28bc05857881",
  "0x2f1a79cf05676870f1fd76b8a519f31ceeb85922",
  "0xce11ad1790b4fd7de1f279df20edb7aae269ff74",
  "0x4291a7a1f2105fe230852bca08a58053996a344b",
  "0xffe8208bb651f488b43cb274eb190eb364041772",
  "0x1a4834c24b4fd38e6c95b2176bb2b629307b7cee",
  "0xcdb062d65131bacd98c3692071beb0fe52efe8a3",
  "0x2cf4c064a692666185f072086efb59957dad4768",
  "0xc7d277ecb1f73ef57b04276a261ce3714ecf2fa5",
  "0x080d07776af70df7055b2de57bf27f362ed26d94",
  "0xd2ce44527a2c29383764cc47671f3f4c8416bf1f",
  "0x2c694bfbd7d2ae18c7752ce7b051d2761c38f280",
  "0xe4ef0cefc2c75f37178e5fed59ffaaad67eef343",
  "0x63ea576d1fdb2cf14d50329aaf721b01066fbc72",
  "0xe9988883b6eebac72ebd815454c1b21da984dbb6",
  "0xd5d63be9b5970206f42f9f4033ca7041bda4cb69",
  "0x3e1f0f277ab2b4d22a9d2120688169ba2ac555cb",
  "0x832bd5c2b6b2732f971d7254edf9ef092df0fa5c",
  "0xe7e1d8e4ec8e0b0ce3a5d489711c1d38a2a6f2ad",
  "0xda322d829aee174fe97eaa21888d05ea8db3190c",
  "0xe29d4a2cd9de6f68aeea1165ef22b49fe4180f17",
  "0x831644d3645d2b589525e362c67cfe5e825da92a",
  "0xe613b359c90058805fa71bbbf1ebd17b1462ed01",
  "0x92e2e1311c672b8b99ceb0b4f32b670c051b8c75",
  "0x8e98f4c20414f0f8d7d8b1f46cf8279e4bfe9ba5",
  "0x6f4b280da15d4dc77f7c4d77176fd01b6b62d640",
  "0xbc8b7249b3e5316b7595fdb14ab89fe3e0f84aca",
  "0xc3f123964a99ac96fc3a6e76d13e951d273c661d",
  "0xaf5bf734062a7fa0c929ad052bafdc3aae7f8bcc",
  "0x08bb0c96f85c65c3f1f7816f0e79c8fa8dd90803",
  "0xfdd632e2a201f375195071be18040c8ade543079",
  "0x95ba8bb25f4d39f554c8bc4b5e943698fc7dcbd1",
  "0xbabe8ed741a0f0f263a057fab9ba73d7017307f5",
  "0x2b1be05d2c4e1be7936c889b3ab652eb88ef5550",
  "0x8316802e070ddf859120b053d1ae274576c1c05e",
  "0xa7d729967f61ba654d9339335122e51211d434f8",
  "0x4393fe22c6521d6a982e41069e9d7e82abcc3c7f",
  "0xe8b887da5e1dba1132b5d33dcc74eb6655b9df21",
  "0x65765f2250bbf1dba244f30e6bdcbd2ab0853935",
  "0x615512a52fdc253e24a3bd4a77e8be3314fd804a",
  "0x7f93252d2b8339335015e82f56a0601d110c634c",
  "0x0e894a1b14f0935d7bd01f9041583edd450a628d",
  "0x9a374c1280c5d712a9c19f938be4a6c0520b9b00",
  "0x1492860052d85d9df610d32f2353d8d1d805d884",
  "0xa022e030d271e8faee5df3987953499adfc370cb",
  "0xada0bc8dfa325203a2c0cd9cc5cbb60cfe94d59a",
  "0xbb554a7523dce56a26fae111378ca7a56fbb0644",
  "0x1ff148d348acd788ce4d8c434e028d029430a091",
  "0xbd1125bc32bf94c741b9ac86afdf0f1251b9a9d6",
  "0x12833f7523017e86a31252ddab45782a302a37ae",
  "0xfa9cd6404f6daf084a9b2f7ee1e194a88f9f4ebb",
  "0xf4b8f59eb36bc56cad663f65cf61e7d162b74258",
  "0x4238cf9aeea3cb3952ea516a5e730da9f7542fba",
  "0xc140bc48923d2e55c0f48d80cc7e89f5b2d4ecd9",
  "0x5bbea05820f9ad9abb7f3cd0fc393a5cd81f3425",
  "0xb41d4efeba206fb5172b30cc24a852f57924e2d9",
  "0xfbc5ff9e52253418ade363ff0172b5e99e5cf831",
  "0xc7881d6b0fa9d59bb135ece7825b1dfeb80b519d",
  "0x8299575c2e679f9c5dc9e5828d9b814f5f58e947",
  "0x6bc7330519292394d224945835d5b66529e46e6c",
  "0x4e41d5e9c31f79a0cbe39c6cab23a854c3ad48b0",
  "0xc1c2f307a99e854d44a6085d46793219b5862189",
  "0xb16ccc3e2b315510b2ece563072087e9eb42c209",
  "0xfdf584cc15df91951096cbe99d969406f66bedac",
  "0xaaf9b375e5992b1537d9df6c39c44bec3b80ed11",
  "0x1d88163187b9735993899030fca2a18dfb152a9f",
  "0x96f41a3424eaf3968ede6d2c9b4db3fbb208c715",
  "0xbdc182e735b1d3e0ae96be03048550b4f879b90c",
  "0x0206e8ccd45dc72e9413b92b72dd9580fda651a5",
  "0x1053d6708a4a8b7d0847cdc44ec56da077f81c02",
  "0xc8bc842047c01b916df772f4d3c6eeb3c7de1bbd",
  "0xb325133fa6efa7f7724516d00443ce4131a8f2dc",
  "0xbd90df0490414447d6f51b5722e3c01f35e67c96",
  "0xc17ee712b2472fe4b544b2ab86ad689a35efa104",
  "0x0d94155456aa8d75fe38d5b5bb4dae8038cfd258",
  "0xadad4d286c18ed293d4a40bf78fd6ef51b5a1501",
  "0x7cce400bf52e9eda7d45d66a5bcf2a12b6a78b9d",
  "0xc7547840fc5045dcb4e2f06fccd8cf66d28b7fdb",
  "0x592cd7bdc055d7ec5bd79f2ee0e2a8f393f9a4fe",
  "0x51a8651dafc87f5d1c3f0152100320fd59128899",
  "0x21fb7fbd85edfa58b86a2207bed77fd1eee1365b",
  "0x5a53820c986f4b9128b645412374421537eeb10f",
  "0x1bac1ff91a7a144d06057d6780b2c4eb61a9494b",
  "0x2750fe7f4d33ab3b34e24787caa9da7941ad2a71",
  "0xb1010c93ab1ec44118b843856e7b9104a4276d76",
  "0x22d85c42692b81ad11ecc49dd738815106fad136",
  "0x36bb7b558aaf4c9c0a2648326f28059b9a18e35e",
  "0x3df8ddc05de68911b4091911691532458d27b592",
  "0x37aa91abff5dcd25e66dc6263d787ffe578a704c",
  "0x4829e204e752b5b2289a1bb7f073161bf55e4049",
  "0xc0f197e5c9230507382244ceb10c254e64f94012",
  "0x9d5036bee7275c9106b043b6f0252c8332fd7722",
  "0x866bd0862e42a9cb44ef9a1ac044809b98a49444",
  "0x4852f9eebdde495d0f02d158d1025c4b5d78742e",
  "0x138126dd0a29fb6dc2d116d50fb1ec31e870fff0",
  "0xb52c0f6082b2300bd84b08871b0c1b0c25e7dd6f",
  "0x042e4b4e971d8deccf1212351d3cdccbd461ecbd",
  "0xdc820df01b5b8fdbbf6d6d617d1ed82448f9061d",
  "0x7ffccf1e5fe934bebb5079077453565cd015372d",
  "0x420806e463420744bfdb87a84e7321b42d4e3c3e",
  "0xd918efc50ca1f4d6d368c319432436c5070d1deb",
  "0x375a0f470e13e3e59bce9103aaab9ac3f5f93bf5",
  "0xba73a608201cf1d079d42a4b08761be0ebd90c0e",
  "0xb56aa48ad41d9f3277e05f66a5cf576fdb212f6a",
  "0x29480b83b31161ebf7cb501df122c7e69c4a22e7",
  "0x1f14542dcb4129063ef7b987fdb1e108f0b00b39",
  "0x0c58e0d48e8170704f22b292ebf50115baa254c1",
  "0x0250226fa5852405061ff957a2180306f7df91be",
  "0x255bfa08faaaaabd3c26c9cdb63aff6ba55e14b2",
  "0xc42e8ce7158a23ca8e8e11cdbcabf984ddc17f06",
  "0x0cf01e469aacfb1ae8265068998b27770949d159",
  "0x0a4eb6cd59273c2e60cff97e0dcf2afa6f1413ab",
  "0x9fe34480fbfc7802f6c9195806ef61a69e03dd4a",
  "0x00fddf4985beeef23a101c03b304e67340d9ec75",
  "0xdc9ff9662042accb1e23cf4337d1d326c62146ac",
  "0xad5afa01db562959940f74b4c0acbd5318d37d5b",
  "0xd35a1a8891cd24e3a8ae9dca191bd1f232378da7",
  "0x249ce4d9f923dbed3406886e5fd36364befece86",
  "0x4010f0a9bc7ca8bd982e135f65d242e29e665572",
  "0xde84f6b5c43aa1df16323831b54aa9b14a8bd67e",
  "0x6b7fb58ca40e79228e07f97f99abb390e2205aac",
  "0xdddbb2bde072c5f7a19c701003ed286915b8c05f",
  "0x85b6b354c0e353707759840318a3d62d172bc736",
  "0xe623022bbabe496f9f30b2f2f008cfdbf125b499",
  "0x39b9b92639cf260a4298a17c6b5984006c020ea8",
  "0x2f7dc064f3af3e627716afb82c8b25142dc28128",
  "0x54be82602f620a300de36dcf15f2b173f41e9cb4",
  "0x4b0c451701859434d35d20ef2144de9f0dfebe02",
  "0x5ba035b79efd2c1ec838643596adfd39653dd37d",
  "0x4ba98bc5f68d362f446a6f78244d6652436c6a7b",
  "0xf507163f475e5a6a4d8ef35b8fff96f21715dba1",
  "0x45404089c1ee5901b3b62dd411705112efec2aac",
  "0x561e976a38984f1890ee74a94b4d2a77aac9651a",
  "0x1b39e6704ab01abbfa5104c5873bc5b1e17d8713",
  "0x185bace97b47237cd12da832fc3b239e55078801",
  "0x13a0868e66fab313ac6d20d60b0002317fa9c0fa",
  "0x13ab3d1df6379c39c72e9246bd7fbcc04785a8b0",
  "0xc4faf7b0cc51822afd611c1cc361465906918c84",
  "0x2fc6ed7f5fbcb7269b1f8e3ac47dea52b67167dc",
  "0x6b96ea4ab01f27b4ad65ad9edcd4e95a95554504",
  "0xaa84e35833e6fd36ee3ae1fc2cf218cce2cb66fb",
  "0xae387c9d59b54e6596ed7e4546145348a23f9d29",
  "0xb7b47441443663278a1d698150a5d484a36ab7bf",
  "0x6b1c823b188a099fbe0a04405fc2b578bd102c2d",
  "0x4389191ac44b15143c8f7df5892a8426199503b7",
  "0xb0e5a66433ac17692a0881cfc88a47945266cd73",
  "0x32270bff407f4d563d9dcec2b009ec611f08c804",
  "0x7ad7cfaa804343cd7dab0b3bedc52236dc1eff5d",
  "0x703a47dade77665bbe018acef02b2ca09b61b060",
  "0xa9b8a8f5d4a085693241337e2a43b866f841d2a0",
  "0xf30b48b742155a0ecacdebaca89be4c8b5fce0a1",
  "0xa0040710e13b5d1cd22bd063fc419efea707f419",
  "0xbbf835eaa1fd75fc013116c59b2be556264af809",
  "0xbbacb671d33f363e2f762519c1725d79fa7064fe",
  "0x34dc85735cd7f8442cdc2cda5109636a85f35724",
  "0x75bcb72c4cf20d013160e00ee9b744142e5d7d97",
  "0x6aabe06a8ef91553c6fc8db8beb3459c0af7843f",
  "0xd542259cec4ecddbde641dc463bd46a8b3466dcd",
  "0x1bf560ca5bfff72ce8d6f57d3ee2ba3d0dd66410",
  "0xec98a59fe78275301213ef01c4a0189dd80d6760",
  "0xd2f0e23155cb582ea9f59942335eda8ca7a5a41e",
  "0x20bcfafe11d53e17ac60d658c719d67cc297ab96",
  "0x3a931f4c37d3e97f3e47705e4dfb068342e6083c",
  "0xf02a6d7964612e1db5ddc700519abd647caee349",
  "0xb7cdd808d841252ef14db785ad0d030d273d5a83",
  "0xe98a023fa296c6484cfc13a24e12ff19e671b412",
  "0xe9820dd869a4d96d0c0e0d8ff816d3bd5b45c8a4",
  "0xa724b84d5973f67f194ace9ca3c182cef04410b4",
  "0xa4542dd7aab6094741c72edc0adeaf638fb09bf8",
  "0x52c3f97a617244003409cd3466113ffaea78c9a2",
  "0xf1f136043a8499f18db8fee09aebf10d7ce8ea95",
  "0x012d97792157f1eb1b4a6e545b55e31d1f188e02",
  "0xe4f54d61dc91143e11fae17ad0735716550241f8",
  "0x8449b9fe1694addbba4854c580e5804346f5d6fc",
  "0x592890ab916dc98e117ea2771a37d82a38df6b04",
  "0xba80aa4d98fb52e25c92448d2c798a6adc1b70cc",
  "0xa61aacaf6d74781638cc2b6fc51f0339a6ecbbdb",
  "0xf294611a0b489436346a88210ddcab42b3f8a1a0",
  "0x045825aeba1786c77f6d5bf81473cd5b3b904844",
  "0x1106b3448e9ea2b3b1062e4110f132d9a2cc1cf8",
  "0x466279b98d5d915a9fdc35d352969fce7a1654e9",
  "0x4b6496c395fcaa761b3c186aec4e652b9f69aa0a",
  "0x968a362f942f7724498a9f327d8db55cad1f55d0",
  "0xaaa1e1d55f54605ada8e30f9c0dacbb2b8b79943",
  "0x769869f98735f862c9aef30264e392959948684c",
  "0x489a1722bec29b9241ed7b34cbc38d702648cc3f",
  "0x6f5800eb9427d6da108e22802280df5c4fd1a0c6",
  "0xc34887755becdf27880c13f11ee98c228fb76d77",
  "0xf04abc5196f9491b2afa80d7283e2f582ab3b7e3",
  "0x5a12e0d81a91ae35806b93ea668e8951b8eb46e7",
  "0xd9d3b4b2fd3540d191f9096478af519e91cd17fc",
  "0x3b04f64c5cdde3c16a456c38e967c6c50cf15105",
  "0x07ffa63eba9d8798b8679f32a75147f585c49a87",
  "0xa3135ff29f6a42e85be71161b5fd3e87cf9061c1",
  "0x76ce9c47dd23c52f08a4d059d7b9183539ca24e5",
  "0x31f49037076160c1bd57d30677df47cf4435ec36",
  "0xa7271434549117ed9657a976678ebbece44376d4",
  "0x247741cfeef9e99d335bbf559f4f5f6f63702006",
  "0x78e1374ca4a77a9698bf22df556877ebbbc63dcd",
  "0xc4ae00ae5fcdd4c9f885a50440856f7f7e518b6e",
  "0x42d7b83f9a1b818228e694c48a57470456d94759",
  "0x6d0b617e63974fb876fc578bbb44c88055158e09",
  "0xaf44d5b49a703bbee6fe06b6c004be3ad4d16583",
  "0x6d6a4d1d39b5913a439f6eabdcaf39b719728a4d",
  "0x9d08440d056d697d4a980d2e20593e336acbebf5",
  "0xd45f9b4629ea7cbba5f53d2450e345ea5d75692d",
  "0xbfc5334885807550719be541b6b507b7a6e2d65b",
  "0x17b101d537e9cfd7dba80d2058dc31bf326d3011",
  "0x425f4772d28d10b79fb4730fd92dae9090ad87ca",
  "0x8e540305fda526ed8e1b12dde56804c923133118",
  "0xe71ef3ba3458a0917c358deff5899396ff635698",
  "0xad2ab45bf39e85dd1264e50059b2483ce5149e2e",
  "0x6960d12523c60b1136168759306cd61ae37b9271",
  "0xef62d79ef38e73d84fe7be5cb1f69e3e689c2b72",
  "0x9be13dea542f31a24b4fa2a235dac2cebf1da5ba",
  "0x82d32915b0080f14334ad754d397da886a702acd",
  "0xc4e9ac404cf455141f70bb2901094d6d8e9708a5",
  "0x3bfe89f1fa8b1c2a8dc8cb8dccaab5b501820938",
  "0x7a603c885ddfd0bfde8f6f3c9a9aebe0629d3efc",
  "0x38ee3d5fc400110464bd1b1e2a5bfd9294f262c9",
  "0xbac9cdfdbf7bd8df046209012ee283e8d6eb2465",
  "0x5ed53206bb89fa6868f7615aff91ce5783449db4",
  "0x1d3b9753d9c4501fa842d6456dbacc03e9a4cc24",
  "0xd953d4061d68a905543bb0f5912179e186e82186",
  "0x96d5f39a83c9f6fb4ffddf8d13b6142cf85f0cfe",
  "0x4760ddc205717a8665dba3d613973889bf3e4b1c",
  "0x9a9f7fafee191635ef933734de4361820d41412c",
  "0x2a2a504b7d4abff7e93c44ec7ba64f5d0b8680df",
  "0x27e92b3fb829bf446f68b03740af9177efc48c1c",
  "0x7bad456444b754bfdc7643cbae088aa4f3f8c07a",
  "0x8ce88b8d026acf3d647e0fe2d81f267f3a10fcd7",
  "0x413ed79b90185607c0fe8a0b247e0d82d685050d",
  "0xe30320adf07090c1caa8a82874bf7f8c74785652",
  "0xbeefa31b5f0d84ca4633030e05b03405763a16c7",
  "0x3377efa01e0a1e1f163b42d150039f5661467c0d",
  "0x46a0a3a46b08eb0acded51b6fde712019f78c47b",
  "0xa863b8ae3df66dbdc57fac0324deb2a18a698a7c",
  "0x0b7c4f203faf2d1fa5dc59f9ce548066ccdaf845",
  "0x10497611ee6524d75fc45e3739f472f83e282ad5",
  "0xf29675b68b808f418a4c2e687b5510ba9ea9fbff",
  "0xc32651402e02de8dd6222273c6775bac878ae2ea",
  "0x81b4d47c0a05aa8a9059ac2334a0afc69e79b95f",
  "0x1bd17b0ea4d977d11009d0241415a14b990bc730",
  "0xf8eef1c62dca77ec25c9ff01c054c93913a60408",
  "0xdf559258fcac69bca2d4684c907f4b3f4252e49c",
  "0x04d4961d12845a4b31b1186a0552a800420ac075",
  "0x9e7c32c8271c6f19e853d00da890466f8b1b20d3",
  "0xb35b816d496c171d4af3233425017e0e500b665a",
  "0xeedb0db024722ce11be0976c3bfdf5956143f838",
  "0x1bc2f9339c75bf2b564997d387d60b123cc0fbbd",
  "0xfd1dff97f8b3908349a120dc1cf1a262beee5d0e",
  "0x867b863a8df3906d09dce9a8083b4052f5e21bbe",
  "0xe21c6e1763016c81c5fd9d14e5f5d17cbe705436",
  "0x2e9e0650f5fc7e85e47325f34ffa44cc160cc6b1",
  "0x06f8d8fb112e27c72a8f97dc5f0a793ff00df442",
  "0x7361b8529f59812c5d7b3a84ee983d08a3206ef9",
  "0x8e3ee5317b6464ed0cc8597ad77a0b7c865e4274",
  "0x7d7fc7f467dea9e8ae96144b52efbeffa2c63012",
  "0x73540e993d4a6ae20f2984571bb2629615119ee2",
  "0x238e85c7165d9dfa00ad4cc95dbb246172b2ecbd",
  "0xa1254ba759250af3d6ff780eda2ad51b7910324a",
  "0xa41dbae5de50fb9e4e67edfa99f00e4d7cc1a425",
  "0x6409373861cabc11e0d30f82d8bd426d34641ad8",
  "0x89f4c3f3ff072a005a70d390136f2fdd1f1a1b2e",
  "0x9ee7763b3f7e37dc298689413f07b79744ba6af9",
  "0xbfb427039eb3e267ef54af33bf30172b0366a13e",
  "0xb054e124d512fe43d3efbb64ae0e38740a0c117a",
  "0x18f46b48830a80fc2a7221624eaa6cfec9e0cdca",
  "0xe6a9a838e73ddfc00a23f9af236e54e083101933",
  "0x403cb69b0995ed3995feec126ba6b7a384a2ab60",
  "0xa380b30d615660a838dcaa7c1c2012f112105e1c",
  "0xaaad45fd9e4e982fc3c5583b2001f9bc2fd9ed40",
  "0xfbace2e92b9f3fe82a8e5ea31800680f61afdc23",
  "0x9db28ac9b1288ae00cc4c01eeb651605949c8d02",
  "0xdc67573a2aca5ce03044fe187b3793aff8789046",
  "0xda6e18e762e9c279629debfee34750dfae26ccb0",
  "0xc055175a30406957dd7c3e86eb6ae3478d2c235c",
  "0xa83b706e7b350d1b36bb6afbbf6c38ff0d9b7f8f",
  "0x58a5731ee4a65343c590aa479b43a25a949539d7",
  "0xe7128acaa7e41b1369175a98d199b6a5bccbca82",
  "0x0cc5aa8ca8ae6af54f131b0a2f46289f73ea955e",
  "0x37e0c51350df09d48471018cd7462ef03aea5b6c",
  "0xe1e2758b78375a6217d50a21922b9a90cca755e1",
  "0xf343c311097b8ec3ad12fe0a6b02623b5d886e97",
  "0xc4d69e24f4360d65167c02bf32a805f9c364585a",
  "0x6dbf0d90ac745972928f2259a13f03143a5d206c",
  "0x223ee31e3031edc7981ec14ce3ebbffd5f8f60af",
  "0xbbeca4d05e7287e500f509ad822d3e1701059658",
  "0x09cabec1ead1c0ba254b09efb3ee13841712be14",
  "0xa2881a90bf33f03e7a3f803765cd2ed5c8928dfb",
  "0x97dec872013f6b5fb443861090ad931542878126",
  "0x2a1530c4c41db0b0b2bb646cb5eb1a67b7158667",
  "0xb944d13b2f4047fc7bd3f7013bcf01b115fb260d",
  "0x3e0349f5d38414008b9bb1907ea422739be7cd4c",
  "0x2c4bd064b998838076fa341a83d007fc2fa50957",
  "0x34e89740adf97c3a9d3f63cc2ce4a914382c230b",
  "0xb92de8b30584392af27726d5ce04ef3c4e5c9924",
  "0xa7298541e52f96d42382ecbe4f242cbcbc534d02",
  "0x49c4f9bc14884f6210f28342ced592a633801a8b",
  "0x7cfab87aac0899c093235b342ac0e5b1acf159eb",
  "0x81eed7f1ecbd7fa9978fcc7584296fb0c215dc5c",
  "0xbd04c3749506ce30eed93c06f93f18223c3ff5aa",
  "0xe9a5bbe41dc63d555e06746b047d624e3343ea52",
  "0xf173214c720f58e03e194085b1db28b50acdeead",
  "0xc040d51b07aea5d94a89bc21e8078b77366fc6c7",
  "0x2e642b8d59b45a1d8c5aef716a84ff44ea665914",
  "0x4ff7fa493559c40abd6d157a0bfc35df68d8d0ac",
  "0x8fb16c97b1f702cdbf1c4125cf3cf074ff5bef4e",
  "0x91debb54de02872a259c17699d9b794bc949fed2",
  "0xfc96e234d4b31c63051e707105fcc4aba37807fa",
  "0xa539baaa3aca455c986bb1e25301cef936ce1b65",
  "0x7a250d5630b4cf539739df2c5dacb4c659f2488d",
  "0x571df05fb80550187082bf2d6947c403abc6130f",
  "0x0f2b0e9db46c6b538e9276d2cf0c6ce8d515eca1",
  "0x6d81dda24b7ff5b4a65039ff15d06a076e018e49",
  "0x80dc050a8c923c0051d438026f1192d53033728c",
  "0xb18d4f69627f8320619a696202ad2c430cef7c53",
  "0x68f3e9f797f6caad4caf18b7662063d03b4c5471",
  "0xf28f37943a092580c522304f35ca597efabcf449",
  "0x1111111254eeb25477b68fb85ed929f73a960582",
  "0x9008d19f58aabd9ed0d60971565aa8510560ab41",
  "0xd9938a9f1f1321cf6b28bf13a9164dd0a659f55d",
  "0x111111125421ca6dc452d289314280a0f8842a65",
  "0x256d34a30463ef223b5b8091c3eb8d8807c66ab6",
];

export async function taskGetAddressOwnRealToken(tempData: string) {
  // Récupération des URLs d'API depuis les variables d'environnement
  const envString = process.env.ENDPOINT_EXTRA;
  const parsedArray = envString ? JSON.parse(envString) : [];
  const defaultUrls = [...parsedArray, "https://api.realtoken.network/graphql"];

  // Demande à l'utilisateur de choisir les URLs à utiliser
  const selectedUrls = await askUrls(defaultUrls, false);
  const url = Array.isArray(selectedUrls) ? selectedUrls[0] : selectedUrls;

  // Initialisation de l'ensemble des détenteurs de tokens
  const listHlodersOwnToken: Set<string> = new Set();
  if (tempData !== "") {
    const { result } = JSON.parse(tempData);
    result.holders.forEach((holder: string) => listHlodersOwnToken.add(holder));
  }

  // Création du client GraphQL
  const client = createGraphQLClient(url);

  // Récupération de la liste de tous les tokens
  const allTokens = await getListTokensUUID(client);

  // Demande à l'utilisateur de sélectionner les adresses de tokens
  const selectedTokenAddresses = await askTokenAddresses(allTokens);

  // Demande à l'utilisateur de spécifier la plage de dates
  const { startDate, endDate, snapshotTime } = await askDateRange();
  console.info(
    i18n.t("tasks.getAddressOwnRealToken.askDateRange", {
      startDate,
      endDate,
      snapshotTime,
    })
  );

  let startDateStr = new Date(`${startDate}T${snapshotTime}:00Z`);
  const endDateStr = new Date(`${endDate}T${snapshotTime}:00Z`);

  // Définition du chemin du fichier de sortie
  const pathFile = path.join(__dirname, "../../", "outDatas/listeHolderOwnRealToken_tmp.json");

  // Boucle sur chaque jour de la plage de dates
  while (startDateStr <= endDateStr) {
    const timestamp = Math.floor(startDateStr.getTime() / 1000);
    console.log(i18n.t("tasks.getAddressOwnRealToken.currentTimestamp"), timestamp, new Date(timestamp * 1000));

    // Récupération des détenteurs de tokens pour le timestamp donné
    const holdersOwnRealToken = await getHoldersOwnRealToken(client, selectedTokenAddresses, timestamp);

    // Traitement des données des détenteurs
    for (const token of holdersOwnRealToken.tokens) {
      for (const balance of token.balances) {
        if (new BigNumber(balance.total).gt(0) && !addressExclude.includes(balance.addressHolder.toLowerCase())) {
          listHlodersOwnToken.add(balance.addressHolder);
        }
      }
    }

    console.info(i18n.t("tasks.getAddressOwnRealToken.infoNumberOfHolders"), listHlodersOwnToken.size);

    // Écriture des résultats dans le fichier de sortie
    fs.writeFileSync(
      pathFile,
      JSON.stringify({ result: { holders: Array.from(listHlodersOwnToken) }, params: {} }, null, 2)
    );

    // Passage au jour suivant
    startDateStr.setDate(startDateStr.getDate() + 1);
  }

  return pathFile;
}
