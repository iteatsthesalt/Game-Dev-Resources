// 32-plan.js: the Plan, the street plan of Tollbound that every class shares (docs/design/04-progression.md, "The
// Plan"): the plan 'main' with the numbers of its rules, and its nodes.
// Owns: (none)
// Public: nothing; it only registers definitions with Defs.add:
//   plan 'main'      8 rings, 12 streets; ringGain 15, bankGain 60, mileGain 25 a node beyond the 4th (10 at most),
//                    loops of 12 or fewer at 50%, refund 5 coin x the head's ring. look: what the screen draws: the
//                    rings' radii and the walls' names, the streets' angles and names, the close, the river (its
//                    course as points and its half width), and a colour for each class's quarter.
//   node 'plan.*'    about 640 places: the six class doors, lanes, corners, squares, milestones and four bridges.
//
// The shape (04-progression.md, "Its shape"). The cathedral close is the middle, and no node: the Lantern's tower
// stands in it. Round it run eight ring roads, the old walls, numbered outward; twelve straight streets run out from
// the close across all eight, street s at 15 + 30 s degrees, sunwise from the east (+y is south, down the screen).
// The six doors stand on ring 1 on the odd streets, two streets apart, each a class's high street out into its
// quarter (the 60 degrees round it); the even streets are seams, each shared by two quarters whose classes favour
// one attribute in common, and the order of the doors makes every pair of neighbours share one: the Change-ringer
// (Hand, Knee), the Verger (Heel, Hand), the Lamp-trimmer (Ear, Heel), the Toll-gatherer (Ear, Hand), the Sexton
// (Knee, Ear), the Organ-blower (Knee, Heel). Each quarter's nodes lean on its class's stats; the seams on the
// attribute the two share.
//   Between two streets each ring road has 1 (ring 1) to 5 (ring 8) nodes, and each street one node between two
//   rings. Each block between two rings and two streets holds an alley of 1 to 3 nodes, from the ring road inside to
//   the one outside; in four blocks of every quarter the alley is a court, a dead end that opens on one side only
//   and ends in a square: walk in and come back the same way, or fence the block with a loop and be granted it.
//   A node between ring N and ring N + 1 is of ring N: the band outside a wall belongs to it.
//   The river crosses from west to east south of the close, y = 27 + 0.00546 x^2, so the plan's south (rings 3 to 8)
//   lies beyond it. What stands in the water is gone and no link crosses it but the four bridges, the nodes of the
//   four southern streets where the river crosses them. The nodes within two steps of the water (those that had a
//   link into it, and their neighbours) are the Flood bank on its south side and the Ebb bank on its north.
//   Kinds by place: on ring roads, a lane (a point of the quarter's two attributes; on ring 1, any of the four)
//   between two corners; at a crossing a corner, a square where a high street crosses rings 3 and 6, a door on ring 1;
//   on a street between two rings, milestones at rings 3 and 6, corners at 2 and 5, lanes with a small stat at 1, 4
//   and 7; in an alley lanes and corners, and a court's square at its end. Banks have their own corners; rings 7 and
//   8 lean every other corner on the keeper and the late vigil, since they work from the 6th and 7th tolls.
// Ids: 'plan.<ring>.<street>' a crossing; that and '.a<j>' the j-th node sunwise on the ring road after it; '.s' the
// node of the street just outside it; '.b<k>' the k-th node of the alley in the block sunwise and outside it;
// 'plan.door.<class>'; 'plan.bridge.<street>'. Display text is only in names and texts; the screen words the mods.
(function () {
  'use strict';

  // ---- the shape ----
  const RINGS = 8, STREETS = 12;
  const RADIUS = [15, 24, 33, 42, 51, 60, 69, 78];   // each ring road's distance from the middle of the close
  const ARC = [1, 2, 2, 3, 3, 4, 4, 5];               // nodes on a ring road between two streets, ring by ring
  const ALLEY = [1, 1, 2, 2, 2, 3, 3];                // nodes of the alley in a block outside ring 1 .. ring 7
  const FIRST = 15, STEP = 30, CLOSE = 10;            // street angles in degrees; the close's radius
  const RIVER_Y = 27, RIVER_BEND = 0.00546, RIVER_HALF = 1.6, RIVER_SPAN = 96, RIVER_POINTS = 25;
  const BRIDGE_AT = [[1, 3], [2, 1], [3, 1], [4, 3]];   // [street, ring index]: the street's node outside that ring
  // the courts of a quarter: [ring index, column (0 the block before its high street, 1 after it), the side it opens];
  // all four stand clear of the river, which crosses column 0 of the eastern and western quarters from ring 5 out
  const COURTS = [[0, 1, 'out'], [2, 0, 'in'], [4, 1, 'out'], [6, 1, 'in']];
  const DEG = Math.PI / 180;

  // ---- the words of the plan ----
  const WALLS = ['the Close Wall', 'the Canons\' Wall', 'the Tithe Wall', 'the Founders\' Wall', 'the Wool Wall', 'the Salt Wall',
    'the Tide Wall', 'the Marsh Wall'];
  // the streets, 0 to 11: a seam names the attribute its two quarters share; two milestones each, at rings 3 and 6
  const STREET = [
    { name: 'Clockmakers\' Street', seam: 'ear', miles: [
      { name: 'the Hour Stone', text: 'Cut with the hours of the old clock.', mods: [{ stat: 'heed-max', op: 'flat', value: 3 }] },
      { name: 'the Quarter Stone', text: 'Four notches, one for each quarter.', mods: [{ stat: 'damage', op: 'inc', value: 3, cond: 'after-quarter' }] }] },
    { name: 'Tollbar Street', seam: null, miles: [
      { name: 'the Toll Stone', text: 'The way to the next bar, and its price.', mods: [{ stat: 'coin-find', op: 'inc', value: 3 }] },
      { name: 'the Pike Stone', text: 'Every gatherer measured the bar from here.', mods: [{ stat: 'bar-length', op: 'flat', value: 0.15 }] }] },
    { name: 'Ferry Street', seam: 'ear', miles: [
      { name: 'the Ferry Stone', text: 'The ferry\'s times, cut deep.', mods: [{ stat: 'warn', op: 'flat', value: 0.006 }] },
      { name: 'the Flood Stone', text: 'Flood marks, one above another.', mods: [{ stat: 'sound-time', op: 'flat', value: -0.03 }] }] },
    { name: 'Lych Street', seam: null, miles: [
      { name: 'the Lych Stone', text: 'A mile of the old way down to the churchyard.', mods: [{ stat: 'dig-rate', op: 'inc', value: 2 }] },
      { name: 'the Shroud Stone', text: 'The winding-sheets were washed on it.', mods: [{ stat: 'life-max', op: 'flat', value: 2 }] }] },
    { name: 'Mourners\' Street', seam: 'knee', miles: [
      { name: 'the Weeping Stone', text: 'Worn smooth by hands.', mods: [{ stat: 'mend-rate', op: 'inc', value: 2 }] },
      { name: 'the Kneeling Stone', text: 'Hollowed by knees.', mods: [{ stat: 'guard.blow', op: 'flat', value: 0.6 }] }] },
    { name: 'Bellows Street', seam: null, miles: [
      { name: 'the Wind Stone', text: 'The wind always blows past it.', mods: [{ stat: 'move-speed', op: 'inc', value: 1 }] },
      { name: 'the Breath Stone', text: 'Breath, counted.', mods: [{ stat: 'chest-size', op: 'flat', value: 1 }] }] },
    { name: 'Chantry Street', seam: 'knee', miles: [
      { name: 'the Chantry Stone', text: 'A mass sung for each name on it.', mods: [{ stat: 'life-max', op: 'flat', value: 2 }] },
      { name: 'the Hassock Stone', text: 'Kneel here.', mods: [{ stat: 'brace-time', op: 'flat', value: -0.01 }] }] },
    { name: 'Ringers\' Street', seam: null, miles: [
      { name: 'the Rope Stone', text: 'A new rope was measured against it.', mods: [{ stat: 'pull-window', op: 'flat', value: 0.004 }] },
      { name: 'the Tenor Stone', text: 'As heavy as the tenor, they said.', mods: [{ stat: 'damage', op: 'inc', value: 3, tags: ['round'] }] }] },
    { name: 'Glovers\' Street', seam: 'hand', miles: [
      { name: 'the Glove Stone', text: 'Gloves were given out here at every funeral.', mods: [{ stat: 'pickup-reach', op: 'inc', value: 2 }] },
      { name: 'the Hand Stone', text: 'A hand carved on it, open.', mods: [{ stat: 'damage', op: 'inc', value: 3, cond: 't-near' }] }] },
    { name: 'Processional Way', seam: null, miles: [
      { name: 'the Station Stone', text: 'The procession halted at every stone.', mods: [{ stat: 'wake-length', op: 'flat', value: 0.08 }] },
      { name: 'the Wand Stone', text: 'A verger\'s wand long.', mods: [{ stat: 'wedge-length', op: 'flat', value: 0.04 }] }] },
    { name: 'Carters\' Street', seam: 'heel', miles: [
      { name: 'the Cart Stone', text: 'Wheel ruts worn into it.', mods: [{ stat: 'find-weight', op: 'flat', value: -0.03 }] },
      { name: 'the Mile Stone', text: 'The plain old mile.', mods: [{ stat: 'move-speed', op: 'inc', value: 1 }] }] },
    { name: 'Tallow Street', seam: null, miles: [
      { name: 'the Wick Stone', text: 'Burnt black by a thousand tapers.', mods: [{ stat: 'lamp-burn', op: 'flat', value: 0.6 }] },
      { name: 'the Link Stone', text: 'The link-boys sat on it to wait.', mods: [{ stat: 'warn', op: 'flat', value: 0.004 }] }] },
  ];

  // The quarters, by the street of their door. names: the lanes that give a point of the quarter's two attributes.
  // lanes: those with a small stat. corners: a stat held to a tag or a condition. squares: a rule with its price: the
  // first two where the high street crosses rings 3 and 6, the other four at the ends of the quarter's courts.
  const QUARTERS = [
    { street: 1, cls: 'toll-gatherer', colour: '#8C3A25', pair: ['ear', 'hand'],
      door: { name: 'the Gatherers\' Door', text: 'The toll-gatherers went out from the close to their bars by this door.' },
      names: ['Turnstile Lane', 'Pike Row', 'Ledger Lane', 'Tollbar Walk', 'Tally Alley', 'Turnpike Lane'],
      lanes: [
        { name: 'Fare Lane', text: 'Carters counted out their fares here before the bar.', mods: [{ stat: 'coin-find', op: 'inc', value: 3 }] },
        { name: 'Post Lane', text: 'Where the new posts were cut and tarred.', mods: [{ stat: 'bar-length', op: 'flat', value: 0.15 }] },
        { name: 'Farthing Lane', text: 'Small change, and quick hands to take it.', mods: [{ stat: 'pickup-reach', op: 'inc', value: 4 }] },
        { name: 'Tally Lane', text: 'Notched sticks, one for every cart.', mods: [{ stat: 'heed-max', op: 'flat', value: 2 }] },
        { name: 'Drovers\' Lane', text: 'The herds came through here in a long file.', mods: [{ stat: 'procession-cap', op: 'flat', value: 1 }] }],
      corners: [
        { name: 'Pike Corner', text: 'The bar swung shut across the road here.', mods: [{ stat: 'damage', op: 'inc', value: 8, tags: ['line'] }] },
        { name: 'Weighbridge Corner', text: 'Every load was weighed, and every load paid.', mods: [{ stat: 'damage', op: 'inc', value: 8, cond: 't-in-procession' }] },
        { name: 'Round House Corner', text: 'The gatherer walked round the post all day.', mods: [{ stat: 'damage', op: 'inc', value: 6, cond: 'striding' }] },
        { name: 'Chain Corner', text: 'A chain across the road for the night.', mods: [{ stat: 'damage', op: 'inc', value: 8, tags: ['blow'], cond: 't-striding' }] },
        { name: 'Ticket Corner', text: 'A ticket for every cart, and a clock to stamp it.', mods: [{ stat: 'damage', op: 'inc', value: 8, tags: ['timed'] }] },
        { name: 'Toll House Corner', text: 'The window where the coin went in.', mods: [{ stat: 'coin-find', op: 'inc', value: 8, cond: 'at-post' }] },
        { name: 'Collectors\' Corner', text: 'The gatherers met here to count the day.', mods: [{ stat: 'damage', op: 'inc', value: 7, cond: 'crowded' }] }],
      squares: [
        { name: 'Tollbar Square', text: 'Every cart paid here, and nobody hurried.',
          mods: [{ stat: 'damage', op: 'more', value: 20, tags: ['line'] }, { stat: 'move-speed', op: 'inc', value: -6 }] },
        { name: 'Exchequer Square', text: 'The city\'s counting table: more coin, and less of the bells\' Hum heard over it.',
          mods: [{ stat: 'coin-find', op: 'more', value: 25 }, { stat: 'hum-gain', op: 'inc', value: -10 }] },
        { name: 'Lockup Yard', text: 'Those who would not pay waited here, in a line.',
          mods: [{ stat: 'damage', op: 'more', value: 25, cond: 't-in-procession' }, { stat: 'procession-cap', op: 'flat', value: -10 }] },
        { name: 'Customs Court', text: 'Every bale opened, and every bale heavier for it.',
          mods: [{ stat: 'find-chance', op: 'more', value: 20 }, { stat: 'find-weight', op: 'flat', value: 0.5 }] },
        { name: 'Toll-clerks\' Court', text: 'Clerks who count the seconds hear nothing else.',
          mods: [{ stat: 'damage', op: 'more', value: 20, tags: ['timed'] }, { stat: 'heed-max', op: 'flat', value: -15 }] },
        { name: 'Bargate Yard', text: 'The great bar of the river road, where the big carts were stopped.',
          mods: [{ stat: 'damage', op: 'more', value: 20, cond: 't-elite' }, { stat: 'taken', op: 'inc', value: 8, tags: ['blow'] }] }] },
    { street: 3, cls: 'sexton', colour: '#5D6A39', pair: ['knee', 'ear'],
      door: { name: 'the Sextons\' Door', text: 'The sextons carried the dead out by this door, down to the river and over it.' },
      names: ['Coffin Lane', 'Yew Walk', 'Lych Lane', 'Sexton\'s Row', 'Shroud Alley', 'Bier Lane'],
      lanes: [
        { name: 'Grave Lane', text: 'The spades were kept sharp here.', mods: [{ stat: 'dig-rate', op: 'inc', value: 3 }] },
        { name: 'Turf Lane', text: 'Turves stacked to lay over the new graves.', mods: [{ stat: 'life-max', op: 'flat', value: 4 }] },
        { name: 'Bone Lane', text: 'Where the old bones were moved to make room.', mods: [{ stat: 'mend-rate', op: 'inc', value: 4 }] },
        { name: 'Mattock Lane', text: 'Hard ground, and the tools for it.', mods: [{ stat: 'guard.blow', op: 'flat', value: 1 }] },
        { name: 'Shroud Lane', text: 'The winding women lived along this lane.', mods: [{ stat: 'wound-term', op: 'flat', value: 2 }] }],
      corners: [
        { name: 'Mound Corner', text: 'Fresh earth, heaped and trodden.', mods: [{ stat: 'damage', op: 'inc', value: 8, tags: ['still'] }] },
        { name: 'Bier Corner', text: 'Where the bier was set down to rest.', mods: [{ stat: 'damage', op: 'inc', value: 8, cond: 't-braced' }] },
        { name: 'Churchyard Cross', text: 'Every grave filled closes a wound.', mods: [{ stat: 'mend-on-lay', op: 'flat', value: 3 }] },
        { name: 'Yew Corner', text: 'The yews keep the weather off the graves.', mods: [{ stat: 'taken', op: 'inc', value: -5, tags: ['drag'], cond: 'braced' }] },
        { name: 'Spade Corner', text: 'Cut, lift, throw.', mods: [{ stat: 'damage', op: 'inc', value: 8, tags: ['blow'], cond: 't-near' }] },
        { name: 'Charnel Corner', text: 'Nothing is wasted here, not even a scar.', mods: [{ stat: 'scarring', op: 'flat', value: -4 }] },
        { name: 'Sod Corner', text: 'Feet planted on the sod.', mods: [{ stat: 'guard.blow', op: 'flat', value: 3, cond: 'crowded' }] },
        { name: 'Passing Corner', text: 'They stop and look when the dead go by.', mods: [{ stat: 'damage', op: 'inc', value: 8, cond: 't-mourning' }] }],
      squares: [
        { name: 'Gravediggers\' Square', text: 'They dug in shifts, and never went far.',
          mods: [{ stat: 'dig-rate', op: 'more', value: 25 }, { stat: 'move-speed', op: 'inc', value: -8 }] },
        { name: 'Bone House Square', text: 'Bones stacked to the rafters, and no room to turn.',
          mods: [{ stat: 'damage', op: 'more', value: 20, tags: ['still'] }, { stat: 'turn-limit', op: 'flat', value: -10 }] },
        { name: 'Potter\'s Field', text: 'The ground the city gave its strangers: deep, and slow to heal.',
          mods: [{ stat: 'life-max', op: 'more', value: 12 }, { stat: 'mend-rate', op: 'inc', value: -15 }] },
        { name: 'Dead House Yard', text: 'The dead were laid out here before the ground took them.',
          mods: [{ stat: 'mend-on-lay', op: 'flat', value: 12 }, { stat: 'wound-cap', op: 'flat', value: -2 }] },
        { name: 'Paupers\' Court', text: 'Hard benches and long waits.',
          mods: [{ stat: 'guard.blow', op: 'flat', value: 6 }, { stat: 'guard.drag', op: 'flat', value: -8 }] },
        { name: 'Charnel Court', text: 'What the ground gives back, it gives back quickly.',
          mods: [{ stat: 'scarring', op: 'more', value: -20 }, { stat: 'wound-term', op: 'flat', value: -10 }] }] },
    { street: 5, cls: 'organ-blower', colour: '#4E9985', pair: ['knee', 'heel'],
      door: { name: 'the Blowers\' Door', text: 'The organ-blowers\' door, under the great pipes.' },
      names: ['Bellows Lane', 'Organ Row', 'Pipe Alley', 'Treadle Lane', 'Rush Lane', 'Loft Walk'],
      lanes: [
        { name: 'Leather Lane', text: 'Hides soaked and stretched for the bellows.', mods: [{ stat: 'chest-size', op: 'flat', value: 1 }] },
        { name: 'Wind Lane', text: 'A draught runs down it whatever the weather.', mods: [{ stat: 'move-speed', op: 'inc', value: 1.5 }] },
        { name: 'Weight Lane', text: 'Where the bellows weights were cast.', mods: [{ stat: 'life-max', op: 'flat', value: 4 }] },
        { name: 'Trundle Lane', text: 'Long, flat and good for running.', mods: [{ stat: 'stride-share', op: 'flat', value: -1 }] },
        { name: 'Stop Lane', text: 'Named for the organ stops made along it.', mods: [{ stat: 'guard.drag', op: 'flat', value: 1 }] }],
      corners: [
        { name: 'Pipe Corner', text: 'The longest pipes were drawn out here.', mods: [{ stat: 'damage', op: 'inc', value: 8, tags: ['drag'] }] },
        { name: 'Stop Corner', text: 'Stand, and the note comes.', mods: [{ stat: 'speed', op: 'inc', value: 5, cond: 'braced' }] },
        { name: 'Treadle Corner', text: 'Feet that never rest.', mods: [{ stat: 'move-speed', op: 'inc', value: 3, cond: 'striding' }] },
        { name: 'Reed Corner', text: 'The reeds were cut to shape here.', mods: [{ stat: 'area', op: 'inc', value: 6, tags: ['drag'] }] },
        { name: 'Gust Corner', text: 'Doors slam on this corner.', mods: [{ stat: 'shove', op: 'flat', value: 0.15, tags: ['drag'] }] },
        { name: 'Pallet Corner', text: 'The valve under every pipe opens when you stop.', mods: [{ stat: 'damage', op: 'inc', value: 7, cond: 'braced' }] },
        { name: 'Wind-trunk Corner', text: 'Air carried a long way under the floor.', mods: [{ stat: 'reach', op: 'inc', value: 6, tags: ['drag'] }] },
        { name: 'Bellows Cross', text: 'Two boards, two hands, and breath between.', mods: [{ stat: 'taken', op: 'inc', value: -5, tags: ['drag'], cond: 'striding' }] }],
      squares: [
        { name: 'Blowers\' Square', text: 'Hold still, and let it all out.',
          mods: [{ stat: 'speed', op: 'more', value: 15, cond: 'braced' }, { stat: 'move-speed', op: 'inc', value: -8 }] },
        { name: 'Great Organ Square', text: 'The whole city heard it once, and stood still to listen.',
          mods: [{ stat: 'damage', op: 'more', value: 20, tags: ['drag'] }, { stat: 'taken', op: 'inc', value: 10, tags: ['blow'] }] },
        { name: 'Loft Court', text: 'Up the narrow stair to the bellows, and slow to come down.',
          mods: [{ stat: 'chest-size', op: 'flat', value: 6 }, { stat: 'brace-time', op: 'flat', value: 0.15 }] },
        { name: 'Wind House Yard', text: 'All the wind of the city kept in one room.',
          mods: [{ stat: 'stride-share', op: 'flat', value: -6 }, { stat: 'guard.blow', op: 'flat', value: -6 }] },
        { name: 'Bellows Yard', text: 'One push, and the yard clears.',
          mods: [{ stat: 'shove', op: 'flat', value: 0.6 }, { stat: 'speed', op: 'inc', value: -8 }] },
        { name: 'Choir Court', text: 'Every voice at once, and none of them far.',
          mods: [{ stat: 'area', op: 'more', value: 15, tags: ['drag'] }, { stat: 'reach', op: 'inc', value: -10 }] }] },
    { street: 7, cls: 'change-ringer', colour: '#A7312C', pair: ['hand', 'knee'],
      door: { name: 'the Ringers\' Door', text: 'The change-ringers went out from the close by this door, ropes over their shoulders.' },
      names: ['Belfry Lane', 'Ringers\' Row', 'Sally Lane', 'Bell Alley', 'Tenor Walk', 'Rope Lane'],
      lanes: [
        { name: 'Hemp Lane', text: 'Rope was laid up here for the towers.', mods: [{ stat: 'pull-window', op: 'flat', value: 0.005 }] },
        { name: 'Stay Lane', text: 'Where the stays were cut from ash.', mods: [{ stat: 'set-time', op: 'flat', value: -0.015 }] },
        { name: 'Ringers\' Lane', text: 'The ringers lodged along it, near their bells.', mods: [{ stat: 'guard.blow', op: 'flat', value: 1 }] },
        { name: 'Clapper Lane', text: 'Clappers hung in every window to be mended.', mods: [{ stat: 'wrong-foot', op: 'flat', value: 3 }] },
        { name: 'Tower Lane', text: 'Under the tower every step is counted.', mods: [{ stat: 'life-max', op: 'flat', value: 4 }] }],
      corners: [
        { name: 'Tenor Corner', text: 'The heaviest bell turned here, slowly.', mods: [{ stat: 'damage', op: 'inc', value: 8, tags: ['round'] }] },
        { name: 'Backstroke Corner', text: 'Turn, and the crowd turns after you.', mods: [{ stat: 'damage', op: 'inc', value: 8, cond: 't-wrong-footed' }] },
        { name: 'Wheel Corner', text: 'The wheel goes round, and the rope with it.', mods: [{ stat: 'speed', op: 'inc', value: 5, cond: 'crowded' }] },
        { name: 'Treble Corner', text: 'The lightest bell, and the quickest to speak.', mods: [{ stat: 'damage', op: 'inc', value: 8, tags: ['held'] }] },
        { name: 'Clapper Corner', text: 'The clapper always finds the bell.', mods: [{ stat: 'wrong-foot', op: 'flat', value: 6, tags: ['blow'] }] },
        { name: 'Bob Corner', text: 'A call, and the order changes.', mods: [{ stat: 'damage', op: 'inc', value: 7, cond: 'crowded' }] },
        { name: 'Lead Corner', text: 'Lead the change, and the rest follow close.', mods: [{ stat: 'damage', op: 'inc', value: 8, cond: 't-near' }] },
        { name: 'Rope-sight Corner', text: 'Watch the rope, not the bell.', mods: [{ stat: 'guard.blow', op: 'flat', value: 3, cond: 'crowded' }] }],
      squares: [
        { name: 'Tenor Square', text: 'The great bell hung lowest, and swung longest.',
          mods: [{ stat: 'damage', op: 'more', value: 20, tags: ['round'] }, { stat: 'taken', op: 'inc', value: 8, unless: 'braced' }] },
        { name: 'Backstroke Square', text: 'The whole square turns as one, and so do you.',
          mods: [{ stat: 'damage', op: 'more', value: 25, cond: 't-wrong-footed' }, { stat: 'turn-limit', op: 'flat', value: -15 }] },
        { name: 'Sally Court', text: 'Ropes hung to dry from every gallery.',
          mods: [{ stat: 'pull-window', op: 'flat', value: 0.06 }, { stat: 'set-time', op: 'flat', value: 0.3 }] },
        { name: 'Stay Yard', text: 'Bells resting mouth-up on their stays.',
          mods: [{ stat: 'set-time', op: 'flat', value: -0.3 }, { stat: 'pull-window', op: 'flat', value: -0.05 }] },
        { name: 'Firing Court', text: 'Every bell at once, and the street shakes.',
          mods: [{ stat: 'speed', op: 'more', value: 12 }, { stat: 'heed-max', op: 'flat', value: -15 }] },
        { name: 'Call-change Yard', text: 'Each call swaps two bells, and nobody is ready.',
          mods: [{ stat: 'wrong-foot', op: 'flat', value: 40 }, { stat: 'wrong-foot-taken', op: 'flat', value: 25 }] }] },
    { street: 9, cls: 'verger', colour: '#2E4E8E', pair: ['heel', 'hand'],
      door: { name: 'the Vergers\' Door', text: 'The processions left the close by this door, the vergers walking first.' },
      names: ['Aisle Lane', 'Pew Row', 'Wand Lane', 'Vestry Walk', 'Usher Lane', 'Cope Alley'],
      lanes: [
        { name: 'Gown Lane', text: 'Black cloth cut to the ground.', mods: [{ stat: 'move-speed', op: 'inc', value: 1.5 }] },
        { name: 'Verge Lane', text: 'The wands were turned and capped here.', mods: [{ stat: 'wedge-length', op: 'flat', value: 0.05 }] },
        { name: 'Ushers\' Lane', text: 'Room was made here for whoever came.', mods: [{ stat: 'stride-share', op: 'flat', value: -1 }] },
        { name: 'Cassock Lane', text: 'Long strides wear long hems.', mods: [{ stat: 'guard.drag', op: 'flat', value: 1 }] },
        { name: 'Lectern Lane', text: 'Read aloud, and walk on.', mods: [{ stat: 'wake-length', op: 'flat', value: 0.1 }] }],
      corners: [
        { name: 'Aisle Corner', text: 'Straight down the middle, and nobody in the way.', mods: [{ stat: 'damage', op: 'inc', value: 8, tags: ['moving'] }] },
        { name: 'Wedge Corner', text: 'The crowd parts here, left and right.', mods: [{ stat: 'damage', op: 'inc', value: 8, tags: ['line'], cond: 'striding' }] },
        { name: 'Nave Corner', text: 'A long walk under a high roof.', mods: [{ stat: 'taken', op: 'inc', value: -5, tags: ['drag'], cond: 'striding' }] },
        { name: 'Processional Cross', text: 'The procession never stops at a corner.', mods: [{ stat: 'damage', op: 'inc', value: 6, cond: 'striding' }] },
        { name: 'Pew Corner', text: 'The back pews are a long way off.', mods: [{ stat: 'damage', op: 'inc', value: 8, cond: 't-far' }] },
        { name: 'Usher Corner', text: 'Shown to their places, firmly.', mods: [{ stat: 'shove', op: 'flat', value: 0.15, tags: ['moving'] }] },
        { name: 'Rood Corner', text: 'Eyes up, feet on.', mods: [{ stat: 'move-speed', op: 'inc', value: 3, cond: 'crowded' }] },
        { name: 'Chancel Corner', text: 'Nobody steps in front of the verger twice.', mods: [{ stat: 'damage', op: 'inc', value: 8, tags: ['blow'], cond: 't-in-procession' }] }],
      squares: [
        { name: 'Processional Square', text: 'On feast days the whole city walked through here, and never stopped.',
          mods: [{ stat: 'move-speed', op: 'more', value: 10, cond: 'striding' }, { stat: 'guard.blow', op: 'flat', value: -6 }] },
        { name: 'West Door Square', text: 'The great doors stood open for the processions.',
          mods: [{ stat: 'damage', op: 'more', value: 20, tags: ['moving'] }, { stat: 'brace-time', op: 'flat', value: 0.2 }] },
        { name: 'Ushers\' Yard', text: 'Room for one more, always, if you push.',
          mods: [{ stat: 'wedge-length', op: 'flat', value: 0.6 }, { stat: 'turn-limit', op: 'flat', value: -10 }] },
        { name: 'Vestry Court', text: 'Robes, wands and the long book of the processions.',
          mods: [{ stat: 'wake-length', op: 'flat', value: 1.5 }, { stat: 'wake-lag', op: 'flat', value: -0.15 }] },
        { name: 'Cloister Court', text: 'Long walks, short rations.',
          mods: [{ stat: 'stride-share', op: 'flat', value: -5 }, { stat: 'life-max', op: 'inc', value: -8 }] },
        { name: 'Chapter Yard', text: 'Where the canons argued, walking up and down.',
          mods: [{ stat: 'damage', op: 'more', value: 20, tags: ['line'] }, { stat: 'heed-max', op: 'flat', value: -12 }] }] },
    { street: 11, cls: 'lamp-trimmer', colour: '#E6C25A', pair: ['ear', 'heel'],
      door: { name: 'the Trimmers\' Door', text: 'At dusk the lamp-trimmers came out of the close by this door.' },
      names: ['Tallow Lane', 'Wick Row', 'Lantern Lane', 'Oil Alley', 'Glass Lane', 'Lamp Walk'],
      lanes: [
        { name: 'Wick Lane', text: 'Wicks were plaited here by the yard.', mods: [{ stat: 'lamp-burn', op: 'flat', value: 1 }] },
        { name: 'Chandlers\' Lane', text: 'Candles dipped and hung by the dozen.', mods: [{ stat: 'heed-max', op: 'flat', value: 2 }] },
        { name: 'Oil Lane', text: 'The smell never leaves the stones.', mods: [{ stat: 'warn', op: 'flat', value: 0.005 }] },
        { name: 'Ladder Lane', text: 'Up, trim, down, and on to the next.', mods: [{ stat: 'move-speed', op: 'inc', value: 1.5 }] },
        { name: 'Spill Lane', text: 'Paper spills for lighting, a basket at every door.', mods: [{ stat: 'pickup-reach', op: 'inc', value: 4 }] }],
      corners: [
        { name: 'Lantern Corner', text: 'Light falls on this corner all night.', mods: [{ stat: 'speed', op: 'inc', value: 5, cond: 'in-light' }] },
        { name: 'Link Corner', text: 'The link-boys waited here with their torches.', mods: [{ stat: 'damage', op: 'inc', value: 8, tags: ['thrown'] }] },
        { name: 'Glass Corner', text: 'Every pane cleaned on the hour.', mods: [{ stat: 'damage', op: 'inc', value: 8, tags: ['timed'] }] },
        { name: 'Lamplit Cross', text: 'Nobody strikes well with the light in their eyes.', mods: [{ stat: 'taken', op: 'inc', value: -5, cond: 'in-light' }] },
        { name: 'Oil Corner', text: 'A long pole reaches far.', mods: [{ stat: 'reach', op: 'inc', value: 6, tags: ['thrown'] }] },
        { name: 'Flint Corner', text: 'Strike, and the spark flies.', mods: [{ stat: 'throw-speed', op: 'inc', value: 8, tags: ['thrown'] }] },
        { name: 'Watch Corner', text: 'The watchman called the hours from here.', mods: [{ stat: 'damage', op: 'inc', value: 7, cond: 'after-quarter' }] },
        { name: 'Beacon Corner', text: 'A light seen from the river.', mods: [{ stat: 'damage', op: 'inc', value: 8, cond: 't-far' }] }],
      squares: [
        { name: 'Trimmers\' Square', text: 'Every lamp in the square trimmed before dark, and no time to look up.',
          mods: [{ stat: 'speed', op: 'more', value: 12, cond: 'in-light' }, { stat: 'heed-max', op: 'flat', value: -10 }] },
        { name: 'Candlemas Square', text: 'The feast of lights, kept every year, and slow to leave.',
          mods: [{ stat: 'lamp-burn', op: 'flat', value: 10 }, { stat: 'move-speed', op: 'inc', value: -5 }] },
        { name: 'Chandlers\' Court', text: 'Tallow, wax and wick in every window.',
          mods: [{ stat: 'damage', op: 'more', value: 20, tags: ['thrown'] }, { stat: 'area', op: 'inc', value: -10 }] },
        { name: 'Wax Yard', text: 'Seals and candles cooling on the racks.',
          mods: [{ stat: 'warn', op: 'flat', value: 0.08 }, { stat: 'life-max', op: 'inc', value: -6 }] },
        { name: 'Beacon Court', text: 'Lit for the ships, and for the dead.',
          mods: [{ stat: 'damage', op: 'more', value: 20, tags: ['timed'] }, { stat: 'guard.drag', op: 'flat', value: -6 }] },
        { name: 'Watch House Yard', text: 'Someone was always awake here, and always tired.',
          mods: [{ stat: 'heed-max', op: 'flat', value: 20 }, { stat: 'taken', op: 'inc', value: 6 }] }] },
  ];

  // The seams, by the attribute their two quarters share.
  const SEAMS = {
    hand: {
      lanes: [
        { name: 'Elbow Lane', text: 'Too narrow to pass without touching.', mods: [{ stat: 'pickup-reach', op: 'inc', value: 4 }] },
        { name: 'Menders\' Lane', text: 'Needles and thread in every doorway.', mods: [{ stat: 'mend-reach', op: 'flat', value: 0.04 }] }],
      corners: [
        { name: 'Press Corner', text: 'Shoulder to shoulder.', mods: [{ stat: 'damage', op: 'inc', value: 8, cond: 't-near' }] },
        { name: 'Jostle Corner', text: 'Everyone pushes, and you push back.', mods: [{ stat: 'guard.blow', op: 'flat', value: 3, cond: 'crowded' }] },
        { name: 'Market Corner', text: 'Where the market pressed in on market days.', mods: [{ stat: 'damage', op: 'inc', value: 6, cond: 'crowded' }] },
        { name: 'Grip Corner', text: 'Hold on, and do not let go.', mods: [{ stat: 'procession-bonus', op: 'flat', value: 3 }] }] },
    heel: {
      lanes: [
        { name: 'Cobble Lane', text: 'Good footing, end to end.', mods: [{ stat: 'move-speed', op: 'inc', value: 1.5 }] },
        { name: 'Hauliers\' Lane', text: 'Loads carried quickly, and set down light.', mods: [{ stat: 'find-weight', op: 'flat', value: -0.05 }] }],
      corners: [
        { name: 'Running Corner', text: 'Nobody walks here.', mods: [{ stat: 'damage', op: 'inc', value: 6, cond: 'striding' }] },
        { name: 'Heel Corner', text: 'Off the mark at a run.', mods: [{ stat: 'damage', op: 'inc', value: 8, tags: ['moving'], cond: 'striding' }] },
        { name: 'Cart Corner', text: 'Wheels swing wide here, loaded or not.', mods: [{ stat: 'move-speed', op: 'inc', value: 3, cond: 'laden' }] },
        { name: 'Kerb Corner', text: 'Up and over without breaking step.', mods: [{ stat: 'taken', op: 'inc', value: -5, tags: ['drag'], cond: 'striding' }] }] },
    ear: {
      lanes: [
        { name: 'Bell-hour Lane', text: 'You could set a clock by it.', mods: [{ stat: 'heed-max', op: 'flat', value: 2 }] },
        { name: 'Echo Lane', text: 'Every sound comes back twice.', mods: [{ stat: 'warn', op: 'flat', value: 0.005 }] }],
      corners: [
        { name: 'Quarter Corner', text: 'The clock struck the quarters here.', mods: [{ stat: 'damage', op: 'inc', value: 8, cond: 'after-quarter' }] },
        { name: 'Listening Corner', text: 'Quiet enough to hear the river.', mods: [{ stat: 'sound-time', op: 'flat', value: -0.06 }] },
        { name: 'Watchman\'s Corner', text: 'He called the hours to the sleeping street.', mods: [{ stat: 'speed', op: 'inc', value: 5, cond: 'after-quarter' }] },
        { name: 'Hour Corner', text: 'Wait for it.', mods: [{ stat: 'damage', op: 'inc', value: 8, tags: ['timed'] }] }] },
    knee: {
      lanes: [
        { name: 'Hassock Lane', text: 'Kneelers stitched by the hundred.', mods: [{ stat: 'life-max', op: 'flat', value: 4 }] },
        { name: 'Prayer Lane', text: 'Slow steps and long pauses.', mods: [{ stat: 'mend-rate', op: 'inc', value: 4 }] }],
      corners: [
        { name: 'Kneeler Corner', text: 'The faithful knelt in the street here.', mods: [{ stat: 'damage', op: 'inc', value: 8, tags: ['still'] }] },
        { name: 'Pillar Corner', text: 'Lean on it, and it holds.', mods: [{ stat: 'damage', op: 'inc', value: 6, cond: 'braced' }] },
        { name: 'Altar Corner', text: 'Stand where the hurt is, and it closes.', mods: [{ stat: 'damage', op: 'inc', value: 6, cond: 'on-wound' }] },
        { name: 'Step Corner', text: 'A worn step, good for standing.', mods: [{ stat: 'brace-time', op: 'flat', value: -0.02 }] }] },
  };

  // corners of rings 7 and 8, which work from the 6th and 7th tolls: the keeper comes at the 8th, and the haul is heavy
  const LATE = [
    { name: 'Keeper\'s Cross', text: 'Where the great dead come up to look.', mods: [{ stat: 'damage', op: 'inc', value: 10, cond: 't-keeper' }] },
    { name: 'Elders\' Corner', text: 'The old dead walk tall here.', mods: [{ stat: 'damage', op: 'inc', value: 8, cond: 't-elite' }] },
    { name: 'Bearers\' Corner', text: 'Big bodies, slow and wide.', mods: [{ stat: 'damage', op: 'inc', value: 8, cond: 't-large' }] },
    { name: 'Belfry Corner', text: 'Stand by the post when the toll rings.', mods: [{ stat: 'hum-gain', op: 'inc', value: 6, cond: 'at-post' }] },
    { name: 'Pedlars\' Corner', text: 'Packs full, and still walking.', mods: [{ stat: 'notch-size', op: 'inc', value: 6, cond: 'laden' }] },
    { name: 'Gleaners\' Corner', text: 'Pick it up while they press.', mods: [{ stat: 'find-chance', op: 'inc', value: 6, cond: 'crowded' }] },
  ];
  // the banks' own corners and lane names: a flood node works in water, an ebb node on dry ground (Tree adds it)
  const FLOOD = {
    names: ['Wharf Lane', 'Ooze Lane', 'Wet Lane', 'Mudlark Lane', 'Eel Lane', 'Withy Lane'],
    corners: [
      { name: 'the Wharf', text: 'Water to the ankle at every tide.', mods: [{ stat: 'damage', op: 'inc', value: 10, tags: ['drag'] }] },
      { name: 'Mud Steps', text: 'Every step sinks, and holds.', mods: [{ stat: 'guard.drag', op: 'flat', value: 3 }] },
      { name: 'the Hard', text: 'A firm landing in the soft.', mods: [{ stat: 'shove-taken', op: 'inc', value: -6 }] },
      { name: 'Eel Stairs', text: 'Slippery, and alive.', mods: [{ stat: 'damage', op: 'inc', value: 10, tags: ['water'] }] },
      { name: 'Ferry Stairs', text: 'Wait for the boat with your bundle held tight.', mods: [{ stat: 'find-steady', op: 'flat', value: 0.3 }] },
      { name: 'the Slip', text: 'Boats came up here on the flood.', mods: [{ stat: 'damage', op: 'inc', value: 8, cond: 't-in-water' }] }],
  };
  const EBB = {
    names: ['Quay Lane', 'Staithe Lane', 'Dry Lane', 'Rope-store Lane', 'Wool Lane', 'Crane Lane'],
    corners: [
      { name: 'the Quay', text: 'Dry stone above the tide line.', mods: [{ stat: 'move-speed', op: 'inc', value: 3 }] },
      { name: 'Salt Steps', text: 'Salt dries white on the stones.', mods: [{ stat: 'chance.brined', op: 'flat', value: 2 }] },
      { name: 'the Staithe', text: 'Coal and timber stacked to dry.', mods: [{ stat: 'stride-share', op: 'flat', value: -1 }] },
      { name: 'Dry Dock Corner', text: 'Hulls propped and caulked.', mods: [{ stat: 'guard.blow', op: 'flat', value: 2 }] },
      { name: 'Wool Quay', text: 'Bales lifted out of the boats.', mods: [{ stat: 'coin-find', op: 'inc', value: 5 }] },
      { name: 'Tide Steps', text: 'Above the line the water leaves.', mods: [{ stat: 'damage', op: 'inc', value: 6, unless: 't-in-water' }] }],
  };
  // the four bridges, by their street: each a square, and each crossing has its toll
  const BRIDGES = {
    1: { name: 'the Toll Bridge', text: 'Pay on the way over, and again on the way back.',
      mods: [{ stat: 'coin-find', op: 'more', value: 15 }, { stat: 'move-speed', op: 'inc', value: -3 }] },
    2: { name: 'the Ferry Bridge', text: 'Built where the ferry ran, and as wet underfoot.',
      mods: [{ stat: 'damage', op: 'more', value: 15, tags: ['water'] }, { stat: 'guard.drag', op: 'flat', value: -3 }] },
    3: { name: 'the Lych Bridge', text: 'Every coffin of the south side crossed here.',
      mods: [{ stat: 'guard.drag', op: 'flat', value: 6 }, { stat: 'guard.blow', op: 'flat', value: -3 }] },
    4: { name: 'the Weeping Bridge', text: 'Mourners stopped here to look back.',
      mods: [{ stat: 'mend-rate', op: 'more', value: 15 }, { stat: 'wound-term', op: 'flat', value: -6 }] },
  };
  const ALL = ['knee', 'heel', 'hand', 'ear'];

  // ---- laying out the places: crossings, ring roads, the streets between rings, alleys ----
  const quarterOf = {};                    // the quarters by the street of their door
  for (let q = 0; q < QUARTERS.length; q++) quarterOf[QUARTERS[q].street] = QUARTERS[q];
  const bridgeOf = {};                     // the bridges by the id of the street node that carries one
  for (let b = 0; b < BRIDGE_AT.length; b++) bridgeOf['plan.' + (BRIDGE_AT[b][1] + 1) + '.' + BRIDGE_AT[b][0] + '.s'] = BRIDGE_AT[b][0];
  const nodes = [];    // {id, ring, street, x, y}, and later the rest of what it is
  const place = [];    // 'cross', 'arc', 'mid' (a street's node between two rings) or 'alley'
  const block = [];    // the street it stands on, or the one its stretch of ring road or its block follows sunwise
  const rank = [];     // its index along its stretch of ring road or its alley
  const bridge = [];   // it carries a street over the river
  const deadEnd = [];  // it is the end of a court
  const edges = [];    // [a, b]: indices into nodes
  const cross = [], arcs = [], mids = [], alleys = [];
  for (let r = 0; r < RINGS; r++) {
    cross.push([]);
    arcs.push([]);
    mids.push([]);
    alleys.push([]);
    for (let s = 0; s < STREETS; s++) {
      let a = (FIRST + STEP * s) * DEG, id = 'plan.' + (r + 1) + '.' + s;
      if (r === 0 && s % 2 === 1) id = 'plan.door.' + quarterOf[s].cls;
      cross[r].push(nodes.length);
      nodes.push({ id, ring: r + 1, street: s, x: Math.round(RADIUS[r] * Math.cos(a) * 100) / 100, y: Math.round(RADIUS[r] * Math.sin(a) * 100) / 100 });
      place.push('cross');
      block.push(s);
      rank.push(0);
      bridge.push(false);
      deadEnd.push(false);
      arcs[r].push([]);
      for (let j = 0; j < ARC[r]; j++) {
        a = (FIRST + STEP * (s + (j + 1) / (ARC[r] + 1))) * DEG;
        arcs[r][s].push(nodes.length);
        nodes.push({ id: 'plan.' + (r + 1) + '.' + s + '.a' + (j + 1), ring: r + 1, street: null,
          x: Math.round(RADIUS[r] * Math.cos(a) * 100) / 100, y: Math.round(RADIUS[r] * Math.sin(a) * 100) / 100 });
        place.push('arc');
        block.push(s);
        rank.push(j);
        bridge.push(false);
        deadEnd.push(false);
      }
      if (r === RINGS - 1) continue;
      const mid = (RADIUS[r] + RADIUS[r + 1]) / 2;
      a = (FIRST + STEP * s) * DEG;
      id = 'plan.' + (r + 1) + '.' + s + '.s';
      mids[r].push(nodes.length);
      bridge.push(typeof bridgeOf[id] === 'number');
      if (typeof bridgeOf[id] === 'number') id = 'plan.bridge.' + s;
      nodes.push({ id, ring: r + 1, street: s, x: Math.round(mid * Math.cos(a) * 100) / 100, y: Math.round(mid * Math.sin(a) * 100) / 100 });
      place.push('mid');
      block.push(s);
      rank.push(r + 1);
      deadEnd.push(false);
      alleys[r].push([]);
      for (let k = 0; k < ALLEY[r]; k++) {
        a = (FIRST + STEP * (s + (k + 1) / (ALLEY[r] + 1))) * DEG;
        alleys[r][s].push(nodes.length);
        nodes.push({ id: 'plan.' + (r + 1) + '.' + s + '.b' + (k + 1), ring: r + 1, street: null,
          x: Math.round(mid * Math.cos(a) * 100) / 100, y: Math.round(mid * Math.sin(a) * 100) / 100 });
        place.push('alley');
        block.push(s);
        rank.push(k);
        bridge.push(false);
        deadEnd.push(false);
      }
    }
  }
  // the links: the ring roads, the streets, and each alley with its one or two ways in
  for (let r = 0; r < RINGS; r++) {
    for (let s = 0; s < STREETS; s++) {
      let last = cross[r][s];
      for (let j = 0; j < ARC[r]; j++) {
        edges.push([last, arcs[r][s][j]]);
        last = arcs[r][s][j];
      }
      edges.push([last, cross[r][(s + 1) % STREETS]]);
      if (r === RINGS - 1) continue;
      edges.push([cross[r][s], mids[r][s]], [mids[r][s], cross[r + 1][s]]);
      const chain = alleys[r][s], n = chain.length, col = s % 2 === 1 ? 1 : 0;
      let opens = 'both';
      for (let c = 0; c < COURTS.length; c++) if (COURTS[c][0] === r && COURTS[c][1] === col) opens = COURTS[c][2];
      for (let k = 1; k < n; k++) edges.push([chain[k - 1], chain[k]]);
      // the way in from the ring road inside reaches the alley's first node, the way in from outside its last: each
      // from the node of that ring road nearest it by angle
      const inner = Math.min(ARC[r], Math.max(1, Math.round((ARC[r] + 1) / (n + 1)))) - 1;
      const outer = Math.min(ARC[r + 1], Math.max(1, Math.round(n * (ARC[r + 1] + 1) / (n + 1)))) - 1;
      if (opens !== 'out') edges.push([arcs[r][s][inner], chain[0]]);
      if (opens !== 'in') edges.push([chain[n - 1], arcs[r + 1][s][outer]]);
      if (opens === 'in') deadEnd[chain[n - 1]] = true;
      if (opens === 'out') deadEnd[chain[0]] = true;
    }
  }

  // ---- the river ----
  const river = [];
  for (let i = 0; i < RIVER_POINTS; i++) {
    const x = -RIVER_SPAN + 2 * RIVER_SPAN * i / (RIVER_POINTS - 1);
    river.push([Math.round(x * 100) / 100, Math.round((RIVER_Y + RIVER_BEND * x * x) * 100) / 100]);
  }
  // what stands in the water is gone, but for the bridges
  const gone = [], wet = [];
  for (let i = 0; i < nodes.length; i++) {
    let near = Infinity;
    for (let k = 0; k + 1 < river.length; k++) {
      const ax = river[k][0], ay = river[k][1], dx = river[k + 1][0] - ax, dy = river[k + 1][1] - ay;
      let t = ((nodes[i].x - ax) * dx + (nodes[i].y - ay) * dy) / (dx * dx + dy * dy);
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = ax + t * dx - nodes[i].x, ey = ay + t * dy - nodes[i].y;
      if (ex * ex + ey * ey < near) near = ex * ex + ey * ey;
    }
    gone.push(near < RIVER_HALF * RIVER_HALF && !bridge[i]);
    wet.push(0);
  }
  // a link into the water or across it is cut; a bridge's two links are what crosses it
  const cut = [];
  for (let e = 0; e < edges.length; e++) {
    const a = edges[e][0], b = edges[e][1], p = nodes[a], q = nodes[b];
    let across = false;
    for (let k = 0; k + 1 < river.length && !across; k++) {
      const ax = river[k][0], ay = river[k][1], bx = river[k + 1][0], by = river[k + 1][1];
      const d1 = (bx - ax) * (p.y - ay) - (by - ay) * (p.x - ax), d2 = (bx - ax) * (q.y - ay) - (by - ay) * (q.x - ax);
      const d3 = (q.x - p.x) * (ay - p.y) - (q.y - p.y) * (ax - p.x), d4 = (q.x - p.x) * (by - p.y) - (q.y - p.y) * (bx - p.x);
      across = d1 * d2 < 0 && d3 * d4 < 0;
    }
    cut.push(gone[a] || gone[b] || (across && !bridge[a] && !bridge[b]));
  }
  // the banks: a node one of whose links was cut, or that stands at a bridge's end, is a step from the water; its
  // neighbours on the same side are two
  for (let e = 0; e < edges.length; e++) {
    const a = edges[e][0], b = edges[e][1];
    if (!cut[e] && !bridge[a] && !bridge[b]) continue;
    if (!gone[a] && !bridge[a]) wet[a] = 1;
    if (!gone[b] && !bridge[b]) wet[b] = 1;
  }
  for (let e = 0; e < edges.length; e++) {
    const a = edges[e][0], b = edges[e][1];
    if (cut[e] || bridge[a] || bridge[b]) continue;
    if (wet[a] === 1 && wet[b] === 0) wet[b] = 2;
    else if (wet[b] === 1 && wet[a] === 0) wet[a] = 2;
  }
  const links = [];
  for (let i = 0; i < nodes.length; i++) links.push([]);
  for (let e = 0; e < edges.length; e++) {
    if (cut[e]) continue;
    links[edges[e][0]].push(nodes[edges[e][1]].id);
    links[edges[e][1]].push(nodes[edges[e][0]].id);
  }

  // ---- what each place is ----
  for (let q = 0; q < QUARTERS.length; q++) QUARTERS[q].at = { names: 0, lanes: 0, corners: 0, courts: 0 };
  const seamAt = { hand: { lanes: 0, corners: 0 }, heel: { lanes: 0, corners: 0 }, ear: { lanes: 0, corners: 0 }, knee: { lanes: 0, corners: 0 } };
  const at = { late: 0, turn: 0, flood: 0, ebb: 0, floodNames: 0, ebbNames: 0 };
  const defs = [];
  for (let i = 0; i < nodes.length; i++) {
    if (gone[i] || links[i].length === 0) continue;
    const node = nodes[i], where = place[i], ring = node.ring;
    const bank = wet[i] === 0 ? null : node.y > RIVER_Y + RIVER_BEND * node.x * node.x ? 'flood' : 'ebb';
    // a crossing or a street's node belongs to its street: a seam, or a quarter's high street; the rest to the quarter
    // of the block they border or stand in, whose high street is the odd one of its two
    const own = where === 'cross' || where === 'mid' ? block[i] : block[i] % 2 === 1 ? block[i] : (block[i] + 1) % STREETS;
    const street = STREET[own], seam = street.seam, quarter = seam === null ? quarterOf[own] : null;
    let kind = 'corner', from = null, choice = null;   // from: what it takes its name, text and mods from
    if (where === 'cross' && ring === 1 && seam === null) {
      kind = 'door';
      from = { name: quarter.door.name, text: quarter.door.text, mods: [] };
    } else if (bridge[i]) {
      kind = 'square';
      from = BRIDGES[node.street];
    } else if (where === 'cross' && seam === null && (ring === 3 || ring === 6)) {
      kind = 'square';
      from = quarter.squares[ring === 3 ? 0 : 1];
    } else if (deadEnd[i]) {
      kind = 'square';
      from = quarter.squares[2 + quarter.at.courts++ % (quarter.squares.length - 2)];
    } else if (where === 'mid' && (ring === 3 || ring === 6)) {
      kind = 'milestone';
      from = street.miles[ring === 3 ? 0 : 1];
    } else if (where === 'arc' && rank[i] % 2 === 0) {
      kind = 'lane';
      const names = bank === 'flood' ? FLOOD.names : bank === 'ebb' ? EBB.names : quarter.names;
      const n = bank === 'flood' ? at.floodNames++ : bank === 'ebb' ? at.ebbNames++ : quarter.at.names++;
      from = { name: names[n % names.length], mods: [] };
      choice = ring === 1 ? ALL.slice() : quarter.pair.slice();
    } else if ((where === 'mid' && (ring === 1 || ring === 4 || ring === 7)) ||
      (where === 'alley' && (ALLEY[ring - 1] === 1 ? (ring + block[i]) % 2 === 0 : rank[i] % 2 === 0))) {
      kind = 'lane';
      from = seam !== null ? SEAMS[seam].lanes[seamAt[seam].lanes++ % SEAMS[seam].lanes.length]
        : quarter.lanes[quarter.at.lanes++ % quarter.lanes.length];
    } else if (bank !== null) {
      const list = bank === 'flood' ? FLOOD.corners : EBB.corners;
      from = list[at[bank]++ % list.length];
    } else if (ring >= 7 && at.turn++ % 2 === 0) {
      from = LATE[at.late++ % LATE.length];
    } else if (seam !== null) {
      from = SEAMS[seam].corners[seamAt[seam].corners++ % SEAMS[seam].corners.length];
    } else {
      from = quarter.corners[quarter.at.corners++ % quarter.corners.length];
    }
    const def = { id: node.id, kind, ring, street: node.street, bank, x: node.x, y: node.y, name: from.name };
    if (from.text) def.text = from.text;
    def.mods = JSON.parse(JSON.stringify(from.mods));   // each node its own copy: content holds no shared objects
    def.choice = choice;
    def.links = links[i];
    if (kind === 'door') def.class = quarter.cls;
    defs.push(def);
  }

  // ---- the definitions ----
  const look = { radii: RADIUS, first: FIRST, step: STEP, close: CLOSE, river, riverHalf: RIVER_HALF, walls: WALLS, streets: [], colours: {} };
  for (let s = 0; s < STREETS; s++) look.streets.push(STREET[s].name);
  for (let q = 0; q < QUARTERS.length; q++) look.colours[QUARTERS[q].cls] = QUARTERS[q].colour;
  Defs.add('plan', {
    id: 'main', name: 'The Plan', text: 'The street plan of Tollbound: one route through it from your door, walked a point at a time.',
    rings: RINGS, streets: STREETS, ringGain: 15, bankGain: 60, mileGain: 25, mileFrom: 4, mileMost: 10, loopMost: 12, loopShare: 50,
    refund: 5, look,
  });
  for (let i = 0; i < defs.length; i++) Defs.add('node', defs[i]);
})();
