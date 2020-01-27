## [0.0.10] - 2020-01-27

### Fixed
- The floor of planet coords that were brought in during monster movement will now be drawn
- Added a couple of conditions in which monsters are drawn, so in general monster sprites should be drawn quicker

### Added
- Electric effect for an electric damage type
- Pathfinding for monsters that take up a single tile of space

## [0.0.9] - 2020-01-22
### Fixed
- When objects are placed on a planet or ship, set a planet_id/ship_id for that object (this is used for AIs associating
 AI Batteries/AI Cores with themselves)
- Remove names and tints of objects when the player changes levels or views
- AIs won't protect players they are attacking
- Spaceport merchant spots are now protected
- Various bugs related to when salvaging finishes
- Bug when a ship or other object with associated things was loaded in from an event. Nothing, like ship coords,
were being grabbed from the database and attached. Should have that all fixed but just calling getObjectIndex 
from the init function
- Dead bodies of players could overwrite the location of static stairs. I've fixed this, and put in an extra 
check in the placeObject function that will throw a warning and prevent it if something like this is happening 
somewhere else.


### Changed
- Made the cargo ship larger
- Decreased the cost of the shuttle significantly, since it's smaller than the cargo ship and the mining ship
- The salvaging opportunities of the forge (added nano bonder)
- Food replicator can now be salvaged for 1/2 resources back.
- Research Station can now be salvaged for 1/2 resources back.
- Sprite changes: Spacelane beacon. Machine walls. Rock Walls. Territe. Syntite. Some floors. 
@UnfuneralOD https://twitter.com/UnfuneralOD

### Added
- A failure message when trying to replace a floor or 'build' something, but the ruling AI doesn't allow it
- Started more of the structure for factions. Joining, creating, leaving, viewing. Still have a long way to go, but 
will push this and then continue down the path with factions.
- An admin interface to make the designing of ships easier. This isn't directly part of the client/server, but part
of the Space Abyss website. I think I need to eventually include that in this repository too.
- Support for ships with multiple levels (still need to test this a bunch)
- The ability to use batteries to add power to AI Batteries
- An asteroid ship. The first multi level ship. Currently in testing. Uses a new type of ship engine, a Thiol Drive.
- Admins can now spawn events in the galaxy and ship
- Support for events to spawn in a ship or a galaxy. Crazy how big and far this change ended up reaching.


## [0.0.8] - 2020-01-13
### Fixed
- Assemblies using the old assembly tick count, instead of the new one which is based on the object we're 
using for the assembly.
- Placing multi-tile ships on the galaxy
- When a player's HP changes, we now redraw the hp bar
- A few different bugs when players die that interrupted the dying process
- Player surgery level was not being calculated


