import {
  ALL_SOUNDS,
  ALL_WORDS,
} from "../../src/pages/word-builder/content/derive.ts";

console.log(JSON.stringify({ words: [...ALL_WORDS], sounds: [...ALL_SOUNDS] }));
