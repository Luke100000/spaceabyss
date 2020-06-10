## [0.1.7] - 2020-06-10

### Added


### Fixed
- Previously, if you logged in the galaxy and another player was around you, you would not see the player until they moved. Fixed this in the galaxy.
- The ships of other players now disappear when they land on a planet and you are still in the galaxy.
- A few other delays with showing other players.
- If you buy a pod, it will now re-generate the spaceport display immediately.
- Local message sending should now work in the galaxy
- Chat should scroll to the bottom properly now


### Changed
- Planets in the galaxy will now show up sooner. Less pop in.

## [0.1.6] - 2020-06-10


### Added


### Fixed
- Player sprites now disappear when players logout
- Basic manufacturing without being assembled in an object works again
- Previously, if you logged in the galaxy and another player was around you, you would not see the player until they moved. Fixed this in the galaxy.
- The ships of other players now disappear when they land on a planet and you are still in the galaxy.
- A few other delays with showing other players.
- If you buy a pod, it will now re-generate the spaceport display immediately.
- Local message sending should now work in the galaxy
- Chat should scroll to the bottom properly now


### Changed
- Planets in the galaxy will now show up sooner. Less pop in.

## [0.1.5] - 2020-06-09


### Added


### Fixed
- Various bugs with the server switch
- Bug with converting things (using water to heal an algae vat)
- Repair effect
- Shuttles can't be walked on anymore (this makes them disappear)
- The process that runs Space Abyss works a little differently on the new server. A couple of instances of the game were running simultaneously O_o Fixed this.
- Fixed some residual issues from multiple instances of the game trying to run at the same time.

### Changed
- Planet types and planets now have 4 attributes for size, x and y for both above and under ground. This gives a little more flexability to planet shapes. 
- Worked on some efficiency improvements for moving monsters.
- Server!!! Space Abyss now has its own server.
- Updated the Azure planet to the new generation system


## [0.1.4] - 2020-06-05


### Added
- is_full_game_file_index property to object types. Now things that store energy can visually show players if they are full or not.
- You now receive a more clear success message when landing on a planet, and your ion drives are refilled.
- An error message if you are trying to place a floor, and there is no coord below.

### Fixed
- A little if statement bug that caused the right animation to display instead of the left animation sometimes
- Issue with text going off the game screen.
- Ice can now be mined into ice containers
- Kick beans, when planted, now turn into kick plants, not kick beans
- Multiple issues with tint and object names
- Multiples of the same effect type will now be displayed
- Bug with monsters spawning things
- AI's spawning defensive monster types
- If the object in an inventory item can no longer be found, the inventory item will be deleted.
- I BELIEVE that I have fixed another bug with monsters not showing up on the correct tile.

### Changed
- Object types now use a max_energy_storage property instead of max_storage for clarity
- Object types now have a is_active_frame_count property instead of a frame_count property, again for clarity
- Energy storage can now be assembled, and not just spawned on certain ships when they are created.
- Expanded the energy storage capacity of AI batteries, and made them more difficult to assemble.
- Assembly requirements from Ship Shield Generators and Voon Steaks

## [0.1.3] - 2020-05-27

### Added
- Healing effect sprite, hacking effect sprite, piercing effect sprite
- I'm testing the idea of an in-game help system. Added a 'help' button next to the chat buttons. When clicked, this will pull up 
the most recent failure messages that a player has received, more text about them, and link them to the relevant tutorial page.


### Fixed
- There were quite a few bugs with the new effects. Just visual things like not following monsters, or not disappearing all the time. Lots of fixes for theses
- Bug with attacking objects leftover from testing dependancy issues
- Events spawning in the galaxy was bugged. They weren't getting the galaxy coord at the time of the event insert. Fixed this.
- Player attack now has all the possible damage types added/calculated.
- Fixed many major bugs with pathfinding
- Galaxy events weren't listening to their limit. Now there's over a hundred asteroids in space XD
- Mining in your ship could cause you to not be able to walk around your ship anymore if the tiles were full.
- Bug with calculating player HP when defending from monsters
- Taking part of an inventory item would make it disappear until your client had to re-pull the information for that inventory item.
- Logging into the game should work better. The client needed a connected response from the server, but sometimes the server would send that before 
the client was ready to accept it. Why? No idea! Now the client will ask for that connected message every few seconds until it receives one it 
is ready for.


### Changed
- Spacelane Beacons, Algae Power Cells, and normal Power Cells now assembly requirements.
- Manufacturer assembly requirements. No longer requires nano bonders. I think in general I like having one or two main requirements for something,
rather than a main requirement and a 'bonding/linking/ agent. This changed the manufacturer's salvaging too.
- Merged mining and salvaging beams with the new effects sprites
- Lots of updates to make mining and salvaging flow better
- The spawning rate and decay rates of things were really out of whack in practice. Changed decay from one tick every 10 minutes to one tick every 2 hours. 
Changed spawning from one tick every 2 hours to one tick every 10 minutes.

## [0.1.2] - 2020-05-19

