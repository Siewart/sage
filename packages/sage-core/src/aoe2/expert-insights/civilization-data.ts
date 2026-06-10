export const civilizationData = { // From game's DAT using Advanced Genie Editor
  // wikidata is extracted from aoe2 community wiki (aoe2.fandom.com under under CC-BY-SA)
  // using the data as present during the KotD4 tournament (Dec 2021)
  1: {
    name: "Britons",
    uniqueUnits: [
      {
        // id: 8,
        name: "Longbowman",
        description: "long-ranged archer",
        // relevantMasterIds: [8, 530],
        // eliteTechId: 360,
      },
    ],
    uniqueTechs: [
      {
        // id: 3,
        name: "Yeomen",
        description: "increases foot archer range by +1 and tower attack by +2",
        // relevantMasterIds: [
        //   4, 8, 24, 73, 185, 492, 530, 559, 763, 765, 866, 868, 1129, 7, 6,
        //   1155, 79, 234, 235, 236, 1665,
        // ],
      },
      {
        // id: 461,
        name: "Warwolf",
        description:
          "gives Trebuchets a small blast radius and 100% accuracy to stationary targets", // ${name}, which ${description}
        // relevantMasterIds: [42],
      },
    ],
    wikidata: {
      overview:
        "The Britons' main advantages are in their ranged units as they arguably have the best foot archers. They are trained faster and have a very long range. Their infantry is also very good with a complete tech tree. But their mounted units are very underwhelming and their siege weapons are also lacking. This is compensated to a degree by their very dangerous Trebuchets that aim at units with perfect accuracy and deal blast damage thanks to Warwolf. Their navy is strong with a full tech tree apart from Elite Cannon Galleons. The Monks are below average with three technologies missing. Their defensive structures are good, and their economy rather average, although their Shepherd bonus is very helpful early on.",
    }, // For LLM use only
    civBonuses: [
      {
        // Should use the regular masterId for these
        description: "their Town Centers cost 50% less wood", // Because ${description}
        // relevantMasterIds: [109],
        isTeamBonus: false,
      },
      {
        description: "their Shepherds work 25% faster", // Because ${description}
        // relevantMasterIds: [592, 590],
        isTeamBonus: false,
      },
      {
        description:
          "their Foot Archers have +1 range in Feudal Age and +2 from Castle Age", // Because ${description}
        // relevantMasterIds: [
        //   4, 8, 24, 73, 185, 492, 530, 559, 763, 765, 866, 868, 1129,
        // ],
        isTeamBonus: false,
      },
      {
        description: "their Archery Ranges work 20% faster", // Because as an ally to the ${civilization}, ${description}
        // relevantMasterIds: [87, 10, 14],
        isTeamBonus: true,
      },
    ],
  },
  2: {
    name: "Franks",
    uniqueUnits: [
      {
        // id: 281,
        name: "Throwing Axeman",
        description: "ranged Infantry unit dealing melee damage", // ${name}, which is a ${description}
        // relevantMasterIds: [281, 531],
        // eliteTechId: 363,
      },
    ],
    uniqueTechs: [
      {
        // id: 493,
        name: "Chivalry",
        description: "makes Stables work 40% faster", // ${name}, which ${description}
        // relevantMasterIds: [101, 86, 153],
      },
      {
        // id: 83,
        name: "Bearded Axe",
        description: "gives Throwing Axemen +1 range", // ${name}, which ${description}
        // relevantMasterIds: [281, 531],
      },
    ],
    wikidata: {
      overview:
        "The Franks are a straightforward cavalry civilization, with the strongest Knight line of all civilizations and lots of Castles for defense. Despite being generally described as a cavalry civilization, their Stable is rather underwhelming outside of the Knight line, such as fully upgradable Light Cavalry and Paladins. Their infantry is very strong with fully upgraded Champions and Halberdiers. Their archers are weak. The Frankish siege weapons are average, as they lack both the Siege Onager and the Siege Ram. The Franks can use monks with some potential, lacking only Atonement and Redemption. Due to the fact that Castles are 25% cheaper, the Franks can build Castles for a more effective defensive system. That easily compensates the fact they have barely usable towers. Their navy has a hard time keeping up, lacking Elite Cannon Galleon and Shipwright, and the lack of Bracer is a big negative for Frankish Galleons. The Franks get Farm upgrades for free and their Foragers work +15% faster, rendering a fine food economy, but apart from that, their economical technology tree is rather lacking.",
    }, // For LLM use only
    civBonuses: [
      {
        description:
          "their Farm upgrades are free and automatically researched", // Because ${description}
        // relevantMasterIds: [],
        isTeamBonus: false,
      },
      {
        description: "their Foragers work 15% faster", // Because ${description}
        // relevantMasterIds: [120, 354],
        isTeamBonus: false,
      },
      {
        description: "their Mounted Units have +20% health from the Feudal Age", // Because ${description}
        // relevantMasterIds: [
        //   11,
        //   39,
        //   172,
        //   474,
        //   561,
        //   583,
        //   596,
        //   827,
        //   829,
        //   873,
        //   875,
        //   1007,
        //   1009,
        //   1010,
        //   1012,
        //   1231,
        //   1260, // ^ class 36, Cavalry Archers
        //   448, // < class 47, Scout Cavalry (not line!)
        //   771,
        //   1126,
        //   1128,
        //   773, // ^class 23 Conquistador, Arambai
        //   38,
        //   40,
        //   207,
        //   239,
        //   282,
        //   283,
        //   329,
        //   330,
        //   441,
        //   546,
        //   553,
        //   556,
        //   558,
        //   569,
        //   757,
        //   755,
        //   869,
        //   871,
        //   876,
        //   878,
        //   886,
        //   887,
        //   1120,
        //   1122,
        //   1132,
        //   1134,
        //   1225,
        //   1227,
        //   1228,
        //   1230,
        //   1234,
        //   1236,
        //   1254,
        //   1255,
        //   1370,
        //   1372,
        //   1570,
        //   1655,
        //   1657,
        //   1707, // ^class 12 Cavalry
        // ],
        isTeamBonus: false,
      },
      {
        description: "their Knights have +2 Line of Sight", // Because as an ally to the ${civilization}, ${description}
        // relevantMasterIds: [569, 38, 283, 569, 38, 283],
        isTeamBonus: true,
      },
    ],
  },
  3: {
    name: "Goths",
    uniqueUnits: [
      {
        // id: 41,
        name: "Huskarl",
        description: "Infantry unit with very high Pierce Armor", // ${name}, which is a ${description}
        // relevantMasterIds: [41, 555, 759, 761],
        // eliteTechId: 365,
      },
    ],
    uniqueTechs: [
      {
        // id: 16,
        name: "Anarchy",
        description: "allows Huskarls to be trained at the Barracks", // ${name}, which ${description}
        // relevantMasterIds: [12, 498, 132, 20], // TODO
      },
      {
        id: 457,
        name: "Perfusion",
        description: "makes Barracks work twice as fast", // ${name}, which ${description}
        // relevantMasterIds: [12, 498, 132, 20], // TODO
      },
    ],
    wikidata: {
      overview:
        "The Goths are an infantry civilization. As a result, infantry is the way to go since the Goths' advantages predominantly lay there. The main advantages there are the fast creation speed and low cost which offset lacking Plate Mail Armor by far. The Goths have weak archers, but they can fully upgrade their Skirmishers and Hand Cannoneers. The cavalry branch is not very prominent with the Goths albeit being overall acceptable, featuring Hussars with Bloodlines, but lacking Paladins and Plate Barding Armor. The Siege Workshop is also average without Siege Rams and Siege Onagers. Siege Engineers are also not available, but the Goths primary raiding units are Huskarls, anyway, so this is not that much of a drawback. Their navy is fairly useable, but Dry Dock is missing, so their ships lack speed. The Gothic Monks are way below average, missing four out of ten technologies, and their defenses are downright abysmal. Their economy is good, however. Summing it all up the Goths may seem a civilization below average, but their infantry rushing capabilities make up for their overall lacking tech tree and are feared for a reason.",
    }, // For LLM use only
    civBonuses: [
      {
        description:
          "their Infantry gets cheaper as they progress through the ages", // Because ${description}
        // relevantMasterIds: [
        //   25, 42, 74, 75, 77, 93, 232, 281, 358, 359, 473, 531, 534, 554, 560,
        //   567, 692, 694, 725, 726, 751, 752, 753, 879, 881, 882, 1013, 1015,
        //   1016, 1018, 1123, 1125, 1152, 1253, 1658, 1659, 1660, 1661, 1663,
        //   1697, 1699, 701, 1703,
        // ], // Class 6 Infantry
        isTeamBonus: false,
      },
      {
        description:
          "their Infantry deals more damage to buildings as they advance through the ages", // Because ${description}
        // relevantMasterIds: [
        //   25, 42, 74, 75, 77, 93, 232, 281, 358, 359, 473, 531, 534, 554, 560,
        //   567, 692, 694, 725, 726, 751, 752, 753, 879, 881, 882, 1013, 1015,
        //   1016, 1018, 1123, 1125, 1152, 1253, 1658, 1659, 1660, 1661, 1663,
        //   1697, 1699, 701, 1703,
        // ], // Class 6 Infantry
        isTeamBonus: false,
      },
      {
        description:
          "their Villagers deal additional damage to Lurable Hunt and carry +15 Food from hunting", // Because ${description}
        // relevantMasterIds: [216, 122],
        isTeamBonus: false,
      },
      {
        description:
          "they have +10 additional Population Capacity in Imperial Age", // Because ${description}
        // relevantMasterIds: [],
        isTeamBonus: false,
      },
      {
        description:
          "they can research Loom instantly, giving their Villagers additional Armor and Health ", // Because ${description}
        // relevantMasterIds: [], // TODO
        isTeamBonus: false,
      },
      {
        description: "their Barracks work 20% faster", // Because as an ally to the ${civilization}, ${description}
        // relevantMasterIds: [12, 498, 132, 20],
        isTeamBonus: true,
      },
    ],
  },
  4: {
    name: "Teutons",
  },
  5: {
    name: "Japanese",
  },
  6: {
    name: "Chinese",
  },
  7: {
    name: "Byzantines",
  },
  8: {
    name: "Persians",
  },
  9: {
    name: "Saracens",
  },
  10: {
    name: "Turks",
  },
  11: {
    name: "Vikings",
  },
  12: {
    name: "Mongols",
  },
  13: {
    name: "Celts",
  },
  14: {
    name: "Spanish",
  },
  15: {
    name: "Aztecs",
    uniqueUnits: [
      {
        // id: 41,
        name: "Jaguar Warrior",
        description: "Anti-infantry infantry", // ${name}, which is a ${description}
        // relevantMasterIds: [41, 555, 759, 761],
        // eliteTechId: 365,
      },
    ],
    uniqueTechs: [
      {
        // id: 16,
        name: "Atlatl",
        description: "gives Skirmishers one additional attack and range.", // ${name}, which ${description}
        // relevantMasterIds: [12, 498, 132, 20], // TODO
      },
      {
        // id: 457,
        name: "Garland Wars",
        description: "gives Infantry significantly more attack", // ${name}, which ${description}
        // relevantMasterIds: [12, 498, 132, 20], // TODO
      },
    ],
    wikidata: {
      overview:
        "The greatest strength of the Aztecs is their ability to produce military units faster than their opponents. This is partially thanks to their faster production rate for all military buildings, but also thanks to their economy. The Aztec economy is one of the strongest in the game, and was especially so on release. Their Villagers carry +3 resources, which gives them an all-around solid boost to their collection rate, especially when farming. The 33% faster Relic gold production is a great bonus for the late game. The extra 50 gold at the start makes them one of the strongest civilizations for Militia rushes. Both their economy and military production boost makes them an aggressive civilization that has strong rushing capacity. Aztecs possess some of the strongest infantry options in the game. In addition to their access to Eagle Warriors, Garland Wars gives all Aztec infantry +4 attack, which gives them an edge in melee fights. The unique unit Jaguar Warrior is a very potent infantry counter, thanks to its bonus attack. Atlatl gives their Skirmishers an extra +1 attack and +1 range, albeit lacking the last armor upgrade. The Aztecs are strong in the siege weapon department with Siege Rams, Siege Onagers, and Siege Engineers. Their Monks are the best in the game with access to all religious technologies and a stacking +5 hit points with every one researched, eventually gaining a monstrous 100 hit points when fully upgraded, though some of the technologies are very pricey (notably, Faith and Heresy). Being a Native American civilization, they lack any access to the Stable (as well as every Stable unit apart from the Xolotl Warrior), Cavalry Archers (and its alternatives), and gunpowder units. The lack of the Halberdiers means that they are reliant on their Monks against enemy heavy cavalry. While their foot archers benefit from the Aztecs' economy, the lack of Thumb Ring and Ring Archer Armor hurts it overall. Their navy is weak, lacking the Galleon and Cannon Galleon. Their defensive structures are below average, lacking all building hit point technologies and Keeps. Overall, the Aztecs are great both on open and closed maps, thanks to a combination of strong military production and powerful options.",
    }, // For LLM use only
    civBonuses: [
      {
        description: "they start the game with an Eagle Scout", // Because ${description}
        // relevantMasterIds: [
        //   25, 42, 74, 75, 77, 93, 232, 281, 358, 359, 473, 531, 534, 554, 560,
        //   567, 692, 694, 725, 726, 751, 752, 753, 879, 881, 882, 1013, 1015,
        //   1016, 1018, 1123, 1125, 1152, 1253, 1658, 1659, 1660, 1661, 1663,
        //   1697, 1699, 701, 1703,
        // ], // Class 6 Infantry
        isTeamBonus: false,
      },
      {
        description: "their Villagers carry more resources", // Because ${description}
        // relevantMasterIds: [
        //   25, 42, 74, 75, 77, 93, 232, 281, 358, 359, 473, 531, 534, 554, 560,
        //   567, 692, 694, 725, 726, 751, 752, 753, 879, 881, 882, 1013, 1015,
        //   1016, 1018, 1123, 1125, 1152, 1253, 1658, 1659, 1660, 1661, 1663,
        //   1697, 1699, 701, 1703,
        // ], // Class 6 Infantry
        isTeamBonus: false,
      },
      {
        description: "all their military units are created 11% faster", // Because ${description}
        // relevantMasterIds: [216, 122],
        isTeamBonus: false,
      },
      {
        description:
          "their Monks gain additional health for every researched Monastery technology", // Because ${description}
        // relevantMasterIds: [],
        isTeamBonus: false,
      },
      {
        description: "they start with 50 extra gold", // Because ${description}
        // relevantMasterIds: [],
        isTeamBonus: false,
      },
      {
        description: "they generate additional gold from relics", // Because ${description}
        // relevantMasterIds: [],
        isTeamBonus: true,
      },
    ],
  },
  16: {
    name: "Mayans",
  },
  17: {
    name: "Huns",
    uniqueUnits: [
      {
        // id: 41,
        name: "Tarkan",
        description: "Cavalry unit that excels at razing defensive structures", // ${name}, which is a ${description}
        // relevantMasterIds: [41, 555, 759, 761],
        // eliteTechId: 365,
      },
    ],
    uniqueTechs: [
      {
        // id: 16,
        name: "Marauders",
        description: "allows the creation of Tarkans at the Stable", // ${name}, which ${description}
        // relevantMasterIds: [12, 498, 132, 20], // TODO
      },
      {
        // id: 457,
        name: "Atheism",
        description:
          "adds 100 years to Wonder and Relic victory countdowns and reduces enemy Relic gold generation by 50%", // ${name}, which ${description}
        // relevantMasterIds: [12, 498, 132, 20], // TODO
      },
    ],
    wikidata: {
      overview:
        "The Huns are a cavalry civilization. As such, they have an ample cavalry tech tree with access to the rare fully upgraded Paladin. Their Cavalry Archers are also very prominent, but the foot archers are somewhat lacking without Ring Archer Armor. Their infantry also lacks the final armor upgrade, Supplies as well as the Champion, making it rather weak overall. Tech tree-wise, the Huns rank way below average in the Monk (missing four out of ten technologies), navy (no Cannon Galleon and Fast Fire Ship), and siege weapon departments (no Onager, Heavy Scorpion, and Bombard Cannon, though they do get Siege Rams); and their late-game economy is also average at best, without Crop Rotation and Stone Shaft Mining. Their defenses are horrible, lacking Fortified Walls, all Watch Tower upgrades, and most technologies affecting structures. All in all, the Huns may not seem worthwhile, but, like the Goths, they do what they do extremely well: Rush, raze, and harass the enemy with powerful and mobile forces, due to the fact that they have several options during the early and mid-game, making them specially strong in open maps and in 1v1 games. In the late-game, they still have Paladins, Heavy Cavalry Archers, and Tarkans, all of which are powerful units in their own right.",
    }, // For LLM use only
    civBonuses: [
      {
        description:
          "they start the game with -100 wood, but with the population cap at the maximum.", // Because ${description}
        // relevantMasterIds: [
        //   25, 42, 74, 75, 77, 93, 232, 281, 358, 359, 473, 531, 534, 554, 560,
        //   567, 692, 694, 725, 726, 751, 752, 753, 879, 881, 882, 1013, 1015,
        //   1016, 1018, 1123, 1125, 1152, 1253, 1658, 1659, 1660, 1661, 1663,
        //   1697, 1699, 701, 1703,
        // ], // Class 6 Infantry
        isTeamBonus: false,
      },
      {
        description:
          "their Cavalry Archers get cheaper as they progress through the ages", // Because ${description}
        // relevantMasterIds: [
        //   25, 42, 74, 75, 77, 93, 232, 281, 358, 359, 473, 531, 534, 554, 560,
        //   567, 692, 694, 725, 726, 751, 752, 753, 879, 881, 882, 1013, 1015,
        //   1016, 1018, 1123, 1125, 1152, 1253, 1658, 1659, 1660, 1661, 1663,
        //   1697, 1699, 701, 1703,
        // ], // Class 6 Infantry
        isTeamBonus: false,
      },
      {
        description: "their Trebuchets have +30% accuracy against units", // Because ${description}
        // relevantMasterIds: [],
        isTeamBonus: false,
      },
      {
        description: "their Stables work 20% faster", // Because ${description}
        // relevantMasterIds: [],
        isTeamBonus: true,
      },
    ],
  },
  18: {
    name: "Koreans",
  },
  19: {
    name: "Italians",
  },
  20: {
    name: "Indians",
    uniqueUnits: [
      {
        // id:
        name: "Elephant Archer",
        description: "Mounted Archer with a high amount of Health", // ${name}, which is a ${description}
        // relevantMasterIds: [],
        // eliteTechId:
      },
      {
        // id:
        name: "Imperial Camel Rider",
        description:
          "an upgrade of the Heavy Camel Rider with additional Health and attack", // ${name}, which is ${description}
        // relevantMasterIds: [],
        // eliteTechId: undefined,
      },
    ],
    uniqueTechs: [
      {
        // id:
        name: "Sultans",
        description: "increases all Gold income by 10%", // ${name}, which ${description}
        // relevantMasterIds: [],
      },
      {
        // id:
        name: "Shatagni",
        description: "gives Hand Cannoneers +1 Range", // ${name}, which ${description}
        // relevantMasterIds: [],
      },
    ],
    wikidata: {
      overview:
        "The Indians are classified as a Camel Rider and gunpowder civilization. As such, they have excellent Camels with a unique upgrade, extra pierce armor, an additional attack bonus against standard buildings, and all upgrades (missing only the final armor upgrade). They also have access to the Hussar, but no Knights at their disposal. Still, their cavalry branch is very prominent and strong. Their archers are also very good, most prominently their excellent Cavalry Archers and Hand Cannoneers with both getting all possible upgrades and the latter getting another +1 range from Shatagni, making the Hand Cannoneer one of the most prominent unit in Indian armies. Their infantry misses out on the final armor upgrade but get all unit upgrades. The siege weapons are underwhelming apart from the Bombard Cannon. Their navy is good, but the Fast Fire Ship and Shipwright are missing. Their Monks are average. Their defenses are weak, but their economy is good (only lacking Crop Rotation) and very beneficial for their playing style with faster gold income due to Sultans.",
    }, // For LLM use only
    civBonuses: [
      {
        description: "their Fishermen work 10% faster", // Because ${description}
        // relevantMasterIds: [],
        isTeamBonus: false,
      },
      {
        description:
          "their Villagers cost 10%/15%/20%/25% less in the Dark/Feudal/Castle/Imperial Age", // Because ${description}
        // relevantMasterIds: [],
        isTeamBonus: false,
      },
      {
        description:
          "their Stable units have +1/+2 Pierce Armor in the Castle/Imperial Age", // Because ${description}
        // relevantMasterIds: [],
        isTeamBonus: false,
      },
      {
        description:
          "their Camel units have +4 attack against Standard Buildings", // Because as an ally to the ${civilization}, ${description}
        // relevantMasterIds: [],
        isTeamBonus: true,
      },
    ],
  },
  21: {
    name: "Incas",
  },
  22: {
    name: "Magyars",
  },
  23: {
    name: "Slavs",
  },
  24: {
    name: "Portuguese",
  },
  25: {
    name: "Ethiopians",
  },
  26: {
    name: "Malians",
  },
  27: {
    name: "Berbers",
  },
  28: {
    name: "Khmer",
  },
  29: {
    name: "Malay",
  },
  30: {
    name: "Burmese",
  },
  31: {
    name: "Vietnamese", // This one
    uniqueUnits: [
      {
        // id: 1129,
        name: "Rattan Archer",
        description: "Foot Archer with high Pierce Armor", // ${name}, which is a ${description}
        // relevantMasterIds: [1129, 1131],
        // eliteTechId: 621,
      },
      {
        // id: 1155,
        name: "Imperial Skirmisher",
        description:
          "extra upgrade of the Elite Skirmisher with additional health and attack", // ${name}, which is a ${description} - a|n is added by SimpleNLG
        // relevantMasterIds: [1155],
        // eliteTechId: undefined,
      },
    ],
    uniqueTechs: [
      {
        // id: 628,
        name: "Chatras",
        description: "gives Battle Elephants +100 Health", // ${name}, which ${description}
        // relevantMasterIds: [1132, 1134, 239, 558],
      },
      {
        // id: 629,
        name: "Paper Money",
        description: "gives the player and their allies 500 gold", // ${name}, which ${description}
        // relevantMasterIds: [],
      },
    ],
    wikidata: {
      overview:
        "The Vietnamese are an archer civilization with strong emphasis of team support, and their foot archers are excellent soldiers, getting additional HP as well as every upgrade there is. Additionally, their unique unit and team bonus are both foot archers, making the Vietnamese able to pick from a wide variety of different units there. Their infantry and cavalry both miss Blast Furnace, and the latter is especially shallow with other upgrades such as Paladin and Hussar missing. Their Battle Elephants, however, get additional HP out of Chatras and therefore have good defensive capabilities. The siege units are overall weak. Their navy is fair, but the Fast Fire Ship and Shipwright are missing. Their Monks rank below average as well. The defensive structures are overall good, but the lack of Masonry and Architecture is not helping. Their economy is good and especially suited for team games with Paper Money, but the lack of a major early game economic bonus makes the Vietnamese vulnerable to rush strategies.",
    }, // For LLM use only
    civBonuses: [
      {
        description:
          "they start with their enemies starting locations revealed", // Because ${description}
        // relevantMasterIds: [],
        isTeamBonus: false,
      },
      {
        description: "their Archery Range units have +20% Health", // Because ${description}
        // relevantMasterIds: [
        //   4, 24, 492, 5, 7, 6, 39, 474, 1010, 1012, 1155, 1260,
        // ],
        isTeamBonus: false,
      },
      {
        description: "they research Conscription is free and automatically", // Because ${description}
        // relevantMasterIds: [],
        isTeamBonus: false,
      },
      {
        description: "their Economic Upgrades cost no Wood", // Because ${description}
        // relevantMasterIds: [], // TODO
        isTeamBonus: false,
      },
      {
        description: "they gain access to Imperial Skirmishers as well", // Because as an ally to the ${civilization}, ${description}
        // relevantMasterIds: [1155], // TODO
        isTeamBonus: true,
      },
    ],
  },
  32: {
    name: "Bulgarians",
    uniqueUnits: [
      {
        // id:
        name: "Konnik",
        description:
          "Cavalry unit that keeps fighting on foot as Infantry after its mount is killed", // ${name}, which is a ${description}
        // relevantMasterIds: [],
        // eliteTechId:
      },
    ],
    uniqueTechs: [
      {
        // id:
        name: "Stirrups",
        description:
          "makes Scout Cavalry, Knights and Konniks attack 33% faster", // ${name}, which ${description}
        // relevantMasterIds: [],
      },
      {
        // id:
        name: "Bagains",
        description: "gives Militia-line units +5 Melee Armor", // ${name}, which ${description}
        // relevantMasterIds: [],
      },
    ],
    wikidata: {
      overview:
        "Bulgarians are classified as an infantry and cavalry civilization, which is essentially reflected in their unique unit, but both their branches are among the finest in the game; their stable units get all upgrades and technologies excluding the Paladin upgrade (plus having Stirrups to boost the attack speed of all of their cavalry); despite lacking the Champion upgrade, their militia-line upgrades are free and benefit from the additional melee armor of Bagains. Both lines are helped by their fast working Blacksmith (which also benefits their teammates) and with upgrades costing less food. Their Archery Range is on the other hand much weaker by lacking Crossbowman and Ring Archer Armor. Their siege weapons are excellent, as they have all upgrades and only lack Bombard Cannons and save a good amount of food upgrading siege. Their navy and Monks are lackluster, but their defenses are decent, thanks to their Krepost (their unique building which is essentially a lesser version of the Castle and can create Konniks), but still lack other important defensive technologies, and their economy is only hurt a bit by lacking Two-Man Saw and Guilds. They also have a stone discount for their Town Centers. Their Monks are far from the best, and it is worth remembering that Bulgarians with no siege might have a hard time dealing with mass Arbalesters or Cavalry Archers.",
    }, // For LLM use only
    civBonuses: [
      {
        description: "their Militia-line upgrades are free", // Because ${description}
        // relevantMasterIds: [],
        isTeamBonus: false,
      },
      {
        description: "their Town Centers cost 50% less Stone", // Because ${description}
        // relevantMasterIds: [],
        isTeamBonus: false,
      },
      {
        description:
          "their Blacksmith and Siege Workshop technologies cost 50% less Food", // Because ${description}
        // relevantMasterIds: [],
        isTeamBonus: false,
      },
      {
        description:
          "they can build the Krepost, a cheaper mini-Castle that trains Konniks", // Because ${description}
        // relevantMasterIds: [],
        isTeamBonus: false,
      },
      {
        description: "their Blacksmiths work 80% faster", // Because as an ally to the ${civilization}, ${description}
        // relevantMasterIds: [],
        isTeamBonus: true,
      },
    ],
  },
  33: {
    name: "Tatars", // This one
    uniqueUnits: [
      {
        // id: 1128,
        name: "Keshik",
        description: "Cavalry unit that plunders gold with each attack", // ${name}, which is a ${description}
        // relevantMasterIds: [1128, 1230],
        // eliteTechId: 680,
      },
      {
        // id: 1263,
        name: "Flaming Camel",
        description: "Incendiary camel loaded with flammable hay and brush", // ${name}, which is a ${description}
        // relevantMasterIds: [1263],
        eliteTechId: undefined,
      },
    ],
    uniqueTechs: [
      {
        // id: 687,
        name: "Silk Armor",
        description:
          "Scout Cavalry, Steppe Lancers and Cavalry Archers have +1 Pierce and Melee Armor", // ${name}, which ${description}
        // relevantMasterIds: [
        //   11,
        //   39,
        //   172,
        //   474,
        //   561,
        //   583,
        //   596,
        //   827,
        //   829,
        //   873,
        //   875,
        //   1007,
        //   1009,
        //   1010,
        //   1012,
        //   1231,
        //   1260, // ^ class 36, Cavalry Archers
        //   448,
        //   546,
        //   441,
        //   1707, // ^ Scouts
        //   1370,
        //   1372,
        // ],
      },
      {
        // id: 688,
        name: "Timurid Siegecraft",
        description:
          "gives Trebuchets +2 Range and gives access to Flaming Camel", // ${name}, which ${description}
        // relevantMasterIds: [42, 1690, 331, 729, 730, 1263],
      },
    ],
    wikidata: {
      overview:
        "The Tatars are classified as a cavalry archer civilization. Their Cavalry Archers are extremely powerful, not only having all possible upgrades (two of those, Parthian Tactics and Thumb Ring, are free for them), they also deal 50% more damage when fight on higher grounds (this bonus applies to all Tatar units), increased Line of Sight (which is their team bonus) and the Silk Armor unique technology, which gives additional melee and pierce armor to them, putting the Tatar cavalry archers at the same level as the Mongol, Hun, Turk, Magyar and Cuman cavalry archers. Tatars also have strong cavalry, despite lacking the Paladin upgrade, as they have the Keshik, a medium armored cavalry unit which generates gold when fighting other units, and complete upgrades to all Stable units (the Scout Cavalry also benefits from the Silk Armor unique technology) as well access to the Steppe Lancer which is exclusive to the Tatars, Cumans, and Mongols, and affected by Silk Armor. Though having Hand Cannoneer, their foot archers are not great, due to lacking the Arbalester upgrade. Tatars also have possibly the weakest infantry of all civilizations, to the point that it is nearly unusable, not only lacking the Champion upgrade and Supplies, they are the only civilization that lack Chain Mail Armor. Despite having average siege units (lacking Siege Onager and Bombard Cannon), the Tatar Trebuchet has the longest range in the game, thanks to the Timurid Siegecraft unique technology which grants them +2 range (with Siege Engineers they reach 19 range). The Tatar navy is average, only lacking Heavy Demolition Ship and Shipwright. Their defenses are lackluster, due to lacking Hoardings, Architecture, Keep, and Arrowslits, but they have access to the Bombard Towers. Tatar Monks are very weak, as they lack several upgrades. Their economy is pretty strong at the start and part of the mid-game, as their herdables contain 50% more food and they get two free Sheep per new Town Center, starting in the Castle Age, but much more limited in the late game, due to lacking Stone Shaft Mining and Two-Man Saw.",
    }, // For LLM use only
    civBonuses: [
      {
        description: "their Herdables contain 50% more food", // Because ${description}
        // relevantMasterIds: [590, 592],
        isTeamBonus: false,
      },
      {
        description:
          "they get two extra Sheep for each newly-constructed Town Center", // Because ${description}
        // relevantMasterIds: [],
        isTeamBonus: false,
      },
      {
        description:
          "they get Parthian Tactics and Thumb Ring for free and automatically", // Because ${description}
        // relevantMasterIds: [], // TODO: It may be good to mark the units that are affected by this tech here instead
        isTeamBonus: false,
      },
      {
        description: "they deal 50% more damage when fighting on higher ground", // Because ${description}
        // relevantMasterIds: [42, 1263],
        // TODO: Add custom classes to activate on (high ground, resource threatened, lamed, etc.)
        // TODO: add resource types boosted
        isTeamBonus: false,
      },
      {
        description: "their Cavalry Archers have +2 Line of Sight", // Because as an ally to the ${civilization}, ${description}
        // relevantMasterIds: [
        //   11,
        //   39,
        //   172,
        //   474,
        //   561,
        //   583,
        //   596,
        //   827,
        //   829,
        //   873,
        //   875,
        //   1007,
        //   1009,
        //   1010,
        //   1012,
        //   1231,
        //   1260, // ^ class 36, Cavalry Archers
        // ],
        isTeamBonus: true,
      },
    ],
  },
  34: {
    name: "Cumans",
  },
  35: {
    name: "Lithuanians",
  },
  36: {
    name: "Burgundians",
  },
  37: {
    name: "Sicilians",
  },
  38: {
    name: "Poles",
  },
  39: {
    name: "Bohemians",
  },
};

