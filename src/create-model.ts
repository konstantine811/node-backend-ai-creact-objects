import * as tf from "@tensorflow/tfjs-node";
import * as fs from "fs";

// ---------- Типи даних з датасету ----------
type LabelType = "cube" | "sphere";
type LabelColor = "red" | "blue" | "green" | "yellow" | "white";

interface SampleLabel {
  type: LabelType;
  color: LabelColor;
  radius: number;
  posX: number;
  posY: number;
  posZ: number;
  sizeX: number;
  sizeY: number;
  sizeZ: number;
}

interface SampleRow {
  text: string;
  label: SampleLabel;
}

// ---------- Константи ----------
const MAX_TOKENS = 20;

// це наші категорії для класифікаційних голів
const TYPE_TO_ID: Record<LabelType, number> = {
  cube: 0,
  sphere: 1,
};

const COLOR_TO_ID: Record<LabelColor, number> = {
  red: 0,
  blue: 1,
  green: 2,
  yellow: 3,
  white: 4,
};

// ---------- 1. зчитуємо датасет ----------
const raw = fs.readFileSync("./dataset.json", "utf-8");
const rawData: SampleRow[] = JSON.parse(raw);

// ---------- 2. токенізація і побудова словника ----------
function tokenizeSimple(text: string): string[] {
  return text.toLowerCase().replace(/[(),]/g, " ").split(/\s+/).filter(Boolean);
}

// зібрати всі токени
const allTokens = new Set<string>();
for (const sample of rawData) {
  const toks = tokenizeSimple(sample.text);
  toks.forEach((tok) => allTokens.add(tok));
}

// vocabList: перший токен <pad> = 0
const vocabList: string[] = ["<pad>", ...Array.from(allTokens)];

// Record<string, number> дає індексну сигнатуру
const vocab: Record<string, number> = {};
vocabList.forEach((word, idx) => {
  vocab[word] = idx;
});

const VOCAB_SIZE = vocabList.length;

// ---------- 3. Допоміжна функція: text -> ids ----------
function textToIds(text: string): number[] {
  const toks = tokenizeSimple(text);

  let ids = toks.map((t) => (t in vocab ? vocab[t] : 0)); // невідомі -> 0 (<pad>)
  if (ids.length > MAX_TOKENS) {
    ids = ids.slice(0, MAX_TOKENS);
  } else {
    while (ids.length < MAX_TOKENS) {
      ids.push(0);
    }
  }

  return ids;
}

// ---------- 4. Створюємо X і y ----------
const X_tokens: number[][] = [];
const y_type: number[] = [];
const y_color: number[] = [];
const y_size: [number, number, number][] = [];
const y_radius: [number][] = [];
const y_pos: [number, number, number][] = [];

for (const sample of rawData) {
  const { text, label } = sample;

  X_tokens.push(textToIds(text));

  // TS тепер знає, що label.type належить 'cube' | 'sphere'
  y_type.push(TYPE_TO_ID[label.type]);

  // color те саме ('red' | ... 'white')
  y_color.push(COLOR_TO_ID[label.color]);

  y_size.push([label.sizeX, label.sizeY, label.sizeZ]);
  y_radius.push([label.radius]);
  y_pos.push([label.posX, label.posY, label.posZ]);
}

// ---------- 5. Перетворюємо в тензори ----------
const X_tokens_tf = tf.tensor2d(
  X_tokens,
  [X_tokens.length, MAX_TOKENS],
  "int32"
);
const y_type_tf = tf.tensor1d(y_type, "float32"); // <- тепер float32
const y_color_tf = tf.tensor1d(y_color, "float32");
const y_size_tf = tf.tensor2d(y_size, [y_size.length, 3], "float32"); // [N,3]
const y_radius_tf = tf.tensor2d(y_radius, [y_radius.length, 1], "float32"); // [N,1]
const y_pos_tf = tf.tensor2d(y_pos, [y_pos.length, 3], "float32"); // [N,3]

// ---------- 6. Будуємо модель ----------
function createModel() {
  const EMBED_DIM = 32;
  const LSTM_UNITS = 64;

  const input = tf.input({
    shape: [MAX_TOKENS],
    dtype: "int32",
    name: "textTokens",
  });

  const embed = tf.layers
    .embedding({
      inputDim: VOCAB_SIZE,
      outputDim: EMBED_DIM,
      inputLength: MAX_TOKENS,
      maskZero: true,
      name: "embedding",
    })
    .apply(input) as tf.SymbolicTensor;

  const lstmOut = tf.layers
    .lstm({
      units: LSTM_UNITS,
      name: "encoder",
    })
    .apply(embed) as tf.SymbolicTensor;

  const typeHead = tf.layers
    .dense({
      units: 2, // cube / sphere
      activation: "softmax",
      name: "typeHead",
    })
    .apply(lstmOut) as tf.SymbolicTensor;

  const colorHead = tf.layers
    .dense({
      units: 5, // red / blue / green / yellow / white
      activation: "softmax",
      name: "colorHead",
    })
    .apply(lstmOut) as tf.SymbolicTensor;

  const sizeHead = tf.layers
    .dense({ units: 3, activation: "softplus", name: "sizeHead" })
    .apply(lstmOut) as tf.SymbolicTensor;
  const radiusHead = tf.layers
    .dense({ units: 1, activation: "softplus", name: "radiusHead" })
    .apply(lstmOut) as tf.SymbolicTensor;

  const posHead = tf.layers
    .dense({
      units: 3,
      activation: "linear",
      name: "posHead",
    })
    .apply(lstmOut) as tf.SymbolicTensor;

  const model = tf.model({
    inputs: input,
    outputs: [typeHead, colorHead, sizeHead, radiusHead, posHead],
  });

  model.compile({
    optimizer: tf.train.adam(1e-3),
    loss: {
      typeHead: "sparseCategoricalCrossentropy",
      colorHead: "sparseCategoricalCrossentropy",
      sizeHead: "meanSquaredError",
      radiusHead: "meanSquaredError",
      posHead: "meanSquaredError",
    },
    metrics: {
      typeHead: "accuracy",
      colorHead: "accuracy",
      sizeHead: "mae",
      radiusHead: "mae",
      posHead: "mae",
    },
  });

  return model;
}

// ---------- 7. Тренування і збереження ----------
async function main() {
  const model = createModel();

  await model.fit(
    X_tokens_tf,
    {
      typeHead: y_type_tf,
      colorHead: y_color_tf,
      sizeHead: y_size_tf,
      radiusHead: y_radius_tf,
      posHead: y_pos_tf,
    },
    {
      epochs: 50,
      batchSize: 16,
      shuffle: true,
      validationSplit: 0.15,
      callbacks: [
        tf.callbacks.earlyStopping({
          monitor: "val_loss",
          patience: 5,
        }),
      ],
    }
  );

  // збереже model.json + ваги .bin у цю теку
  await model.save("file://trained-model");

  // збережемо словник і мапінги (знадобиться фронтенду)
  const exportPayload = {
    vocab,
    MAX_TOKENS,
    TYPE_TO_ID,
    COLOR_TO_ID,
  };
  fs.writeFileSync(
    "./trained-model/vocab.json",
    JSON.stringify(exportPayload, null, 2)
  );

  console.log("Model and vocab saved to ./trained-model");
}

main().catch((err) => {
  console.error(err);
});