### Changed
- When going up stairs, or down a hole, the server will try to place you in tiles surrounding the hole/stairs 
if the main tile is blocked by something.
- Moved and resized the 'Trash' button on inventory items so it's not the first thing you mouseoever
- Optimized when checking to see if an NPC can build a structure. Stops searching subsequent coords if one has 
already failed
- New Robot Janitor and Crystal Spider Baby sprites from @RunninBlood ( https://twitter.com/RunninBlood )
- Put Crystal Spider Babies on the surface level of Mountain planet types, and made Crystal Spiders stronger, and 
spawning them starting at -1 instead.
- Changed the drops of Crystal Spiders and Crystal Guards to include dropping Crystals

### Added
- Support for augments. Augments are neural enhancements that always require an auto doc to equip. I king of wanted 
them to completely burn a body on failure, but for now I am going to keep it consistent with other equip spots. 
Failure will just burn the spot, and take away some HP. For now I think the consistency, and the game's general 
ability to communicate disaster make burning an entire body too detrimental. It's still possible to fail until you 
have 0 HP and the body dies.
- The basics of a doctor NPC. Once an NPC with the dream of becoming a doctor obtains 100 credits, they are able 
to build a clinic with a pair of auto docs. 
- The ability for a user to use an auto doc from a doctor npc. This uses the NPC's surgery skill, rather than the 
player's surgery skill. This should open up the pathway for players to offer surgery stuff down the road as well. 
- A doctor npc's surgery skill will slowly increase as they tinker with.... bodies.


## [0.0.7] - 2020-01-04
### Fixed
- Bug setting new coords to belong to planets switching planet types
- Defense drone assembly location
- Critical bug that could switch sockets when logging in
- Damage types being sent when objects attack other objects
- I had broken ship refueling with some typos.
- Animations showing from previous levels after you switch levels

### Changed
- Re-worked how we go through planet coords for the map update. The old way actually didn't scale well at all - 
running getPlanetCoordIndex for each coord. Instead we just iterate through all the planet coords once, 
adding in what we need, and running getPlanetCoordIndex on the not found ones against our index. Old way could 
easily get to 100ms per player (super unsustainable). New way is ~2-5ms per player.
- Did a similar re-coding for a ship coords update. Difference is even more drastic here. 300ms -> .2 to 1ms
- Trying less frequent total map updates for players ( 5 -> 20 seconds ). In theory the goal is to not have this 
on setIncrement at all.
- Airlocks can now have rules 
- Can no longer walk on Ion Drives

### Added
- watched_by_object_id column to the object_types table - setting up for protected Spacelanes
- Spacelane beacon object, and all the logic behind supporting it
- More messages about fuel for non-default ships. The game doesn't communicate that there are fuel 
requirements very well
- Ability to jump out the airlock with an emergency pod if you are truly stuck on your ship

## [0.0.6] - 2019-12-28
### Fixed
- Auto doc required message appearing as a success instead of failure.
- Mini drones not moving when attacking
- Game file index for acid floors
- Hull welders can now be picked up, Chitin legs can now be picked up
- Bug when placing an object type on that same object type
- Failed login redirecting to 404 pages on the website


### Changed
- Updated the complexity of Chitin Body ( armor ) to 6 to match the rest of the set
- AI Fragment complexity increased from 14 to 18
- Updated the assembly requirements for laser guns and laser rifles
- Made Monitors weak to hacking attacks
- Re-coded the game.tickObjectSpawners function
- Thiol extractors can only be placed on thiol deposits
- The large 'Play Space Abyss' button on the website now is disabled if the above steps aren't met. You still don't
need to login to the website to play the game, but this should be more clear for new players.
- New sprites for slaver planet, corporation planet, and dirt walls from @UnfuneralOD

### Added
- Exodium armor set. Using placeholder sprites for now
- Thiol Extractors now spawn thiol canisters
- Added a planet_type_impact_linkers table, which we will be able to use to increase or decrease planet HP based 
on object types being produced/generated from the planet ( current goal is Thiol extraction from acid planets 
reducing hp)
- Added a drop_requires_object_type_id property to object types to support needing to drop a Thiol Extractor on 
a Thiol Deposit
- Thiol Deposists now spawn on Acid planets as an event.
- Placeholder images for thiol deposit, thiol extractor, and thiol cannister
- Added a navbar to the Space Abyss website
- A bypass for the new disabled 'Play Space Abyss' button
- Added in game assets psd files. I use Photopea to open/edit these.

## [0.0.5] - 2019-12-23
### Fixed
- Only stack equippable items if they are consumed on attack
- Exodium can now be picked up
- An error sending player stats when switching bodies that prevented some of the equipment a player had on from showing.
- Display depth of important_text. Previously, it was showing under the top of walls. Now it shows above them.

### Added
- Result message when trying to equip something normally, but an auto doc is required

## [0.0.4] - 2019-12-22
### Fixed
- Melee attack skill not incrementing on a range 1 attack when the player had no equipment.

## [0.0.3] - 2019-12-22
### Fixed
- Bug that prevented eating from working

## [0.0.2] - 2019-12-22

### Added
- MLM bodies can now eat batteries for HP regeneration
- Added in a deep rock floor tileset for mountain planet levels -1 and lower. Drawn by UnfuneralOD

### Changed
- Machine world size increased from 20 tile to 30 tiles
- Circuitry spawn changed from common to rare
- Auto generated stairs and hole on planets are now using new sprites by UnfuneralOD
- Changed the rock floor tileset to new sprites drawn by UnfuneralOD

### Fixed
- Corrected the sprite for the cutter before we have the animation.

## [0.0.1] - 2019-12-21
### Added 
- Changelog. Space Abyss is coming along nicely, and I think it would be neat to start to have a better record of the changes happening to the game.
- Corporation walls, so corporation planets are no longer using dirt walls as a placeholder (which looks awful)
- Cracked city floor tiles, and added them to corporation planets when they generate.
- Power cell. More energy storage than a battery. Added it to the drop linkers of various monsters.
- Mini drone. Spawns on machine planets.
- Lots of other changes prior to starting to keep track of things

### Changed
- New placeholder sprite for the Warmind
- New placeholder sprite for the DDrone
- Updated the placeholder machine wall sprites to our new format

### Fixed
- Editing in reasons and rarity for the things monsters drop
- You can now stop attacking an npc ( but it won't stop them attacking you back)