### Added
- Mini Drones now drop batteries
- CNS Stimulant can now be made from Kick Beans in the Food Replicator.
- Heat effect sprite
- Object types (including bodies) can now be weak to electric attacks. The machine body is weak to electric attacks.


### Fixed
- Thiol Extractors can now be assembled.
- Some object spawners were bugged.
- Stairs can now be placed at level 0 and above again.


### Changed

- Ore mined in a ship now defaults to dropping somewhere on the ship floor. Players can build storage containers to 
auto stack ore.
- Wow I'm stupid. This whole time I've been adding in game files, and then passing them as parameters to subsequent 
game files. This has meant that if a function needed to talk to many part of the game, that function would have to be 
in one of the last files loaded. Turns out.... I could have just done things a more normal way from the start, and 
just require the other files outside of the module exports. More server files will be created as I decouple the massive game.js. This 
ended up being a MASSIVE refactoring of code - but I can split up the codebase so much better now.
- Tons of other game code refactoring.
- Re-did effect sprites. Effect sprites now have a specific image, and a more generic type associated with them. Instead of laser sprites, melee sprites,
it's all now effect sprites using the different textures. 


## [0.1.1] - 2020-05-08

### Added
- Players now have a skin_object_type_id - which is how we are planning on supporting Space Abyss financially - cosmetic skins.
- Added the basics of the skin and promotion system.
- Added support for elevators
- Support for planet types having an above ground size, and a below ground size. Centered the lower levels so they weren't
at the top left corner of the planets, but rather the middle.
- Since we currently only support one object/object_type per tile, if a monster drops something and that tile already 
has something, instead of just not dropping it, the game will check the tiles around the monster to see if it can drop 
there. If it cannot do that either, it is added to a queue of things waiting to drop (not currently used).

### Fixed
- Defense from eating is now applied properly.
- Moving through water works better now.

### Changed
- A bit of work on areas and market linkers. Still a long ways to go on this front before it works intuitively.


## [0.1.0] - 2020-04-21

### Added
- Monsters can now spawn in space.
- Comets spawn in the galaxy. They can be mined for ice blocks
- A new property to object types - spawns_in_galaxy. Boolean. This lets the asteroid system turn into more of a system
for anything that spawns directly in the galaxy
- Objects like asteroids and comets can now move around the galaxy
- Monster types can now be weak or strong to all damage types
- Object types can now be weak or strong against heat/freezing damage types 
- Message text whenever something levels up. There was previously intermittent support for this, but it wasn't obvious 
enough.
- The server is now sending conversion linkers to the client. The result parts of the conversion linkers aren't sent. 
This still removes a bit of mystery, but being a farmer in Space Abyss basically sucked when you had to scroll through 
your entire inventory every time. 
- Admins can reload an event and all it's linkers and planet linkers from the database while the server is running

### Changed
- COMPLETELY changed how monsters and objects spawn on planets. 
- OLD WAY: Previously, there were set objects and monsters during 
planet creation. A big downside of this is that I needed to regenerate a planet everytime I added in 
a new object or monster that I wanted to spawn on the planet. If the number that spawned felt wrong, I had to re-generate 
the entire planet. If there was a bug and players destroyed something they shouldn't - I could either manually add it back 
in or... regenerate the planet.
- NEW WAY: Monsters and objects spawn via the event system. So I can change a monster or objects spawn behavior without 
regenerating the entire planet. 
- Changed the frame count and attackability of various spawners to work with the new system.
- Most edible things have had their duration doubled. I've found that only 10 ticks as a minimum goes by really fast. So 
the new general minimum is 20 ticks.


### Fixed
- Some spawners that don't spawn with HP and can't be attacked were failing to spawn things since their
hp_percent was NaN.
- Picking up Life Water
- Equipping wasn't working for some of the Exodium and Quick Matter set
- Lots of skills weren't updating properly. Lots of little broken bits around that system. Fixed them.
- Various bugs with switching views
- Display issue with the Primordial Ooze Pool
- Asteroids would show up on any view when they moved - made the shouldDraw checks more consistent on all views,
and fixed quite a few bugs that showed up from that.
- Spawned events were being deleted from memory, but not the database. This caused a bunch of old spawned events to 
always appear after a server startup, delaying events.


## [0.0.13] - 2020-04-02

### Added
- A bit of work on Frozen Planets. They can now generate successfully - and added an ice block event.


### Changed
- COMPLETELY reworked the spawning system to incorporate the growing system, and turned it into a linker - so monsters and 
objects can spawn/turn into different things with different % chances, rarities, requirements, etc. The system is 
vastly more flexible, and the code that runs it is better.


### Fixed
- I didn't realize how broken the event system was. Even just spawning a basic small block of ice as an event wasn't
working properly. Spent a lot of time improving and fixing bugs with the event system.

## [0.0.12] - 2020-03-29

### Added
- Visual response to the client when converting things into energy
- Crystal Bee, Crystal Golem, AI Forge, and Corrupted Scientist - @UnfuneralOD https://twitter.com/UnfuneralOD
- Failure message when there is a failed mining complexity check
- Allow admin users to bypass the ticking of assemblies. Things still have to tick once, but for testing purposes 
it was a pain to reduce the tick amount, test, and then increase the tick amount again. I can always test the feel 
with actual tick amounts on a non-admin character.
- Players can now attack planets.

