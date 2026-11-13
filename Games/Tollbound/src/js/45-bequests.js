// 45-bequests.js: the bequests (docs/design/04-progression.md, "Bills and bequests"): the last wishes of the city's
// dead, each a goal counted in vigils, and what each leaves when it is met. What a where may hold, and how each kind of
// event is counted, is in the header of 15-progress.js.
// Owns: (none)
// Public: nothing; it only registers definitions with Defs.add, of the kind bequest:
//   the Household's (scope 'account'), met once for every character that comes after:
//     great-hour            lay the Half-muffled Keeper                         120 Hum, 30 coin
//     a-quiet-dial          lay 1500 of the dead in the Dial                    60 coin, 60 Hum
//     the-heavy-ones        lay 100 Lumpers                                     60 Hum
//     shake-them-off        lay 100 hangers-on                                  40 coin
//     the-great-dead        lay 20 elites (rank 1 or above)                     the voice Plumb, into the chest
//     put-by                bank 150 coin by ringing down                       50 Hum
//     three-times-over      lay the Half-muffled Keeper three times (sealed)    150 Hum, 50 coin
//     twenty-homecomings    ring down 20 times                                  100 coin
//   each character's own (scope 'character'), met by each character for itself:
//     first-toll            hear a toll                                         1 point of the Plan
//     wait-for-the-keeper   hear the eighth toll of a vigil                     1 point
//     ring-on               hear the twelfth toll of a vigil                    1 point, 40 Hum
//     come-home             ring down at a lychgate                             1 point
//     five-times-home       ring down five times                                1 point, 30 coin
//     spared-at-the-gate    reach the far lychgate while Tolled-for (sealed)    1 point
//     close-your-wounds     close 60 wounds whole by mending                    1 point
//     take-what-is-given    take 40 favours                                     1 point
//     lay-the-keeper        lay a keeper                                        1 point
//     rock-the-crowd        a Change-ringer's pull with the bell set, 200 times 1 point
//     a-long-life           hear 50 tolls in its life                           50 coin, 50 Hum
//     grow-into-the-rope    reach the ninth level                               1 point
// About 11 points of the Plan for each character from the Dial; the later districts bring theirs, and the bequests
// that open the Toll-gatherer, the Lamp-trimmer and the Sexton (03-classes.md) come with those classes.
(function () {
  'use strict';

  const KEEPER = 'dial.half-muffled-keeper';

  // ---- the Household's ----

  Defs.add('bequest', {
    id: 'great-hour', name: 'Let Great Hour Speak', hidden: false, scope: 'account', on: 'kill', count: 1, where: { id: KEEPER },
    text: 'Josiah Brede wound the clock of the Dial for forty years. His wish: that its keeper be laid, and the bell he wound speak again.',
    reward: { hum: 120, coin: 30 },
  });
  Defs.add('bequest', {
    id: 'a-quiet-dial', name: 'A Quiet Dial', hidden: false, scope: 'account', on: 'kill', count: 1500, where: { zone: 'dial' },
    text: 'Martha Quill swept the Dial every morning of her life. She asks that fifteen hundred of its dead be laid, and the plaza left in peace.',
    reward: { coin: 60, hum: 60 },
  });
  Defs.add('bequest', {
    id: 'the-heavy-ones', name: 'Carry the Heavy Ones', hidden: false, scope: 'account', on: 'kill', count: 100, where: { id: 'dial.heavy' },
    text: 'Ned Ashworth bore coffins for the parish all his life. He asks that a hundred of the heavy dead be laid down at last.',
    reward: { hum: 60 },
  });
  Defs.add('bequest', {
    id: 'shake-them-off', name: 'Shake Them Off', hidden: false, scope: 'account', on: 'kill', count: 100, where: { id: 'dial.hanger-on' },
    text: 'Dinah Stroud could never abide a hanger-on. She asks that a hundred of them be shaken off and laid.',
    reward: { coin: 40 },
  });
  Defs.add('bequest', {
    id: 'the-great-dead', name: 'Lay the Great Dead', hidden: false, scope: 'account', on: 'kill', count: 20, where: { rank: 1 },
    text: 'Caleb Ord kept the parish book of the great dead, the ones the whole town feared. He asks that twenty be laid, and leaves the voice he was rung out with.',
    reward: { voice: 'plumb' },
  });
  Defs.add('bequest', {
    id: 'put-by', name: 'Put By for the Parish', hidden: false, scope: 'account', on: 'stroke', count: 150, where: { sum: 'b' },
    text: 'Gideon Marsh never spent a coin he could put by. He asks that 150 coin be rung down through the lychgates.',
    reward: { hum: 50 },
  });
  Defs.add('bequest', {
    id: 'three-times-over', name: 'Three Times Over', hidden: true, scope: 'account', on: 'kill', count: 3, where: { id: KEEPER },
    text: 'Abel Grice heard Great Hour fall dumb three times in his long life. He asks that its keeper be laid three times over.',
    reward: { hum: 150, coin: 50 },
  });
  Defs.add('bequest', {
    id: 'twenty-homecomings', name: 'Twenty Homecomings', hidden: false, scope: 'account', on: 'end', count: 20, where: { id: 'left' },
    text: 'Ruth Kemble kept the lamp of the lychgate trimmed. She asks that the Household come home through the gate twenty times.',
    reward: { coin: 100 },
  });

  // ---- each character's own ----

  Defs.add('bequest', {
    id: 'first-toll', name: 'Sit Up Till the First Toll', hidden: false, scope: 'character', on: 'toll', count: 1, where: {},
    text: 'Old Simeon Hale asks only that whoever is newly come sit up with him until the first toll.',
    reward: { planPoints: 1 },
  });
  Defs.add('bequest', {
    id: 'wait-for-the-keeper', name: 'Wait Up for the Keeper', hidden: false, scope: 'character', on: 'toll', count: 1, where: { least: 8 },
    text: 'Lettice Mare waited up every night for the eighth stroke. She asks that you hear it.',
    reward: { planPoints: 1 },
  });
  Defs.add('bequest', {
    id: 'ring-on', name: 'Ring On Past the Keeper', hidden: false, scope: 'character', on: 'toll', count: 1, where: { least: 12 },
    text: 'Walter Pym would not leave a tower while its bell still rang. He asks that you hear the twelfth toll of a vigil.',
    reward: { planPoints: 1, hum: 40 },
  });
  Defs.add('bequest', {
    id: 'come-home', name: 'Come Home by the Gate', hidden: false, scope: 'character', on: 'end', count: 1, where: { id: 'left' },
    text: 'Jacob Lusk went down one night and never came home. He asks that you do: ring down at a lychgate.',
    reward: { planPoints: 1 },
  });
  Defs.add('bequest', {
    id: 'five-times-home', name: 'Five Times Home', hidden: false, scope: 'character', on: 'end', count: 5, where: { id: 'left' },
    text: 'Peg Morrow counted her son home five times before the river kept him. Ring down five times.',
    reward: { planPoints: 1, coin: 30 },
  });
  Defs.add('bequest', {
    id: 'spared-at-the-gate', name: 'Spared at the Gate', hidden: true, scope: 'character', on: 'end', count: 1, where: { id: 'spared' },
    text: 'Elias Fenn was tolled for, and still walked home. He asks the same of you: reach the far lychgate while Tolled-for.',
    reward: { planPoints: 1 },
  });
  Defs.add('bequest', {
    id: 'close-your-wounds', name: 'Close Your Wounds', hidden: false, scope: 'character', on: 'mend', count: 60, where: { id: 'whole' },
    text: 'Susan Thwaite bound wounds through the plague year. She asks that you close sixty of your own by standing on them.',
    reward: { planPoints: 1 },
  });
  Defs.add('bequest', {
    id: 'take-what-is-given', name: 'Take What Is Given', hidden: false, scope: 'character', on: 'favour', count: 40, where: {},
    text: 'Nan Petty handed out the favours at every funeral in the parish. She asks that you take forty of them.',
    reward: { planPoints: 1 },
  });
  Defs.add('bequest', {
    id: 'lay-the-keeper', name: 'Lay the Keeper Yourself', hidden: false, scope: 'character', on: 'kill', count: 1, where: { rank: 3 },
    text: 'Isaac Rudd asks that whoever reads his wish lay a keeper with their own voices.',
    reward: { planPoints: 1 },
  });
  Defs.add('bequest', {
    id: 'rock-the-crowd', name: 'Rock the Crowd', hidden: false, scope: 'character', on: 'pull', count: 200,
    where: { is: 2, class: 'change-ringer' },
    text: 'Bess Hollin rang the treble for fifty years. She asks a Change-ringer to pull two hundred times with the bell set.',
    reward: { planPoints: 1 },
  });
  Defs.add('bequest', {
    id: 'a-long-life', name: 'A Long Life', hidden: false, scope: 'character', on: 'toll', count: 50, where: {},
    text: 'Tom Varley heard more tolls than anyone in the parish. He asks that you hear fifty in your life.',
    reward: { coin: 50, hum: 50 },
  });
  Defs.add('bequest', {
    id: 'grow-into-the-rope', name: 'Grow Into the Rope', hidden: false, scope: 'character', on: 'grow', count: 1, where: { least: 9 },
    text: 'Ann Cobb rang in the tower from the age of nine. She asks that you reach the ninth level.',
    reward: { planPoints: 1 },
  });
})();
