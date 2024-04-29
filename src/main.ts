import QRCode from "qrcode";
import h from "hyperscript";
import { O, G, R, pipe } from "@mobily/ts-belt";
import z from "zod";

const EXCLUDE_KEY = "__X";

const wifiType = ["WEP", "WPA", "nopass"] as const;

type Entries<T> = {
  [K in keyof T]: [K, T[K]];
}[keyof T][];

type WifiSchema = z.infer<typeof wifiSchema>;
const wifiSchema = z.object({
  type: z.enum(wifiType),
  ssid: z.string(),
  wifipassword: z.string(),
  hidden: z.literal("true").optional(),
  detailoverlay: z.literal("true").optional(),
});

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
  detailoverlay: EXCLUDE_KEY,
};

const safeString = (str: string): string => str.replace(/([\\;,":])/g, "$1");
const renderErrors = console.error;

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

  const handler = () => {
    const data = Object.fromEntries(new FormData(elForm));

    cb(data);
  };

  elForm.onsubmit = (e: SubmitEvent) => {
    e.preventDefault();
  };

  elForm.onchange = handler;
  elForm.onkeyup = handler;
};

const parse = (d: unknown) => wifiSchema.parse(d);
const generateQr = (data: WifiSchema) => parseSchemaToSpec(data);

const output = (wifiString: string) => {
  const elImg = document.querySelector("#qr-slot img");
  if (!(elImg instanceof HTMLImageElement)) return;

  QRCode.toDataURL(wifiString, { errorCorrectionLevel: "Q", width: 1024 }).then(
    (d) => {
      elImg.src = d;
    }
  );
};

const createOverLay = (data: WifiSchema): Element =>
  data.detailoverlay
    ? h("div.qr-overlay", [
        h("p.qr-overlay__heading", h("b", "WIFI")),
        h("p.qr-overlay__body", data.ssid),
        h("p.qr-overlay__body", data.wifipassword),
      ])
    : h("div");

const createQrSlot = (): Element => h("img");

const clearDom = (): Element => {
  const elQrSlot = document.getElementById("qr-slot")!;
  elQrSlot.innerHTML = "";

  return elQrSlot;
};

const appendable =
  (elChild: Element) =>
  (elParent: Element): Element =>
    elParent.appendChild(elChild);

// TODO - this should be a few processes; map data to "slots", clear existing, apply "slots".
const setupQrSlot = (data: WifiSchema) =>
  pipe(
    O.fromExecution(clearDom),
    O.tap(appendable(createOverLay(data))),
    O.tap(appendable(createQrSlot()))
  );

const processFormData = (data: Record<string, unknown>): void =>
  void pipe(
    data,
    R.fromNullable("no form data"),
    R.map(parse),
    R.tap(setupQrSlot),
    R.map(generateQr),
    R.tap(output),
    R.tapError(renderErrors)
  );

const main = () => linkFormEvents(processFormData);

main();