### Fixed
- Bug with deleting spawned events. A bit of bad copy/pasta.
- Rock wall was still using the old image location. It has been updated.
- Multi tile ships can successfully launch from planets if they are designed to do so.
- Bug that caused a clean clearing of a previous level/display to fail when multiple players were nearby
- Damage occurring on a different level than the client won't show up anymore
- Bug that made a different player switching to their ship view cause your client to think you needed 
to generate an airlock display as well, which made your 'View Ship' option disappear.
- Bug with new object info not being sent to the room if it was also being sent to the socket
- The admin function to set a planet type wasn't working - it is now.


## [0.0.11] - 2020-03-05

### Added
- Re-vamped the object and monster spawning system. Monsters can now spawn harvestable items. A current example of 
this in game right now is Milk Slerms spawning Slerm Milk, which you can harvest from them.
- Monsters have a new attribute, attack_chance_on_harvest . Now we can have stronger monsters with harvestable 
things, and some risk involved. Higher farming level decreases the risk of the monster attacking.
- OUR FIRST LOGO! Courtesy of @UnfuneralOD https://twitter.com/UnfuneralOD
- New movement style - static. Now sprites can be set to either a simple flip, having up/down/left/right, or just 
move along with their single animation. This is for large things like Space Stations that look odd if they flip around
really fast.
- Failure messages and an immediate bounce back if a large, dockable ship is trying to land on a planet, or dock with 
 another large ship, (they can't do either)

### Changed
- New ship interior sprites from @UnfuneralOD ( https://twitter.com/UnfuneralOD ). Floor, wall, 
airlock, ion engines
- Complexity for Defense Drones (they were the default of 1)
- The assembly requirements and complexity for Corrupted Battery Packs
- Hull welder uses heat skill
- Previously events could only spawn one object type when they de-spawned or were otherwise deleted/killed. I've 
moved that to the drop linker table, and its associated with the individual event linkers. This way, the 
drops of an event are basically the same as a drop from a monster. This will let me have random and rare drops 
when something like a dust storm ends (it's 'uncovering' treasure or something)
- Removed the option to assemble 'all' and '10' when assembling from a shipyard, since the shipyard gets used up at the
end of the assembly.

### Fixed
- Movement speed for MLM body
- I believe I have fixed an issue with new players switching back out of their ship

## [0.0.10] - 2020-01-27

### Added
- Electric effect for an electric damage type
- Pathfinding for monsters that take up a single tile of space


### Fixed
- The floor of planet coords that were brought in during monster movement will now be drawn
- Added a couple of conditions in which monsters are drawn, so in general monster sprites should be drawn quicker


## [0.0.9] - 2020-01-22

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

### Changed
- Made the cargo ship larger
- Decreased the cost of the shuttle significantly, since it's smaller than the cargo ship and the mining ship
- The salvaging opportunities of the forge (added nano bonder)
- Food replicator can now be salvaged for 1/2 resources back.
- Research Station can now be salvaged for 1/2 resources back.
- Sprite changes: Spacelane beacon. Machine walls. Rock Walls. Territe. Syntite. Some floors. 
@UnfuneralOD https://twitter.com/UnfuneralOD

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


## [0.0.8] - 2020-01-13

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

### Fixed
- Assemblies using the old assembly tick count, instead of the new one which is based on the object we're 
using for the assembly.
- Placing multi-tile ships on the galaxy
- When a player's HP changes, we now redraw the hp bar
- A few different bugs when players die that interrupted the dying process
- Player surgery level was not being calculated



## [0.0.7] - 2020-01-04

### Added
- watched_by_object_id column to the object_types table - setting up for protected Spacelanes
- Spacelane beacon object, and all the logic behind supporting it
- More messages about fuel for non-default ships. The game doesn't communicate that there are fuel 
requirements very well
- Ability to jump out the airlock with an emergency pod if you are truly stuck on your ship

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

### Fixed
- Bug setting new coords to belong to planets switching planet types
- Defense drone assembly location
- Critical bug that could switch sockets when logging in
- Damage types being sent when objects attack other objects
- I had broken ship refueling with some typos.
- Animations showing from previous levels after you switch levels


## [0.0.6] - 2019-12-28

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

### Fixed
- Auto doc required message appearing as a success instead of failure.
- Mini drones not moving when attacking
- Game file index for acid floors
- Hull welders can now be picked up, Chitin legs can now be picked up
- Bug when placing an object type on that same object type
- Failed login redirecting to 404 pages on the website

## [0.0.5] - 2019-12-23

### Added
- Result message when trying to equip something normally, but an auto doc is required

### Fixed
- Only stack equippable items if they are consumed on attack
- Exodium can now be picked up
- An error sending player stats when switching bodies that prevented some of the equipment a player had on from showing.
- Display depth of important_text. Previously, it was showing under the top of walls. Now it shows above them.



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