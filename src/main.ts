import QRCode from "qrcode";
import h from "hyperscript";
import { O, G, R, pipe } from "@mobily/ts-belt";
import z from "zod";

const wifiType = ["WEP", "WPA", "nopass"] as const;

type WifiSchema = z.infer<typeof wifiSchema>;
const wifiSchema = z.object({
  type: z.enum(wifiType),
  ssid: z.string(),
  wifipassword: z.string(),
  hidden: z.literal("true").optional(),
  detailoverlay: z.literal("true").optional(),
});

const EXCLUDE_KEY = "__X";

const parameters = {
  T: "Authentication type",
  S: "Network SSID",
  P: "Password",
  H: "is SSID hidden?",
  [EXCLUDE_KEY]: "exclude",
} as const;

const paramSchemaMap: Record<keyof WifiSchema, keyof typeof parameters> = {
  type: "T",
  ssid: "S",
  hidden: "H",
  wifipassword: "P",
  detailoverlay: "__X",
};
const safeString = (str: string): string => str.replace(/([\\;,":])/g, "$1");

type Entries<T> = {
  [K in keyof T]: [K, T[K]];
}[keyof T][];

const parseSchemaToSpec = (wifiObj: WifiSchema): string => {
  const tup = Object.entries(wifiObj) as Entries<WifiSchema>;
  return (
    tup.reduce((str, kvPair) => {
      if (G.isNullable(kvPair)) return str;
      const [schemaKey, value] = kvPair;
      if (G.isNullable(value)) return str;

      const specKey = paramSchemaMap[schemaKey];
      if (specKey === EXCLUDE_KEY) return str;

      const userValue = safeString(value.toString());

      return `${str}${specKey}:${userValue};`;
    }, "WIFI:") + ";"
  );
};

const linkFormEvents = (
  cb: (data: { [k: string]: FormDataEntryValue }) => void
) => {
  const elForm = document.getElementById("wifi-details");
  if (!(elForm instanceof HTMLFormElement)) return;

  elForm.onsubmit = (e: SubmitEvent) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(elForm));

    cb(data);
  };
};
const parse = (d: unknown) => wifiSchema.parse(d);
const generateQr = (data: WifiSchema) => parseSchemaToSpec(data);

const output = (wifiString: string) => {
  const elImg = document.getElementById("qr");
  if (!(elImg instanceof HTMLImageElement)) return;

  QRCode.toDataURL(wifiString, { errorCorrectionLevel: "Q", width: 1024 }).then(
    (d) => {
      elImg.src = d;
    }
  );
};
const renderErrors = () => {};

const processFormData = (data: Record<string, unknown>): void =>
  void pipe(
    data,
    R.fromNullable("no form data"),
    R.map(parse),
    R.tap(setupDom),
    R.map(generateQr),
    R.tap(output),
    R.tapError(renderErrors)
  );

const main = () => {
  linkFormEvents(processFormData);
};

main();

const createOverLay = (data: WifiSchema) =>
  data.detailoverlay
    ? h(
        "div",
        {
          style: `
      position: absolute; 
      background: var(--pico-background-color);
      border: 2px solid var(--pico-contrast-background);
      border-radius: .25rem;
      text-align: center;
      padding: 0 .25rem;
      `,
        },
        [
          h("p", { style: "margin-bottom: 0.1rem;" }, h("b", "WIFI")),
          h(
            "p",
            {
              style: `
          margin-bottom: 0rem;
          font-size: smaller;
        `,
            },
            data.ssid
          ),
          h(
            "p",
            {
              style: `
          margin-bottom: 0rem;
          font-size: smaller;
        `,
            },
            data.wifipassword
          ),
        ]
      )
    : h("div");

const createQrSlot = () =>
  h("img", {
    id: "qr",
    style: `
      border-radius: 0.25rem;
    `,
  });
const clearDom = () => {
  const elQrSlot = document.getElementById("qr-slot")!;
  elQrSlot.innerHTML = "";

  return elQrSlot;
};
const appendable = (elChild: HTMLElement) => (elParent: HTMLElement) =>
  elParent.appendChild(elChild);

const setupDom = (data: WifiSchema) =>
  pipe(
    O.fromExecution(clearDom),
    O.tap(appendable(createOverLay(data))),
    O.tap(appendable(createQrSlot()))
  );
