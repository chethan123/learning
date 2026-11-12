import type { Round } from "./types.ts";

export const ROUNDS: readonly Round[] = [
  {
    id: "01-at",
    number: 1,
    letterSet: 1,
    groups: [
      {
        rest: "at",
        winning: ["m", "s", "p"],
        extras: [],
      },
    ],
    introduces: ["mat", "sat", "pat"],
  },
  {
    id: "02-ap",
    number: 2,
    letterSet: 1,
    groups: [
      {
        rest: "ap",
        winning: ["m", "t"],
        extras: [],
      },
    ],
    introduces: ["map", "tap"],
  },
  {
    id: "03-in",
    number: 3,
    letterSet: 2,
    groups: [
      {
        rest: "in",
        winning: ["p", "f"],
        extras: [],
      },
    ],
    introduces: ["pin", "fin"],
  },
  {
    id: "04-ap",
    number: 4,
    letterSet: 2,
    groups: [
      {
        rest: "ap",
        winning: ["n", "m", "t"],
        extras: [],
      },
    ],
    introduces: ["nap"],
  },
  {
    id: "05-an",
    number: 5,
    letterSet: 2,
    groups: [
      {
        rest: "an",
        winning: ["m", "p", "f"],
        extras: [],
      },
    ],
    introduces: ["man", "pan", "fan"],
  },
  {
    id: "06-ot",
    number: 6,
    letterSet: 3,
    groups: [
      {
        rest: "ot",
        winning: ["p", "d"],
        extras: [],
      },
    ],
    introduces: ["pot", "dot"],
  },
  {
    id: "07-op",
    number: 7,
    letterSet: 3,
    groups: [
      {
        rest: "op",
        winning: ["m", "t", "p"],
        extras: [],
      },
    ],
    introduces: ["mop", "top", "pop"],
  },
  {
    id: "08-ad",
    number: 8,
    letterSet: 3,
    groups: [
      {
        rest: "ad",
        winning: ["d", "s", "m"],
        extras: [],
      },
    ],
    introduces: ["dad", "sad", "mad"],
  },
  {
    id: "09-at-ap",
    number: 9,
    letterSet: 3,
    groups: [
      {
        rest: "at",
        winning: ["c", "m", "s"],
        extras: [],
      },
      {
        rest: "ap",
        winning: ["c", "m"],
        extras: [],
      },
    ],
    introduces: ["cat", "cap"],
  },
  {
    id: "10-an",
    number: 10,
    letterSet: 3,
    groups: [
      {
        rest: "an",
        winning: ["c", "m", "p", "f"],
        extras: [],
      },
    ],
    introduces: ["can"],
  },
  {
    id: "11-ug",
    number: 11,
    letterSet: 4,
    groups: [
      {
        rest: "ug",
        winning: ["b", "m"],
        extras: ["g"],
      },
    ],
    introduces: ["bug", "mug"],
  },
  {
    id: "12-un",
    number: 12,
    letterSet: 4,
    groups: [
      {
        rest: "un",
        winning: ["s", "b"],
        extras: [],
      },
    ],
    introduces: ["sun", "bun"],
  },
  {
    id: "13-ig",
    number: 13,
    letterSet: 4,
    groups: [
      {
        rest: "ig",
        winning: ["p", "d", "b"],
        extras: [],
      },
    ],
    introduces: ["pig", "dig", "big"],
  },
  {
    id: "14-og",
    number: 14,
    letterSet: 4,
    groups: [
      {
        rest: "og",
        winning: ["d", "f"],
        extras: ["g"],
      },
    ],
    introduces: ["dog", "fog"],
  },
  {
    id: "15-ag",
    number: 15,
    letterSet: 4,
    groups: [
      {
        rest: "ag",
        winning: ["b", "t"],
        extras: ["p"],
      },
    ],
    introduces: ["bag", "tag"],
  },
  {
    id: "16-ub",
    number: 16,
    letterSet: 4,
    groups: [
      {
        rest: "ub",
        winning: ["t", "s", "c"],
        extras: ["m"],
      },
    ],
    introduces: ["tub", "sub", "cub"],
  },
  {
    id: "17-at-in",
    number: 17,
    letterSet: 4,
    groups: [
      {
        rest: "at",
        winning: ["b", "c"],
        extras: [],
      },
      {
        rest: "in",
        winning: ["b", "p"],
        extras: ["n"],
      },
    ],
    introduces: ["bat", "bin"],
  },
  {
    id: "18-ut-ud",
    number: 18,
    letterSet: 4,
    groups: [
      {
        rest: "ut",
        winning: ["n", "c"],
        extras: ["d"],
      },
      {
        rest: "ud",
        winning: ["m", "b"],
        extras: ["t"],
      },
    ],
    introduces: ["nut", "cut", "mud", "bud"],
  },
  {
    id: "19-up-um-us",
    number: 19,
    letterSet: 4,
    groups: [
      {
        rest: "up",
        winning: ["c", "p"],
        extras: ["b"],
      },
      {
        rest: "um",
        winning: ["g"],
        extras: ["p"],
      },
      {
        rest: "us",
        winning: ["b"],
        extras: ["d"],
      },
    ],
    introduces: ["cup", "pup", "gum", "bus"],
  },
  {
    id: "20-en",
    number: 20,
    letterSet: 5,
    groups: [
      {
        rest: "en",
        winning: ["p", "t"],
        extras: ["n"],
      },
    ],
    introduces: ["pen", "ten"],
  },
  {
    id: "21-et",
    number: 21,
    letterSet: 5,
    groups: [
      {
        rest: "et",
        winning: ["n", "p"],
        extras: [],
      },
    ],
    introduces: ["net", "pet"],
  },
  {
    id: "22-at",
    number: 22,
    letterSet: 6,
    groups: [
      {
        rest: "at",
        winning: ["h", "r", "b"],
        extras: [],
      },
    ],
    introduces: ["hat", "rat"],
  },
  {
    id: "23-ed",
    number: 23,
    letterSet: 6,
    groups: [
      {
        rest: "ed",
        winning: ["b", "r"],
        extras: [],
      },
    ],
    introduces: ["bed", "red"],
  },
  {
    id: "24-ug",
    number: 24,
    letterSet: 6,
    groups: [
      {
        rest: "ug",
        winning: ["h", "r", "b", "m"],
        extras: [],
      },
    ],
    introduces: ["hug", "rug"],
  },
  {
    id: "25-ot",
    number: 25,
    letterSet: 6,
    groups: [
      {
        rest: "ot",
        winning: ["h", "p", "d"],
        extras: [],
      },
    ],
    introduces: ["hot"],
  },
  {
    id: "26-op-it",
    number: 26,
    letterSet: 6,
    groups: [
      {
        rest: "op",
        winning: ["h", "m"],
        extras: [],
      },
      {
        rest: "it",
        winning: ["h", "s"],
        extras: [],
      },
    ],
    introduces: ["hop", "hit", "sit"],
  },
  {
    id: "27-en-ut",
    number: 27,
    letterSet: 6,
    groups: [
      {
        rest: "en",
        winning: ["h", "p"],
        extras: ["n"],
      },
      {
        rest: "ut",
        winning: ["h", "n"],
        extras: ["d"],
      },
    ],
    introduces: ["hen", "hut"],
  },
  {
    id: "28-un",
    number: 28,
    letterSet: 6,
    groups: [
      {
        rest: "un",
        winning: ["r", "s", "b"],
        extras: [],
      },
    ],
    introduces: ["run"],
  },
  {
    id: "29-ip-id",
    number: 29,
    letterSet: 6,
    groups: [
      {
        rest: "ip",
        winning: ["r", "s"],
        extras: ["m"],
      },
      {
        rest: "id",
        winning: ["k"],
        extras: ["p"],
      },
    ],
    introduces: ["rip", "sip", "kid"],
  },
  {
    id: "30-og",
    number: 30,
    letterSet: 7,
    groups: [
      {
        rest: "og",
        winning: ["l", "d", "f"],
        extras: ["g"],
      },
    ],
    introduces: ["log"],
  },
  {
    id: "31-am-ug",
    number: 31,
    letterSet: 7,
    groups: [
      {
        rest: "am",
        winning: ["j", "h"],
        extras: [],
      },
      {
        rest: "ug",
        winning: ["j", "r"],
        extras: ["w"],
      },
    ],
    introduces: ["jam", "ham", "jug"],
  },
  {
    id: "32-et",
    number: 32,
    letterSet: 7,
    groups: [
      {
        rest: "et",
        winning: ["w", "j", "n", "p"],
        extras: [],
      },
    ],
    introduces: ["wet", "jet"],
  },
  {
    id: "33-ig",
    number: 33,
    letterSet: 7,
    groups: [
      {
        rest: "ig",
        winning: ["w", "p", "d", "b"],
        extras: ["h"],
      },
    ],
    introduces: ["wig"],
  },
  {
    id: "34-id-in",
    number: 34,
    letterSet: 7,
    groups: [
      {
        rest: "id",
        winning: ["l", "k"],
        extras: ["j"],
      },
      {
        rest: "in",
        winning: ["w", "b"],
        extras: ["n"],
      },
    ],
    introduces: ["lid", "win"],
  },
  {
    id: "35-ip",
    number: 35,
    letterSet: 7,
    groups: [
      {
        rest: "ip",
        winning: ["l", "r", "s"],
        extras: ["b"],
      },
    ],
    introduces: ["lip"],
  },
  {
    id: "36-eg-eb-ib",
    number: 36,
    letterSet: 7,
    groups: [
      {
        rest: "eg",
        winning: ["l"],
        extras: ["h", "w"],
      },
      {
        rest: "eb",
        winning: ["w"],
        extras: ["m", "t"],
      },
      {
        rest: "ib",
        winning: ["b"],
        extras: ["t", "p"],
      },
    ],
    introduces: ["leg", "web", "bib"],
  },
  {
    id: "37-an",
    number: 37,
    letterSet: 8,
    groups: [
      {
        rest: "an",
        winning: ["v", "c", "m"],
        extras: [],
      },
    ],
    introduces: ["van"],
  },
  {
    id: "38-ox-ix",
    number: 38,
    letterSet: 8,
    groups: [
      {
        rest: "ox",
        winning: ["b", "f"],
        extras: ["z"],
      },
      {
        rest: "ix",
        winning: ["s", "m"],
        extras: ["v"],
      },
    ],
    introduces: ["box", "fox", "six", "mix"],
  },
  {
    id: "39-ip",
    number: 39,
    letterSet: 8,
    groups: [
      {
        rest: "ip",
        winning: ["z", "l", "s", "r"],
        extras: [],
      },
    ],
    introduces: ["zip"],
  },
  {
    id: "40-et-um",
    number: 40,
    letterSet: 8,
    groups: [
      {
        rest: "et",
        winning: ["v", "w", "j"],
        extras: ["z"],
      },
      {
        rest: "um",
        winning: ["y", "g"],
        extras: ["p"],
      },
    ],
    introduces: ["vet", "yum"],
  },
  {
    id: "41-and-amp",
    number: 41,
    letterSet: 9,
    groups: [
      {
        rest: "and",
        winning: ["h", "s"],
        extras: ["v"],
      },
      {
        rest: "amp",
        winning: ["l", "c"],
        extras: ["n"],
      },
    ],
    introduces: ["hand", "sand", "lamp", "camp"],
  },
  {
    id: "42-est-ump-ent",
    number: 42,
    letterSet: 9,
    groups: [
      {
        rest: "est",
        winning: ["n", "v"],
        extras: [],
      },
      {
        rest: "ump",
        winning: ["j", "p"],
        extras: ["z"],
      },
      {
        rest: "ent",
        winning: ["t"],
        extras: ["n", "y"],
      },
    ],
    introduces: ["nest", "vest", "jump", "pump", "tent"],
  },
  {
    id: "43-ilk-ift-esk-ant",
    number: 43,
    letterSet: 9,
    groups: [
      {
        rest: "ilk",
        winning: ["m"],
        extras: ["n", "t"],
      },
      {
        rest: "ift",
        winning: ["g"],
        extras: ["d", "p"],
      },
      {
        rest: "esk",
        winning: ["d"],
        extras: ["m", "b"],
      },
      {
        rest: "ant",
        winning: ["pl"],
        extras: ["m", "fr"],
      },
    ],
    introduces: ["milk", "gift", "desk", "plant"],
  },
  {
    id: "44-og-um-ab",
    number: 44,
    letterSet: 9,
    groups: [
      {
        rest: "og",
        winning: ["fr", "d"],
        extras: ["g"],
      },
      {
        rest: "um",
        winning: ["dr", "g"],
        extras: ["p"],
      },
      {
        rest: "ab",
        winning: ["cr"],
        extras: ["p", "pl"],
      },
    ],
    introduces: ["frog", "drum", "crab"],
  },
  {
    id: "45-ag-ap",
    number: 45,
    letterSet: 9,
    groups: [
      {
        rest: "ag",
        winning: ["fl", "b"],
        extras: ["p"],
      },
      {
        rest: "ap",
        winning: ["cl", "c"],
        extras: [],
      },
    ],
    introduces: ["flag", "clap"],
  },
  {
    id: "46-op-in",
    number: 46,
    letterSet: 9,
    groups: [
      {
        rest: "op",
        winning: ["st", "m", "t"],
        extras: ["v"],
      },
      {
        rest: "in",
        winning: ["sp", "p"],
        extras: ["n"],
      },
    ],
    introduces: ["stop", "spin"],
  },
  {
    id: "47-ed-im",
    number: 47,
    letterSet: 9,
    groups: [
      {
        rest: "ed",
        winning: ["sl", "b", "r"],
        extras: ["y"],
      },
      {
        rest: "im",
        winning: ["sw"],
        extras: ["f", "z"],
      },
    ],
    introduces: ["sled", "swim"],
  },
  {
    id: "48-ell-iss-oll",
    number: 48,
    letterSet: 10,
    groups: [
      {
        rest: "ell",
        winning: ["b", "w", "y"],
        extras: ["r"],
      },
      {
        rest: "iss",
        winning: ["k"],
        extras: ["n", "v"],
      },
      {
        rest: "oll",
        winning: ["d"],
        extras: ["v", "z"],
      },
    ],
    introduces: ["bell", "well", "yell", "kiss", "doll"],
  },
  {
    id: "49-ock",
    number: 49,
    letterSet: 11,
    groups: [
      {
        rest: "ock",
        winning: ["s", "r", "l"],
        extras: ["z"],
      },
    ],
    introduces: ["sock", "rock", "lock"],
  },
  {
    id: "50-ick-uck",
    number: 50,
    letterSet: 11,
    groups: [
      {
        rest: "ick",
        winning: ["k", "l", "s"],
        extras: ["z"],
      },
      {
        rest: "uck",
        winning: ["d", "tr"],
        extras: [],
      },
    ],
    introduces: ["kick", "lick", "sick", "duck", "truck"],
  },
  {
    id: "51-ock-ack",
    number: 51,
    letterSet: 11,
    groups: [
      {
        rest: "ock",
        winning: ["cl", "bl", "s"],
        extras: ["z"],
      },
      {
        rest: "ack",
        winning: ["p", "sn"],
        extras: ["v"],
      },
    ],
    introduces: ["clock", "block", "pack", "snack"],
  },
  {
    id: "52-ick-ess",
    number: 52,
    letterSet: 11,
    groups: [
      {
        rest: "ick",
        winning: ["br", "st", "k"],
        extras: ["z"],
      },
      {
        rest: "ess",
        winning: ["m", "dr"],
        extras: ["v"],
      },
    ],
    introduces: ["brick", "stick", "mess", "dress"],
  },
  {
    id: "53-ip-op",
    number: 53,
    letterSet: 12,
    groups: [
      {
        rest: "ip",
        winning: ["sh", "r", "z"],
        extras: ["m"],
      },
      {
        rest: "op",
        winning: ["sh", "h"],
        extras: ["v"],
      },
    ],
    introduces: ["ship", "shop"],
  },
  {
    id: "54-ish-ell",
    number: 54,
    letterSet: 12,
    groups: [
      {
        rest: "ish",
        winning: ["f", "d", "w"],
        extras: ["m"],
      },
      {
        rest: "ell",
        winning: ["sh", "b"],
        extras: ["r"],
      },
    ],
    introduces: ["fish", "dish", "wish", "shell"],
  },
  {
    id: "55-ash-ush",
    number: 55,
    letterSet: 12,
    groups: [
      {
        rest: "ash",
        winning: ["c", "tr"],
        extras: ["v"],
      },
      {
        rest: "ush",
        winning: ["br"],
        extras: ["v", "tr"],
      },
    ],
    introduces: ["cash", "trash", "brush"],
  },
  {
    id: "56-ath",
    number: 56,
    letterSet: 13,
    groups: [
      {
        rest: "ath",
        winning: ["b", "p"],
        extras: ["f"],
      },
    ],
    introduces: ["bath", "path"],
  },
  {
    id: "57-ip-op",
    number: 57,
    letterSet: 14,
    groups: [
      {
        rest: "ip",
        winning: ["ch", "sh", "s"],
        extras: ["b"],
      },
      {
        rest: "op",
        winning: ["ch", "sh"],
        extras: ["z"],
      },
    ],
    introduces: ["chip", "chop"],
  },
  {
    id: "58-in-ick",
    number: 58,
    letterSet: 14,
    groups: [
      {
        rest: "in",
        winning: ["ch", "p", "w"],
        extras: ["n"],
      },
      {
        rest: "ick",
        winning: ["ch", "k"],
        extras: ["z"],
      },
    ],
    introduces: ["chin", "chick"],
  },
  {
    id: "59-est-unch-ench",
    number: 59,
    letterSet: 14,
    groups: [
      {
        rest: "est",
        winning: ["ch", "n", "v"],
        extras: [],
      },
      {
        rest: "unch",
        winning: ["l"],
        extras: ["t", "g"],
      },
      {
        rest: "ench",
        winning: ["b"],
        extras: ["v", "z"],
      },
    ],
    introduces: ["chest", "lunch", "bench"],
  },
  {
    id: "60-ing",
    number: 60,
    letterSet: 15,
    groups: [
      {
        rest: "ing",
        winning: ["k", "r", "w", "s"],
        extras: [],
      },
    ],
    introduces: ["king", "ring", "wing", "sing"],
  },
  {
    id: "61-ink-unk",
    number: 61,
    letterSet: 15,
    groups: [
      {
        rest: "ink",
        winning: ["p", "s", "w"],
        extras: ["v"],
      },
      {
        rest: "unk",
        winning: ["sk", "b"],
        extras: ["t"],
      },
    ],
    introduces: ["pink", "sink", "wink", "skunk", "bunk"],
  },
];
